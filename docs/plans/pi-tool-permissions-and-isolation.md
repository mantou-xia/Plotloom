# Pi 工具权限、审批与隔离调研

调研日期：2026-11-20。Plotloom 基线为 `46b0c69`，锁定 `@earendil-works/pi-coding-agent@1.5.2`。依据是仓库实际调用链、本机安装包的导出与实现、同版本 Pi 上游文档。方案处于调研阶段，尚未进行 Windows 隔离原型验收。

## 当前行为

| 入口 | 现状与边界 |
| --- | --- |
| 项目聊天 | `AgentService.open()` 把登记项目作为 Pi 的 `cwd`，直接启用该平台的项目工具集合。在 Windows 含 `powershell`，另有 `read`、`ls`、`find`、`grep`、`edit`、`write`。项目根目录校验用于识别项目，具体工具仍以宿主进程权限运行。 |
| SDK 扩展和授权 | `createResources()` 返回空扩展列表，继续隔离 Pi 的自动资源发现。Web 输入框关闭了权限选项，目前没有待审批投影、公开审批接口或服务端逐次授权。 |
| 网络和资料 | `browser` 使用按聊天隔离的持久浏览器资料目录；页面导航、填写等能力仍需单独授权。宿主 `web_fetch` 有协议、超时和正文大小限制，尚未见统一网络访问策略。两者都不会自动继承项目工具执行器的隔离。 |
| 小说正式资产 | 写作走专用资料上下文和候选采纳，通过版本与来源校验控制提交。通用项目权限应独立接入，小说正式稿仍走原有业务规则。 |

仓库证据：[工具装配](../../packages/agent-pi/src/index.ts)、[显式资源加载器](../../packages/agent-pi/src/resources.ts)、[项目工具](../../packages/agent-pi/src/project.ts)、[工具目录](../../apps/server/src/tool-directory.ts)、[后端路由](../../apps/server/src/routes/agent.ts)、[浏览器](../../packages/agent-pi/src/browser.ts)、[网页抓取](../../packages/agent-pi/src/web-fetch.ts)和[写作验收](../p3-validation.md)。

## Pi 1.5.2 可复用的能力

| 能力 | 结论 |
| --- | --- |
| 工具清单 | `createAgentSession({ tools, excludeTools, customTools })` 可限制注册给模型使用的工具，也可装配替代实现。只给模型提供当前策略允许的工具，仍需在真正执行时做授权和隔离校验。 |
| 执行前与结果事件 | `pi.on("tool_call", async …)` 位于实际工具执行前，允许等待决定并阻止操作；`tool_result` 可用于记录结果。Pi 的 `tool_execution_start` 早于审批钩子，产品不能仅凭它就展示“已执行”。同批工具可以并发执行，策略应绑定单次调用。 |
| 宿主集成 | SDK 通过受控 `ResourceLoader` 装配自有扩展，官方提供 `DefaultResourceLoader.extensionFactories` 入口。先用隔离夹具验证扩展注入和资源发现禁用，避免顺带启用项目或用户扩展。CLI 的 `ctx.ui` / RPC 示例说明交互模式，Web 仍由 Plotloom 管理审批，继续使用现有 HTTP/SSE。 |
| 替换执行后端 | Pi 工具工厂提供文件及终端 `operations`；同名工具可覆写。1.5.2 的 `GrepOperations` 只接管目录检查，搜索仍调用本地 `rg`，隔离版应接管完整搜索执行。终端 spawn hook 可调整环境与工作目录，本身不限制宿主访问。 |
| 隔离参考 | Pi 给出进程整体隔离以及只把工具委派到隔离环境的方案。Gondolin 示例属于工具委派，示例采用 Linux 客体，项目挂载可写回，环境变量传递也需要另行限制。宿主自定义的浏览器、抓取与扩展工具需要各自纳入边界。 |

版本依据：[Pi SDK v1.5.2](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/sdk.md)、[扩展与工具接口 v1.5.2](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/extensions.md)、[官方隔离指南 v1.5.2](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/docs/containerization.md)、[Gondolin 示例 v1.5.2](https://github.com/earendil-works/pi/blob/v1.5.2/packages/coding-agent/examples/extensions/gondolin/index.ts)。本机同时核对 `dist/core/sdk.d.ts`、`dist/core/agent-session.js` 和随包发布的 `examples/extensions/permission-gate.ts`。

本机探针使用协议替身、临时项目和只读计数工具。`noExtensions: true` 下仅装载显式内联扩展，临时项目内的扩展未加载。两次调用在等待审批时执行计数均为 0，拒绝后仍为 0，批准后为 1。结果只覆盖 SDK 等待与拦截行为，停止、超时、重复决定、公开接口及操作系统隔离仍需验收。

## 推荐实施顺序

1. **先确定每类工具的默认策略。** 建议自动放行经验证限于已选项目、且符合敏感文件规则的结构化只读操作。项目内创建、覆盖、修改逐次批准。任意终端及有副作用的浏览器操作在隔离和授权链路验收前保持禁用。外部页面、附件和导入技能作为不可信资料，不能审批或改变策略。实施前确认现有「直接执行」是否仍有使用方、是否保留及迁移范围。
2. **验证 Pi 钩子，再实现后端审批。** 使用无副作用的可计数工具和协议替身，确认待批时执行次数为零，放行后仅执行一次，拒绝、停止或超时不执行。审批绑定会话、轮次、工具调用、规范化参数、目标与必要的文件版本，执行前再次检查。通过现有会话快照和 SSE 展示结果，新增独立决定接口；普通审批等待可随页面刷新恢复，进程重启后未决批准失效。保留可查询的简要审计记录，敏感参数脱敏。相同请求只能消费一次批准，结果未知的外部提交要求用户核对。
3. **先交付受限的文件操作。** 接入受控文件执行层，统一处理真实项目根、符号链接和 Windows 联接、未创建文件的父目录，以及检查到使用期间的变化。覆盖全部读、列举、搜索、写入入口，尤其是完整搜索执行。创建或覆盖提供范围和变更预览；正式小说继续使用已有候选与版本链路。
4. **再验证 Windows 终端与网络隔离。** 推荐保持 Plotloom、Pi 会话与模型凭据在宿主，由受限执行器运行批准后的终端操作。先评估 AppContainer 对 PowerShell 及所需子进程的兼容性，必要时单独评估 Windows Sandbox 的安装要求、启动成本和目录映射。限制文件、网络、环境和进程树；采用环境白名单，隔离模型 Key、会话目录和宿主配置。给浏览器与抓取工具独立的目标权限和数据出口规则。执行器不可用时保持相关工具禁用，不降级到宿主直接执行。
5. **接入产品与试验台。** Web 展示具体工具、目标、变更摘要、允许一次与拒绝，页面只消费公开状态。试验台实际跑允许、拒绝、停止、超时、旧请求与重复决定等路径；独立接口测试覆盖跨会话拒绝、参数或目标变更、进程重启、已执行操作的重试。隔离验收在合成工作区验证可访问的文件范围、凭据不可读、网络出口正确、停止时子进程清理，并记录平台依赖与边界。

Windows 依据：[Microsoft AppContainer 隔离](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)、[Windows Sandbox 配置](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)、[Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)。Job Object 可辅助管理进程树和资源上限，文件、网络及凭据权限由实际隔离机制承担。
