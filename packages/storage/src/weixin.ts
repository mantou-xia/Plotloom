import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WeixinState, WeixinStore } from '@plotloom/application/weixin';

/** 收件日志与游标原子提交；账号凭据仅保存于本机私有数据目录，不提供原始读取接口。 */
export class FileWeixinStore implements WeixinStore {
  private readonly directory: string;
  private readonly path: string;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(dataDir: string) { this.directory = join(dataDir, 'im'); this.path = join(this.directory, 'weixin.json'); }

  async read(): Promise<WeixinState> {
    await this.pending;
    return this.load();
  }
  private async load(): Promise<WeixinState> {
    try { return JSON.parse(await readFile(this.path, 'utf8')) as WeixinState; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { accounts: [], messages: [] };
      throw error;
    }
  }

  /** 串行事务在副本上执行，回调或写盘失败不发布半成品；返回值也不暴露可修改的内部引用。 */
  update<T>(change: (state: WeixinState) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      const state = await this.load(); const before = JSON.stringify(state);
      const result = change(state); const after = JSON.stringify(state);
      if (before !== after) {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const temporary = this.path + '.tmp';
        try {
          await writeFile(temporary, after, { encoding: 'utf8', mode: 0o600, flush: true });
          await rename(temporary, this.path);
        } finally { await rm(temporary, { force: true }); }
      }
      return structuredClone(result);
    });
    this.pending = operation.catch(() => {}); return operation;
  }
}
