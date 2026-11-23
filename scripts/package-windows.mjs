import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktop = join(root, 'apps', 'desktop');
const output = join(root, 'output');
const rceditName = 'plotloom-rcedit-v2.0.0-x64.exe';
const rceditHash = '3e7801db1a5edbec91b49a24a094aad776cb4515488ea5a4ca2289c400eade2a';
const toolProject = join(root, 'experiments', 'browser-workspace');
const electronDir = join(toolProject, 'node_modules', 'electron', 'dist');
const compiler = process.env.PLOTLOOM_ISCC ?? join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe');
const manifest = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
const pnpm = process.env.npm_execpath;
if (process.platform !== 'win32' || process.arch !== 'x64' || !pnpm) {
  throw new Error('请在 Windows x64 上使用 pnpm desktop:win 构建。');
}
await access(compiler);

function run(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: root, stdio: 'inherit', windowsHide: true, ...options });
  if (result.status !== 0) throw result.error ?? new Error(`${file} 退出码 ${result.status}`);
}

/** Windows 从 EXE 资源读取文件和快捷方式图标。仅修改构建副本，工具不随应用分发。 */
async function setApplicationIcon(executable) {
  const tool = join(output, rceditName);
  let bytes = await readFile(tool).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (!bytes) {
    const response = await fetch('https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe',
      { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`下载 Windows 图标构建工具失败（HTTP ${response.status}）。`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== rceditHash) {
    throw new Error('Windows 图标构建工具的 SHA-256 与锁定版本不符。');
  }
  await writeFile(tool, bytes, { flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
  });
  run(tool, [executable, '--set-icon', join(desktop, 'plotloom.ico')]);
}

/** 沿用已锁定并验证过的 Electron 运行时，安装器只携带运行时文件。 */
async function prepareElectron() {
  const expected = JSON.parse(await readFile(join(toolProject, 'package.json'), 'utf8')).dependencies.electron;
  const actual = await readFile(join(electronDir, 'version'), 'utf8').catch(() => '');
  if (!actual || actual.trim().replace(/^v/, '') !== expected) {
    run('npm.cmd', ['ci'], { cwd: toolProject, shell: true });
    run(process.execPath, [join(toolProject, 'node_modules', 'electron', 'install.js')], { cwd: toolProject });
  }
  if ((await readFile(join(electronDir, 'version'), 'utf8')).trim().replace(/^v/, '') !== expected) {
    throw new Error('Electron 运行时版本与锁定版本不符。');
  }
}

/** 只改部署副本里的包入口，保留源码开发时的 TypeScript 导出和打包后的资源相对路径。 */
async function prepareServer(server, compiled) {
  run(process.execPath, [pnpm, '--filter', '@plotloom/server', '--prod', 'deploy',
    '--config.inject-workspace-packages=true', '--config.node-linker=hoisted', relative(root, server)]);
  await cp(join(compiled, 'apps', 'server', 'src'), join(server, 'src'), { recursive: true });
  const packages = join(server, 'node_modules', '@plotloom');
  for (const name of await readdir(packages)) {
    const directory = join(packages, name);
    await cp(join(compiled, 'packages', name, 'src'), join(directory, 'src'), { recursive: true });
    const path = join(directory, 'package.json');
    const pkg = JSON.parse(await readFile(path, 'utf8'));
    const toJs = value => value.replace(/\.ts$/, '.js');
    pkg.exports = typeof pkg.exports === 'string' ? toJs(pkg.exports)
      : Object.fromEntries(Object.entries(pkg.exports).map(([key, value]) => [key, toJs(value)]));
    // pnpm 可以用硬链接复制工作区文件。原子替换部署清单，避免改动源码或内容存储。
    const replacement = join(directory, 'package.desktop.json');
    await writeFile(replacement, JSON.stringify(pkg), { flag: 'wx' });
    await rename(replacement, path);
  }
  for (const required of [
    'src/platform/select-folder.ps1',
    'node_modules/@plotloom/storage/src/commit-markdown.ps1',
    'node_modules/@plotloom/storage/builtin/novel-writing/SKILL.md',
    'node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm',
  ]) await access(join(server, required));
}

/** 构建目录每次独立，避免升级包把上一次遗留的文件重新带入。 */
async function makeInstaller() {
  await mkdir(output, { recursive: true });
  const build = await mkdtemp(join(output, 'desktop-win-'));
  const compiled = join(build, 'compiled');
  const stage = join(build, 'app');
  await prepareElectron();
  run(process.execPath, [pnpm, '--config.verify-deps-before-run=false', 'web:build']);
  run(process.execPath, [pnpm, '--config.verify-deps-before-run=false', 'exec', 'tsc', '-p', 'tsconfig.desktop.json', '--outDir', compiled]);
  await cp(electronDir, stage, { recursive: true, filter: path => !path.endsWith('default_app.asar') });
  await rename(join(stage, 'electron.exe'), join(stage, 'Plotloom.exe'));
  await setApplicationIcon(join(stage, 'Plotloom.exe'));
  const resources = join(stage, 'resources');
  const main = join(resources, 'app');
  await mkdir(main, { recursive: true });
  for (const file of ['package.json', 'main.cjs', 'preload.cjs', 'storage-location.cjs', 'plotloom.ico']) await cp(join(desktop, file), join(main, file));
  await cp(join(root, 'apps', 'web', 'dist'), join(resources, 'web'), { recursive: true });
  await prepareServer(join(resources, 'server'), compiled);
  const require = createRequire(join(root, 'packages', 'agent-pi', 'package.json'));
  const playwright = require('playwright-core');
  const executable = playwright.chromium.executablePath();
  if (!await access(executable).then(() => true, () => false)) {
    const cli = join(require.resolve('playwright-core/package.json'), '..', 'cli.js');
    run(process.execPath, [cli, 'install', 'chromium', '--no-shell']);
  }
  await cp(join(executable, '..'), join(resources, 'browser'), { recursive: true });
  await access(join(resources, 'browser', 'chrome.exe'));
  const installerOutput = join(output, 'desktop-installers');
  await mkdir(installerOutput, { recursive: true });
  run(compiler, [`/DAppVersion=${manifest.version}`, `/DStagePath=${stage}`, `/DOutputPath=${installerOutput}`,
    '/Qp', join(desktop, 'installer.iss')]);
  console.log(join(installerOutput, `Plotloom-${manifest.version}-Windows-x64-Setup.exe`));
}

await makeInstaller();
