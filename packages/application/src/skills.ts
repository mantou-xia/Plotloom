import { randomUUID } from 'node:crypto';
import { parseDocument } from 'yaml';
import { invalid, WorkspaceError } from '@plotloom/domain';
import { bundleVersion, decodeText, inspectSkill, skillName, skillPath, type SkillBundle } from '@plotloom/domain/skills';
import type { SkillInfo, SkillFile, SkillActivation, SessionSkillProfile, ChatSummary } from '@plotloom/contracts/skills';
import type { CreateSessionRequest, SessionListItem, SessionSummary } from '@plotloom/contracts';

export type StoredSkill = Omit<SkillInfo, 'missingTools' | 'warnings' | 'runnable'>;
export interface SkillState { format: 1; skills: StoredSkill[]; workspaces: Record<string, string[]> }
export interface SkillRepository {
  run<T>(operation: (state: SkillState) => Promise<T>): Promise<T>;
  persist(state: SkillState): Promise<void>;
  read(skill: StoredSkill): Promise<SkillBundle>;
  write(skill: StoredSkill, files: SkillBundle): Promise<void>;
  importDirectory(root: string): Promise<SkillBundle>;
  remove(skill: StoredSkill): Promise<void>;
}
/** 会话只通过公开形状的端口交互；消息持久化和循环不由技能业务接管。 */
export interface SkillSessions {
  create(request: CreateSessionRequest, profile: SessionSkillProfile): Promise<SessionSummary>;
  list(): Promise<SessionListItem[]>;
  profile(id: string): Promise<SessionSkillProfile>;
  setSkills(id: string, skillIds: string[] | null): Promise<void>;
}
export interface SkillSnapshot { id: string; name: string; description: string; version: string; files: Record<string, string>; autoLoad: boolean }
const fail = (code: string, message: string, status = 409): never => { throw new WorkspaceError(code, message, status); };
const find = (state: SkillState, id: string) => state.skills.find(s => s.id === id) ?? fail('SKILL_NOT_FOUND', '技能不存在或已移除。', 404);

/** 应用级技能与工作区默认配置；每次请求固定资源，管理动作不改变进行中的请求。 */
export class SkillService {
  private readonly store: SkillRepository;
  private readonly sessions: SkillSessions;
  private readonly checkWorkspace: (id: string) => Promise<unknown>;
  private readonly tools: string[];
  constructor(store: SkillRepository, sessions: SkillSessions, checkWorkspace: (id: string) => Promise<unknown>, tools: string[]) {
    this.store = store; this.sessions = sessions; this.checkWorkspace = checkWorkspace; this.tools = tools;
  }

