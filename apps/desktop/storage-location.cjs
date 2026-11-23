const { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { dirname, isAbsolute, join, relative, sep } = require('node:path');

function contains(parent, child) {
  const path = relative(parent, child);
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
}

/** 目录设置保存在 Electron 用户目录中，启动时无需先打开任一业务数据目录。 */
function storageLocation(profileDir) {
  const configPath = join(profileDir, 'storage-location.json');
  const defaultDir = join(profileDir, 'data');

  async function save(config) {
    const temporary = configPath + '.tmp';
    await writeFile(temporary, JSON.stringify(config), { encoding: 'utf8', flush: true });
    await rename(temporary, configPath);
  }

  return {
    /** 后端未启动时复制快照，完整复制并原子更新配置后，才允许新目录接收业务写入。 */
    async open() {
      let config;
      try { config = JSON.parse(await readFile(configPath, 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await mkdir(defaultDir, { recursive: true });
        return { dataDir: await realpath(defaultDir) };
      }
      const { dataDir, pendingDir, sourceDir = dataDir } = config;
      if (!isAbsolute(dataDir) || !(await stat(dataDir).catch(() => null))?.isDirectory()) {
        throw new Error('应用数据目录不可用，请恢复目录的访问后重新打开 Plotloom。');
      }
      if (!pendingDir) return { dataDir };

      let created = false;
      try {
        const source = await realpath(sourceDir);
        // 独占创建目录，避免覆盖用户文件或上次中断迁移留下的副本。
        if (!isAbsolute(pendingDir)
          || relative(dirname(pendingDir), await realpath(dirname(pendingDir))) !== ''
          || contains(source, pendingDir)
          || contains(await realpath(dataDir), pendingDir)) throw new Error('目标目录无效。');
        await mkdir(pendingDir);
        created = true;
        for (const entry of await readdir(source)) {
          await cp(join(source, entry), join(pendingDir, entry), { recursive: true, force: false, errorOnExist: true });
        }
        await save({ dataDir: pendingDir });
        return { dataDir: pendingDir };
      } catch {
        if (created) await rm(pendingDir, { recursive: true, force: true }).catch(() => {});
        await save({ dataDir }).catch(() => {});
        return { dataDir, migrationFailed: true };
      }
    },

    /** 只登记系统目录选择器给出的目标。独立子目录避免和现有作品、项目或 Electron 数据混放。 */
    async destination(parent, protectedRoots) {
      const directory = join(await realpath(parent), 'Plotloom-data');
      if (protectedRoots.some(root => contains(root, directory) || contains(directory, root))) {
        throw new Error('请选择项目、小说及当前应用数据目录之外的文件夹。');
      }
      const exists = await stat(directory).then(() => true, error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      });
      if (exists) throw new Error('所选文件夹下已有 Plotloom-data，请选择其他位置。');
      return directory;
    },

    /** 导入副本放在桌面用户目录内，旧数据和当前数据都可以继续作为恢复来源。 */
    async importLocation(directory, dataDir) {
      const sourceDir = await realpath(directory);
      const profile = await realpath(profileDir);
      if (contains(sourceDir, profile) || relative(await realpath(dataDir), sourceDir) === '') {
        throw new Error('请选择旧版 Plotloom 的数据目录。');
      }
      const entries = await readdir(sourceDir, { withFileTypes: true });
      const recognized = entries.some(entry => (entry.isFile() && ['projects.json', 'agent-profile.json', 'model-config.json'].includes(entry.name))
        || (entry.isDirectory() && entry.name === 'sessions' && entries.some(other => other.isDirectory() && other.name === 'agent')));
      if (!recognized) throw new Error('所选文件夹中未找到 Plotloom 数据，请选择旧版使用的实际数据目录。');
      return { sourceDir, pendingDir: join(profile, 'import-' + randomUUID()) };
    },

    schedule: (dataDir, pendingDir, sourceDir) => save({ dataDir, pendingDir, sourceDir }),
  };
}

module.exports = { storageLocation };
