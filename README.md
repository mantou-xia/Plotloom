# Plotloom

通用 Agent 核心加小说垂直业务的本地创作工作台：以 Markdown 管理正文、人物和大纲，基于 Pi SDK 与写作 skill 辅助创作。

## 已确认方向

- 应用和数据在本机，允许调用云端模型 API。
- 先完成核心后端闭环及验收，再集中开发 Web 前端；记忆、向量检索和高级反馈等额外后端能力后置。Electron 后续交付。
- 前端作为独立重点阶段，单独验收编辑体验、交互反馈、候选对比和连续创作流程。
- 优先文件，允许 SQLite；无需独立数据库服务。
- 直接接入 Pi coding-agent SDK，复用对话、工具循环、会话保存、压缩、停止和重试。
- 自研 Web 接入和小说业务；当前不做工作流引擎、独立 Worker、队列或自动步骤恢复。

恢复指打开已保存会话和候选后由用户继续；未完成请求可以重新发起。

## 当前状态

2026-11-24 新增微信 IM 通用通道。本人可以扫码绑定已有 Agent 会话，在微信中对话、回答提问、处理审批和停止生成。平台可主动发送文字通知，7 个公开接口已登记到试验台。真人扫码和微信对话链路已验证，主动通知的手机送达待验证。详见 [微信 IM 使用说明](docs/api/weixin-im.md) 与 [验收记录](docs/weixin-im-validation.md)。

截至 2026-11-18，P0、P1、P1.1、P2/P2.1 和 P3 核心后端已完成。通用 Agent 提供会话、模型/思考配置、HTTP / SSE、思考文本、名称、上下文压缩与取消、统计及工具查询；确定性接口测试及真实模型 HTTP 验收通过。真实 `krill-ai-codex / gpt-5.6-sol` 在 P1.1 的 low 档请求中未返回可见思考文本，接入和展示已通过协议替身验证，详见 [P1.1 验证记录](docs/p1.1-validation.md)。P2 提供真实 Markdown 读写、候选逐处采纳、版本恢复、原文搜索、导出和资产备份，详见 [P2 验证记录](docs/p2-validation.md)。P2.1 已提供技能管理、完整目录导入、工作区默认/聊天覆盖、受限加载及小说聊天归属，详见 [P2.1 验证记录](docs/p2.1-validation.md)。P3 已实现大纲原文留档、正式资料上下文、章节/续写/选区/大纲候选与证据审校；58 项自动化检查及试验台通过，10 组真实模型对照完成，见 [P3 验收](docs/p3-validation.md) 与 [接口](docs/api/p3-writing.md)。产品前端集中在 P7。

P7 已开始：`apps/web` 提供 TypeScript + React + Vite 产品前端，`packages/ui` 维护通用组件；全局左右布局、纵向内容布局和主题色设置已接入。创作页面及业务接口接入尚未实现。

运行入口见下方；[P0 SDK 实验](experiments/pi-sdk/README.md) 保持独立。确定性本地测试与真实模型验证分别执行和记录；协议通过与小说文本质量分别记录。

顺序：P0 SDK 验证 → P1 通用 Agent 后端与接口 → P2 Markdown 资产与逐处采纳 → P2.1 技能管理与聊天归属 → P3 写作接入和核心整体验收 → P7 前端 → P8 试用；P4—P6 额外后端能力在前端之后补充。Electron 后续交付。

P1—P6 每阶段通过公开接口测试，提供契约、请求示例和测试记录；P3 核心整体接口验收通过后进入 P7。接口设计提前考虑用户操作和所需数据，产品前端代码集中在 P7 实现。

## 启动本机后端

要求 Node.js ≥ 24、pnpm 11.22.0。在仓库根目录执行：

```text
pnpm.cmd install --frozen-lockfile
pnpm.cmd typecheck
pnpm.cmd test
```

