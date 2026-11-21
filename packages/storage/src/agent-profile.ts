import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AGENT_PROFILE_LIMITS, type AgentProfile, type AgentProfileUpdate } from '@plotloom/contracts';
import { invalid } from '@plotloom/domain';

const defaultProfile: AgentProfile = { setup: 'pending', name: '', style: '', preferences: '' };

/** 每个本机数据目录共用一份人设。原子替换使读取只会看到完整的旧版或新版记录。 */
export class FileAgentProfile {
  private readonly dataDir: string;
  private readonly path: string;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(dataDir: string) { this.dataDir = dataDir; this.path = join(dataDir, 'agent-profile.json'); }

  async read(): Promise<AgentProfile> {
    try { return JSON.parse(await readFile(this.path, 'utf8')) as AgentProfile; }
    catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaultProfile };
      throw cause;
    }
  }

  /** 首用写入只在待引导状态有效，状态核对与写盘共用队列，防止覆盖设置页的新值。 */
  update(input: AgentProfileUpdate): Promise<AgentProfile>;
  update(input: AgentProfileUpdate, bootstrap: { signal?: AbortSignal }): Promise<AgentProfile | null>;
  update(input: AgentProfileUpdate, bootstrap?: { signal?: AbortSignal }): Promise<AgentProfile | null> {
    const operation = this.pending.then(async () => {
      bootstrap?.signal?.throwIfAborted();
      if (bootstrap && (await this.read()).setup !== 'pending') return null;
      let next: AgentProfile;
      if (input.action === 'skip') {
        const current = await this.read();
        if (current.setup !== 'pending') return current;
        next = { ...current, setup: 'skipped' };
      } else {
        const trim = (key: keyof typeof AGENT_PROFILE_LIMITS) => {
          const value = input[key].trim();
          if (!value.isWellFormed() || value.includes('\0') || value.length > AGENT_PROFILE_LIMITS[key]) invalid('Agent 人设字段无效。');
          return value;
        };
        next = { setup: 'configured', name: trim('name'), style: trim('style'), preferences: trim('preferences') };
      }
      await mkdir(this.dataDir, { recursive: true });
      const temporary = this.path + '.tmp';
      try {
        await writeFile(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', flush: true });
        bootstrap?.signal?.throwIfAborted();
        await rename(temporary, this.path);
      } finally { await rm(temporary, { force: true }); }
      return next;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
}
