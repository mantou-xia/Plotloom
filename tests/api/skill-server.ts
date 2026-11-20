import { readFile } from 'node:fs/promises';
import { buildServer } from '../../apps/server/src/bootstrap.ts';

/** 独立测试进程只替换系统对话框；选择后的导入、HTTP 校验、落盘及模型均走正式装配。 */
const app = await buildServer({
  dataDir: process.env.PLOTLOOM_DATA_DIR!, modelsPath: process.env.PLOTLOOM_MODELS_PATH,
  defaultModel: { provider: process.env.PLOTLOOM_PROVIDER!, model: process.env.PLOTLOOM_MODEL! },
  apiKey: process.env.PLOTLOOM_API_KEY,
}, { folderPicker: {
  select: async () => ({ path: JSON.parse(await readFile(process.env.TEST_SKILL_SELECTION!, 'utf8')) }),
  close() {},
} });
const address = await app.listen({ host: '127.0.0.1', port: 0 });
process.on('message', message => { if (message === 'shutdown') void app.close().then(() => process.disconnect?.()); });
process.send?.({ address });