将 `.env.example` 复制为 `.env`，填写 `PLOTLOOM_API_KEY`，再执行 `pnpm.cmd start`。后端默认地址为 `http://127.0.0.1:4317`；产品前端独立启动，见下方。无密钥也能启动、查询配置及已有历史，生成返回明确配置错误。

P2 资产接口不需要模型凭据。先在本机建立小说目录，再通过工作区接口登记；正式资料为 UTF-8 `.md`，可用外部编辑器打开。文件提交当前只启用已验证的 Windows 实现。调用流程、版本冲突与备份恢复见 [P2 接口](docs/api/p2-workspaces.md)。

技能管理同样无需模型凭据；可创建自定义 SKILL.md、导入完整目录并按小说或聊天启用。内置写作技能在小说聊天自动加载，普通聊天因缺少小说工具不可运行该技能。调用和依赖边界见 [P2.1 接口](docs/api/p2.1-skills.md)。

`models.json` 保存非敏感供应商和模型参数，`.env` 保存本机凭据。默认数据目录 `.plotloom-data` 已排除提交；同一数据目录同时运行一个服务。注册工具通过后端 `AgentOptions.tools` 传入。

普通聊天、项目聊天、联网操作和引用规则的静态提示统一在 [系统提示词](packages/agent-pi/src/prompts/system-prompt.ts) 维护。该文件按基础提示、浏览器规则、引用规则、本轮技能的顺序拼接。小说上下文由 [创作模块](packages/application/src/writing.ts) 生成，技能提示由 [技能模块](packages/agent-pi/src/skills.ts) 生成。`PLOTLOOM_SYSTEM_PROMPT_FILE` 在后端启动时读取，用于替换普通聊天的基础提示，或作为小说提示的前缀。项目聊天使用固定的项目提示。

确定性测试自行启动本机模型协议替身及服务子进程，不访问云端、不需要密钥。真实 HTTP 验收执行 `pnpm.cmd verify:real`，会调用配置的真实模型，结果保存到 `.plotloom-data/verify-*/report.json`。

P3 真实对照执行 `node --env-file-if-exists=.env scripts/evaluate-writing.ts`，在 `output/p3-real-*` 新建隔离的合成小说，保留 10 个样本的普通聊天/创作产物、耗时和用量，不读取作者作品。

请求格式、SSE 说明与恢复口径见 [P1 接口](docs/api/p1-agent.md)，逐步请求见 [HTTP 示例](docs/api/p1-requests.http)。

## 产品前端骨架

在仓库根目录执行 `pnpm.cmd web`，打开 `http://127.0.0.1:4319`，点击左侧「设置」修改主题色。默认展示六个预设圆点和圆形添加按钮；点击添加后打开纯色选择弹窗，支持可视化取色和 HEX/RGB 输入，选色即时应用并保存在当前浏览器。点击「湖蓝」回到默认色，刷新恢复所选主题。当前没有创作页面或业务接口调用，可独立于后端启动。

- 构建：`pnpm.cmd web:build`，包含前端类型检查，产物位于 `apps/web/dist`。
- 预览：构建后执行 `pnpm.cmd web:preview`，与开发服务使用同一端口，需先停止开发服务。
- 全仓类型检查：`pnpm.cmd typecheck`，覆盖现有后端、试验台、新前端及组件库。
- 主题检查：`pnpm.cmd test:ui`，覆盖 HEX 校验及多种颜色下的文字对比度；浏览器验收见 [主题设置验证](docs/p7-theme-validation.md)。
- 目录职责：`apps/web/src/app` 装配应用；`apps/web/src/features` 按业务组织页面组合、状态与接口调用；`packages/ui` 维护通用布局、控件及实际复用组件；页面专有内容和样式在应用内就近维护。
- 一级页面布局提供可配置内边距与纵向间距，具体业务页面由应用组合；维护约束见 [第七条铁律](AGENTS.md)、[Feature 约定](apps/web/src/features/README.md) 和 [组件库说明](packages/ui/README.md)。

## 组件库调试台

