import { mkdir, readFile, writeFile, readdir, lstat, rename, rm, realpath } from 'node:fs/promises';
import { join, resolve, dirname, isAbsolute, basename, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { SkillRepository, SkillState, StoredSkill } from '@plotloom/application/skills';
import { bundleVersion, decodeText, inspectSkill, skillPath, type SkillBundle } from '@plotloom/domain/skills';
import { invalid, WorkspaceError, requireId } from '@plotloom/domain';

/** 原生文件树保存技能；清单原子替换，旧版本允许本轮已读取的快照继续使用。 */
export class FileSkillRepository implements SkillRepository {
  private readonly root: string;
  private queue: Promise<unknown> = Promise.resolve();
  private initialized = false;
  constructor(dataDir: string) { this.root = resolve(dataDir, 'skills'); }
  private location(skill: StoredSkill) {
    requireId(skill.id);
    if (!/^[a-f0-9]{64}$/.test(skill.version)) invalid('技能版本无效。');
    return join(this.root, 'packages', skill.id, skill.version, skill.name);
  }
  run<T>(operation: (s: SkillState) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      await mkdir(this.root, { recursive: true });
      let state: SkillState;
      try { state = JSON.parse(await readFile(join(this.root, 'state.json'), 'utf8')); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; state = { format: 1, skills: [], workspaces: {} }; }
      if (state.format !== 1) throw new WorkspaceError('SKILL_STATE_INVALID', '技能清单格式无效，请检查备份。', 500);
      if (!this.initialized) {
        const files = await this.readTree(fileURLToPath(new URL('../builtin/novel-writing', import.meta.url)));
        const version = bundleVersion(files); const current = state.skills.find(s => s.id === 'builtin-novel-writing');
        if (current?.version !== version) {
          const skill: StoredSkill = { ...inspectSkill(decodeText(files['SKILL.md'])), id: 'builtin-novel-writing', source: 'builtin', origin: 'Plotloom', version, files: Object.keys(files).sort(), updatedAt: new Date().toISOString() };
          await this.write(skill, files); state.skills = [skill, ...state.skills.filter(s => s.id !== skill.id)]; await this.persist(state);
        }
        this.initialized = true;
      }
      return operation(state);
    });
    this.queue = result.catch(() => {}); return result;
  }
  async persist(state: SkillState) {
    const target = join(this.root, 'state.json'); const temporary = `${target}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(state), { flag: 'wx', flush: true }); await rename(temporary, target); }
    finally { await rm(temporary, { force: true }); }
  }
  /** 目录导入保留全部普通文件，但拒绝任何链接；限制总体大小以免把整盘误作技能目录。 */
  private async readTree(root: string): Promise<SkillBundle> {
    const stat = await lstat(root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) invalid('技能根目录必须是普通目录。');
    const files: SkillBundle = Object.create(null); let total = 0;
    const walk = async (prefix: string) => {
      for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name; skillPath(path);
        if (entry.isSymbolicLink()) invalid('技能目录不允许符号链接或目录联接。');
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) {
          const target = join(root, path); total += (await lstat(target)).size;
          if (total > 20 * 1024 * 1024 || Object.keys(files).length >= 500) invalid('单个技能最多 500 个文件、20 MiB。');
          files[path] = (await readFile(target)).toString('base64');
        } else invalid('技能只能包含普通文件与目录。');
      }
    };
    await walk(''); return files;
  }
  async importDirectory(root: string) {
    if (!isAbsolute(root)) invalid('请提供已下载完整技能目录的绝对路径。');
    try {
      const files = await this.readTree(root); bundleVersion(files);
      if (inspectSkill(decodeText(files['SKILL.md'])).name !== basename(await realpath(root))) invalid('SKILL.md 的 name 必须与导入目录名称一致。');
      return files;
    } catch (e) {
      if (e instanceof WorkspaceError) throw e;
      throw new WorkspaceError('SKILL_IMPORT_FAILED', '无法读取技能目录，请检查路径和权限。', 422);
    }
  }
  async read(skill: StoredSkill) {
    const files = await this.readTree(this.location(skill));
    if (bundleVersion(files) !== skill.version) throw new WorkspaceError('SKILL_VERSION_CONFLICT', '安装目录在应用外发生变化，请重新导入副本。');
    return files;
  }
  async write(skill: StoredSkill, files: SkillBundle) {
    const target = this.location(skill);
    // 清单是唯一发布点：所有文件写完才由调用方更新清单。避免 Windows 对新目录
    // rename 的临时 EPERM；wx 保证重用相同版本时不会截断已发布文件。
    for (const [path, content] of Object.entries(files)) {
      skillPath(path); const file = join(target, path); await mkdir(dirname(file), { recursive: true });
      const bytes = Buffer.from(content, 'base64');
      try { await writeFile(file, bytes, { flag: 'wx', flush: true }); }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        if (!(await readFile(file)).equals(bytes)) throw new WorkspaceError('SKILL_VERSION_CONFLICT', '已有技能版本的文件与预期不符，请检查安装目录。');
      }
    }
    await this.read(skill);
  }
  async remove(skill: StoredSkill) {
    requireId(skill.id);
    const parent = resolve(this.root, 'packages'); const target = resolve(parent, skill.id); const rel = relative(parent, target);
    if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel)) invalid('技能删除路径无效。');
    // 确认解析后的目录在应用技能根内，再删除本技能的历史版本；运行中的资源已在内存固定。
    await rm(target, { recursive: true, force: true });
  }
}
