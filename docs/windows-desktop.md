# Windows 桌面版

## 安装与首次启动

安装包面向 Windows x64，默认安装到当前用户的 `%LOCALAPPDATA%\Programs\Plotloom`，并添加开始菜单入口。应用自带 Electron、Node 运行时和与 Playwright 匹配的 Chromium。首次使用聊天或 AI 写作时，在「设置 → 模型服务」填入自己的模型服务地址和 API Key，再选择默认模型。

应用数据默认放在 `%APPDATA%\Plotloom`。小说文稿仍保存在用户选择的目录。源码开发版的 `.plotloom-data` 与桌面版数据独立。关闭应用后再备份用户数据和小说目录。

选目录、Windows 正文写入及回收仍使用 Windows 自带组件。若企业策略禁用 Windows PowerShell，相关操作会失败。当前安装器尚未配置发布者签名。

## 构建

在 Windows x64 构建机准备 Node.js 24、项目锁定的 pnpm 和 Inno Setup 6。编译器不在默认位置时，用 `PLOTLOOM_ISCC` 指定 `ISCC.exe` 的绝对路径。

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd desktop:win
```

首次构建会准备锁定的 Electron 与 Playwright 浏览器文件。安装器写入 `output/desktop-installers`。应用使用 Electron 子进程启动已经编译的 Fastify 服务，桌面页面通过固定的 `plotloom://app/` 来源访问相对的 `/api/`。业务接口与 Web 版共用。

构建时只纳入生产后端、正式 Web 构建及运行所需资源。PowerShell、内置技能和浏览器都按实际文件路径分发。

## 0.1.0 验收

在本机 Windows 将安装包安装并复装到隔离目录，用仅保留系统路径的环境启动。通过真实窗口验证内置技能、剪贴板、模型协议替身驱动的 SSE 聊天、随包浏览器、项目文件读取、图片附件、中文路径正文保存、候选采纳、TXT 导出接口和重启持久化。独立回环请求因缺少桌面授权被拒绝。源码回归通过 122 项 API 测试和 53 项 UI、试验台测试。未在干净虚拟机或锁定 PowerShell 的企业环境验收。