执行 `pnpm.cmd ui`，打开 `http://127.0.0.1:4320`。独立展示当前 6 个通用组件、19 个示例状态。画布尺寸与组件宽高分别控制；组件支持自动、固定像素、填满，并按能力提供按钮文字/变体/禁用、布局内边距/间距/侧栏宽度、色点直径等参数。可直接检查点击、悬停、按下和键盘焦点。

预览使用真实 iframe 视口，媒体查询会随尺寸变化生效。配色只影响调试台；不需要后端，不修改产品主题偏好。构建执行 `pnpm.cmd ui:build`，预览执行 `pnpm.cmd ui:preview`。新增组件需同步登记及验证，详见 [组件调试台说明与验收](docs/ui-demo.md)。

## 接口测试 Demo

已提供独立接口试验台，按内容创作、技能库、技能启用、小说聊天、小说工作区、Markdown 资料、候选与逐处采纳、模型配置、会话管理、消息与生成、上下文与用量十一个模块展示全部 52 个接口。页面包含用途、参数示例、字段含义、错误与 SSE 说明，可编辑参数并检查结果。创建技能、工作区、候选或小说聊天后自动带入对应 ID；模型、思考、流式正文及压缩取消仍可调试。完整产品前端在 P7 实施。

后端启动后，在另一个终端运行 `pnpm.cmd demo`，打开 `http://127.0.0.1:4318`。建议依次检查模型、创建会话、发送消息、查询结果；创建成功会自动填入会话 ID。

页面通过本机代理调用公开接口，模型密钥留在后端。构建执行 `pnpm.cmd demo:build`，构建预览执行 `pnpm.cmd demo:preview`（同样需要后端，且与开发服务使用同一端口）。更多说明见 [Demo 使用与验证](docs/api/demo.md)。

## 项目文档

| 文档 | 内容 |
| --- | --- |
| [可视化架构](docs/plotloom-agent-architecture.html) | 历史规划快照；阶段依赖以当前架构及路线图为准 |
| [架构方案](docs/architecture.md) | 本地架构、Pi 复用、小说上下文与业务模型 |
| [项目目录结构](docs/project-structure.md) | P1—P3 后端、P7 前端骨架与后续按需模块 |
| [开发路线图](docs/roadmap.md) | 各阶段任务和验收口径 |
| [P0 验证记录](docs/p0-validation.md) | 本地与真实模型实测结果、验收边界 |
| [P1 接口](docs/api/p1-agent.md) | 已实现的 HTTP / SSE 契约、配置和请求示例 |
| [P1 验证记录](docs/p1-validation.md) | 确定性接口测试、真实模型验收及六条规则核对 |
| [P1.1 验证记录](docs/p1.1-validation.md) | 配置、思考文本、命名、压缩、用量和工具查询验收 |
| [P2 接口](docs/api/p2-workspaces.md) | Markdown 工作区、版本、逐处候选、导出与恢复说明 |
| [P2 验证记录](docs/p2-validation.md) | 40 项回归、17 个接口试验台实测和 Windows 提交验证 |
| [P2.1 接口](docs/api/p2.1-skills.md) | 技能库、启用/加载、目录导入和小说聊天协议 |
| [P2.1 验证记录](docs/p2.1-validation.md) | 48 项回归、15 个新增接口及技能加载/停止实测 |
| [P3 接口](docs/api/p3-writing.md) | 大纲留档、创作上下文、审校、候选与联调样本 |
| [P3 验证记录](docs/p3-validation.md) | 核心链路、真实模型对照与边界 |
| [P7 骨架验证](docs/p7-skeleton-validation.md) | 前端与组件库初始化、布局结构和七条规则核对 |
| [接口测试 Demo](docs/api/demo.md) | 页面启动、操作、接口登记与验收记录 |

当前 Markdown 方案见 [业务场景](docs/plans/p2-novel-assets.md) 和 [P2 实施计划](docs/plans/p2-implementation.md)。历史可视化尚未同步，不能作为当前实施依据。目录随实际功能创建，不预建空模块。
