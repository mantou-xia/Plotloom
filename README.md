# Plotloom

本地小说创作 AI 工作台，统一管理正文、人物、世界观和剧情，基于 Pi SDK 辅助创作。

## 已确认方向

- 应用和数据在本机，允许调用云端模型 API。
- 先完成 AI 与配套业务后端、统一接口及接口测试，再集中开发并接入 Web 前端；Electron 后续交付。
- 前端作为独立重点阶段，单独验收编辑体验、交互反馈、候选对比和连续创作流程。
- 优先文件，允许 SQLite；无需独立数据库服务。
- 直接接入 Pi coding-agent SDK，复用对话、工具循环、会话保存、压缩、停止和重试。
- 自研 Web 接入和小说业务；当前不做工作流引擎、独立 Worker、队列或自动步骤恢复。

恢复指打开已保存会话和候选后由用户继续；未完成请求可以重新发起。

## 当前状态

截至 2026-11-17，P0、P1 已完成。P1 提供本机会话、模型选择、消息 HTTP / SSE、停止和重启后继续；确定性接口测试及 `krill-ai-codex / gpt-5.6-sol` 真实模型 HTTP 验收通过。P2 尚未开始，前端集中在 P7。可视化保留架构规划阶段快照，当前进度以路线图及验证记录为准。

运行入口见下方；[P0 SDK 实验](experiments/pi-sdk/README.md) 保持独立。确定性本地测试与真实模型验证分别执行和记录；本次接入通过不代表小说创作质量已验收。

顺序：P0 SDK 验证 → P1 通用 Agent 后端与接口 → P2 小说资产后端 → P3 创作后端闭环 → P4—P5 记忆与检索后端 → P6 风格反馈及整体接口验收 → P7 前端体验设计、实现与接入 → P8 本地受控试用。Electron 后续交付。

P1—P6 每阶段通过公开接口测试，提供契约、请求示例和测试记录；P6 整体接口验收通过后进入 P7。接口设计提前考虑用户操作和所需数据，产品前端代码集中在 P7 实现。

## 启动 P1 后端

要求 Node.js ≥ 24、pnpm 11.22.0。在仓库根目录执行：

```text
pnpm.cmd install --frozen-lockfile
pnpm.cmd typecheck
pnpm.cmd test
```

将 `.env.example` 复制为 `.env`，填写 `PLOTLOOM_API_KEY`，再执行 `pnpm.cmd start`。默认地址为 `http://127.0.0.1:4317`；当前没有产品页面。无密钥也能启动、查询配置及已有历史，生成返回明确配置错误。

`models.json` 保存非敏感供应商和模型参数，`.env` 保存本机凭据。默认数据目录 `.plotloom-data` 已排除提交；同一数据目录同时运行一个服务。修改提示词可设置 `PLOTLOOM_SYSTEM_PROMPT_FILE` 后重启，注册工具通过后端 `AgentOptions.tools` 传入，不改执行循环。

确定性测试自行启动本机模型协议替身及服务子进程，不访问云端、不需要密钥。真实 HTTP 验收执行 `pnpm.cmd verify:real`，会调用配置的真实模型，结果保存到 `.plotloom-data/verify-*/report.json`。

请求格式、SSE 说明与恢复口径见 [P1 接口](docs/api/p1-agent.md)，逐步请求见 [HTTP 示例](docs/api/p1-requests.http)。

## 接口测试 Demo

已提供独立接口试验台，按模型配置、会话管理、消息与生成三个模块展示当前全部 8 个接口。页面包含用途、参数示例、字段含义、错误与 SSE 说明，可编辑请求并查看真实响应和检查结果。完整产品前端仍在 P7 实施。

后端启动后，在另一个终端运行 `pnpm.cmd demo`，打开 `http://127.0.0.1:4318`。建议依次检查模型、创建会话、发送消息、查询结果；创建成功会自动填入会话 ID。

页面通过本机代理调用公开接口，模型密钥留在后端。构建执行 `pnpm.cmd demo:build`，构建预览执行 `pnpm.cmd demo:preview`（同样需要后端，且与开发服务使用同一端口）。更多说明见 [Demo 使用与验证](docs/api/demo.md)。

## 项目文档

| 文档 | 内容 |
| --- | --- |
| [可视化架构](docs/plotloom-agent-architecture.html) | 交互图、SDK 能力归属、接入工作和阶段范围 |
| [架构方案](docs/architecture.md) | 本地架构、Pi 复用、小说上下文与业务模型 |
| [项目目录结构](docs/project-structure.md) | 最小 P1 目录与后续按需模块 |
| [开发路线图](docs/roadmap.md) | 各阶段任务和验收口径 |
| [P0 验证记录](docs/p0-validation.md) | 本地与真实模型实测结果、验收边界 |
| [P1 接口](docs/api/p1-agent.md) | 已实现的 HTTP / SSE 契约、配置和请求示例 |
| [P1 验证记录](docs/p1-validation.md) | 确定性接口测试、真实模型验收及六条规则核对 |
| [接口测试 Demo](docs/api/demo.md) | 页面启动、操作、接口登记与验收记录 |

以上文档使用相同范围。目录随实际功能创建，不预建空模块。