  private view(skill: StoredSkill): SkillInfo {
    const missingTools = skill.declaredTools.filter(name => !this.tools.includes(name));
    const warnings = [
      ...(missingTools.length ? ['缺少声明工具；此技能不会加载到模型。'] : []),
      ...(skill.compatibility ? ['环境说明尚需人工核对，应用不会安装运行环境。'] : []),
      ...(skill.files.some(p => p.startsWith('scripts/')) ? ['脚本仅保留为文件，不会执行。'] : []),
    ];
    return { ...skill, missingTools, warnings, runnable: missingTools.length === 0 };
  }
  list() { return this.store.run(async s => ({ skills: s.skills.map(v => this.view(v)) })); }
  get(id: string) { return this.store.run(async s => this.view(find(s, id))); }
  file(id: string, path: string): Promise<SkillFile> {
    skillPath(path);
    return this.store.run(async s => {
      const skill = find(s, id); const files = await this.store.read(skill);
      if (!Object.hasOwn(files, path)) fail('SKILL_FILE_NOT_FOUND', '技能资源不存在。', 404);
      try { return { path, content: decodeText(files[path]), encoding: 'utf8', version: skill.version }; }
      catch { return { path, content: files[path], encoding: 'base64', version: skill.version }; }
    });
  }
  private async add(state: SkillState, files: SkillBundle, source: StoredSkill['source'], origin: string) {
    const version = bundleVersion(files); const meta = inspectSkill(decodeText(files['SKILL.md']));
    if (state.skills.some(s => s.name === meta.name)) fail('SKILL_NAME_EXISTS', '同名技能已存在，请使用其他名称。');
    const skill: StoredSkill = { ...meta, id: randomUUID(), source, origin, version, files: Object.keys(files).sort(), updatedAt: new Date().toISOString() };
    await this.store.write(skill, files); state.skills.push(skill); await this.store.persist(state); return this.view(skill);
  }
  create(content: string) {
    if (!content.isWellFormed()) invalid('技能文本含有无效 Unicode 字符。');
    return this.store.run(s => this.add(s, { 'SKILL.md': Buffer.from(content).toString('base64') }, 'custom', '用户创建'));
  }
  import(root: string) { return this.store.run(async s => this.add(s, await this.store.importDirectory(root), 'imported', root)); }
  copy(id: string, name: string) {
    skillName(name);
    return this.store.run(async s => {
      const from = find(s, id); const files = await this.store.read(from);
      const raw = decodeText(files['SKILL.md']); const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)!;
      // 只修改 YAML 名称，保留全部参考资源及正文；内置原件保持只读。
      const yaml = parseDocument(match[1]); yaml.set('name', name);
      files['SKILL.md'] = Buffer.from(`---\n${yaml.toString()}---\n${raw.slice(match[0].length)}`).toString('base64');
      return this.add(s, files, 'custom', `复制自 ${from.name}`);
    });
  }
  update(id: string, input: { path: string; content: string; baseVersion: string }) {
    skillPath(input.path);
    return this.store.run(async s => {
      const old = find(s, id);
      if (old.source === 'builtin') fail('SKILL_READ_ONLY', '内置技能只读，请先复制为自定义技能。');
      if (old.version !== input.baseVersion) fail('SKILL_VERSION_CONFLICT', '技能已更新，请重新读取后编辑。');
      if (!input.content.isWellFormed()) invalid('技能文本含有无效 Unicode 字符。');
      const files = await this.store.read(old);
      files[input.path] = Buffer.from(input.content).toString('base64');
      const version = bundleVersion(files); const meta = inspectSkill(decodeText(files['SKILL.md']));
      if (meta.name !== old.name) invalid('编辑时不能更改技能名称；需要新名称请复制。');
      const skill = { ...old, ...meta, version, files: Object.keys(files).sort(), updatedAt: new Date().toISOString() };
      await this.store.write(skill, files); s.skills[s.skills.indexOf(old)] = skill; await this.store.persist(s); return this.view(skill);
    });
  }
  delete(id: string) {
    return this.store.run(async s => {
      const skill = find(s, id);
      if (skill.source === 'builtin') fail('SKILL_READ_ONLY', '内置技能不可删除，可以在启用设置中关闭。');
      s.skills = s.skills.filter(v => v.id !== id);
      for (const key of Object.keys(s.workspaces)) s.workspaces[key] = s.workspaces[key].filter(v => v !== id);
      await this.store.persist(s); await this.store.remove(skill); return { deleted: true };
    });
  }
  private defaults(s: SkillState, id: string | null) {
    return id === null ? [] : s.workspaces[id] ?? s.skills.filter(v => v.source === 'builtin' && v.name === 'novel-writing').map(v => v.id);
  }
  private validateIds(s: SkillState, ids: string[]) { if (ids.length > 50 || new Set(ids).size !== ids.length) invalid('技能最多 50 项且不可重复。'); for (const id of ids) find(s, id); }
  async workspaceSettings(id: string) { await this.checkWorkspace(id); return this.store.run(async s => ({ skillIds: this.defaults(s, id) })); }
  async setWorkspaceSettings(id: string, ids: string[]) {
    await this.checkWorkspace(id);
    return this.store.run(async s => { this.validateIds(s, ids); s.workspaces[id] = ids; await this.store.persist(s); return { skillIds: ids }; });
  }
  private activation(s: SkillState, profile: SessionSkillProfile): SkillActivation {
    const ids = profile.skillIds ?? this.defaults(s, profile.workspaceId);
    const skills = ids.flatMap(id => { const found = s.skills.find(v => v.id === id); return found ? [this.view(found)] : []; });
    return { ...profile, mode: profile.skillIds === null ? 'inherit' : 'override', effectiveSkillIds: ids, skills,
      unavailable: ids.flatMap(id => { const skill = skills.find(v => v.id === id); return !skill ? [{ id, reason: '技能已移除，请调整聊天设置。' }]
        : skill.runnable ? [] : [{ id, reason: `缺少工具：${skill.missingTools.join('、')}` }]; }) };
  }
  async sessionSettings(id: string) { const profile = await this.sessions.profile(id); return this.store.run(async s => this.activation(s, profile)); }
  async setSessionSettings(id: string, ids: string[] | null) {
    await this.sessions.profile(id);
    await this.store.run(async s => { if (ids !== null) this.validateIds(s, ids); await this.sessions.setSkills(id, ids); });
    return this.sessionSettings(id);
  }
  async createChat(workspaceId: string, request: CreateSessionRequest) {
    await this.checkWorkspace(workspaceId); return { ...await this.sessions.create(request, { workspaceId, skillIds: null }), workspaceId };
  }
  async chats(workspaceId?: string): Promise<{ sessions: ChatSummary[] }> {
    if (workspaceId) await this.checkWorkspace(workspaceId);
    const sessions = await Promise.all((await this.sessions.list()).map(async s => ({ ...s, workspaceId: (await this.sessions.profile(s.id)).workspaceId })));
    return { sessions: sessions.filter(s => workspaceId === undefined || s.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  }
  /** 先在同一仓储串行操作中确定版本并读出资源；修改/删除之后只影响后续请求。 */
  async snapshot(id: string, explicit: string[] = []): Promise<SkillSnapshot[]> {
    const profile = await this.sessions.profile(id);
    return this.store.run(async s => {
      const activation = this.activation(s, profile);
      for (const skillId of explicit) {
        const skill = activation.skills.find(v => v.id === skillId);
        if (!skill?.runnable) fail('SKILL_UNAVAILABLE', '显式选择的技能未启用、已移除或缺少工具。', 422);
      }
      const result: SkillSnapshot[] = [];
      for (const skill of activation.skills.filter(v => v.runnable)) {
        const bundle = await this.store.read(skill); const files: Record<string, string> = Object.create(null);
        for (const [path, bytes] of Object.entries(bundle)) { try { files[path] = decodeText(bytes); } catch { /* 二进制仍可由管理 API 取回，不送入模型文本工具。 */ } }
        result.push({ id: skill.id, name: skill.name, description: skill.description, version: skill.version, files, autoLoad: explicit.includes(skill.id) || (profile.workspaceId !== null && skill.source === 'builtin' && skill.name === 'novel-writing') });
      }
      return result;
    });
  }
}
