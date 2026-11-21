# 浏览器工作区技术验证

这是独立的可运行实验，验证 **现有 Pi Agent 能否操作 Electron 右侧同一个可见浏览器会话**。不是完整产品框架交付，不替换现有 SplitPaneLayout，也不修改生产 Agent、路由或组件库。

## 运行

要求 Windows x64、Node.js 24+。仓库根目录先完成 `pnpm.cmd install`，随后在本目录运行：

```powershell
npm.cmd ci
npm.cmd run verify
```

确定性模式不调用真实模型：用仓库现有模型协议替身指定动作，实际 AgentService、Pi 工具循环、Electron、网页和 Cookie 全部真实运行。验证会显示交互窗口并自动重放用户操作，结束后关闭本次窗口与服务。

真实模型模式读取仓库根 `.env` 的 `PLOTLOOM_PROVIDER`、`PLOTLOOM_MODEL`、`PLOTLOOM_API_KEY` 及 `models.json`，会产生模型调用：

```powershell
npm.cmd run verify:real
```

每次生成独立 `output/browser-workspace/<时间戳>/`，包含 `report.json`、窗口截图、页面截图、临时浏览器 profile 与 Agent 历史。该目录已由仓库 `.gitignore` 排除。失败报告保留阶段与已通过断言，退出码为 1；真实模式不会在缺少配置时降级冒充成功。

## 验证链路

1. 启动只监听本机随机端口的合成站点，明确发送 `X-Frame-Options: DENY` 和 `frame-ancestors 'none'`。
2. Electron 用 WebContentsView 打开站点。可信壳、浏览器、预览使用分离的环境；外部页面无 Node 和 preload 操作桥。
3. 自动化重放用户表单输入，经服务器建立 HttpOnly Cookie。这里没有真人登录或真实网站账号。
4. Node 通过 CDP 精确匹配 Electron 返回的 targetId，给现有 AgentService 注册 `workspace_browser` 工具。
5. 工具支持观察可访问性树、按 role/name 或 CSS 定位、输入、点击、滚动、截图和导航。真实模型任务只给界面名称，不给 CSS 选择器或调用顺序脚本。
6. 切换 Markdown、图片预览时不销毁浏览器；回到浏览器核验相同实例、输入、滚动和登录。
7. 检验找不到元素、用户接管中止以及后续动作未执行，最后重启 Electron 验证 Cookie 持久化。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `main.cjs` | Electron 原生视图、会话、布局及私有实验命令 |
| `preload.cjs` / `shell.*` | 可信验证壳，只暴露明确的导航/切换/接管操作 |
| `fixture.mjs` / `sample.md` | 本地合成登录、工作页、固定只读预览素材 |
| `browser-tool.mjs` | Playwright Page 到现有 Pi 工具定义的适配 |
| `verify.mjs` | 启动、target 核验、确定性/真实模型任务、结果和清理 |
| `capture-window.ps1` | Windows 按精确 HWND 捕获实验窗口，包含原生子视图；UTF-8 BOM |

依赖固定为 Electron 45.4.1（MIT）、Playwright Core 1.65.1（Apache-2.0）、Marked 18.2.1（MIT）、TypeBox 1.3.27。Marked 仅用于固定测试文档，正式产品继续复用已有 MarkdownRenderer，不引入第二套产品渲染器。

## 已验证的集成限制

- Electron partition 不能直接按 Playwright 默认 BrowserContext 理解：本实验默认 context 的 cookies 查询看不到目标分区 Cookie，使用目标页 CDP `Network.getCookies` 验证真实会话。
- 本次版本组合下，后创建 renderer 的独立 Electron 分区没有出现在已连接的 Playwright 页面列表中。实验在 CDP 接入前初始化预览 target；正式多标签方案需单独验证动态 target 管理。
- BrowserWindow.capturePage 仅捕获壳，无法证明原生子视图可见。本实验使用 Windows PrintWindow 捕获指定窗口，并启用 DPI 感知避免150%缩放时截图裁切。Electron 交互进程需可见启动；隐藏启动标记下窗口级捕获曾返回黑图。
- 接管会停止 Pi 继续派发工具，并等待当前动作结束。等待测试可立即取消；正在执行的短点击/输入有1.5秒超时，导航最长10秒；不宣称可撤销已经生效的网页操作。
- 仅测试本地合成账号和网页，不能据此承诺任意站点登录、验证码、支付、下载、弹出窗口及 OAuth 流程。实验拒绝新窗口和设备权限请求；未实现完整多标签浏览器。
- CDP 端口是本机临时实验端口，没有作为产品 API 暴露。正式集成必须设计宿主控制桥、任务与浏览器会话绑定及公开契约；届时同步接口目录和独立接口测试。

结论与证据见 `../../docs/browser-workspace-spike-validation.md`。
