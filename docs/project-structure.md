# Plotloom 项目目录结构

更新日期：2026-11-17。本文与 [架构方案](architecture.md)、[开发路线图](roadmap.md) 使用同一套简化范围。目录是规划，尚未初始化应用。

## 1. 组织原则

- P0—P6 先实现本机后端并通过接口测试，P7 集中实现 Web，P8 完整产品试用；后续增加 Electron 外壳。
- P1 只做 SDK 后端接入与统一接口：不创建 Worker、工作流运行时、任务仓储或队列适配。
- Pi SDK 集中在 agent-pi，前端使用项目通信协议。
- 小说用例、领域、上下文和存储在对应阶段出现；包内先按功能组织，不先铺完整框架。
- 目录有实际文件和调用方才创建，pnpm workspace 按需纳入包。

## 2. 当前文档

- README.md：项目入口。
- docs/architecture.md：架构与能力归属。
- docs/project-structure.md：本文件。
- docs/roadmap.md：阶段任务与验收。
- docs/plotloom-agent-architecture.html：完整可视化说明。
- docs/plotloom-agent-architecture.diagram.json / .html：架构图源与独立交互图。
- 同名前缀的 validation / visual-check 文件：图与页面校验记录、截图。

当前不存在 .cursor/rules，本轮无可用 .mdc 规则；未找到 space/README.md、space/guanwenbo/plan、space/guanwenbo/memory。后续加入时重新读取。

## 3. P1 最小后端结构

```text
Plotloom/
├─ apps/
│  └─ server/src/
│     ├─ bootstrap.ts            # 本机服务装配，创建和管理 SDK 会话实例
│     ├─ routes/                 # 会话、消息、停止、配置接口
│     └─ streaming/              # SDK 事件转发、当前消息快照
├─ packages/
│  ├─ agent-pi/src/              # SDK 薄适配、提示词配置、测试工具
│  └─ contracts/src/             # 公开接口的请求、响应、消息、事件与错误结构
├─ tests/api/                    # HTTP / SSE 接口测试，独立于前端执行
├─ experiments/                  # P0 小验证，按需创建
├─ scripts/                      # 本地启动等实际需要的脚本
├─ docs/api/                     # 接口契约、请求示例、测试运行说明
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
└─ tsconfig.base.json
```

SDK 适配只封装当前需要的创建/打开会话、发消息、订阅、停止与配置。工具注册、参数格式校验、压缩、重试、会话落盘直接调用 SDK，不实现通用 AgentExecutor 框架或空仓储接口。

P1 不创建 apps/web；接口测试客户端先验证请求、流式响应、停止和重新查询。前端在 P7 使用同一套接口。

会话文件存放在配置指定的本机数据目录，不提交到 Git。浏览器断线重新读取会话消息与当前状态，不建立持久化 token 事件回放表。

## 4. 后续按业务增加

| 阶段 | 位置 | 具体职责 |
| --- | --- | --- |
| P2 | packages/domain、application、storage；server/routes | 小说资产、版本、文件 / SQLite 仓储与接口 |
| P3 | application/tools、application/writing、packages/context | 小说工具、上下文选材、创作与提案接口 |
| P4—P5 | context/visibility、retrieval、provenance；storage/search | 时间、知情、来源及检索接口 |
| P6 | application/writing/prompts、domain/style、evals | 风格和反馈接口、效果评测 |
| P1—P6 | packages/contracts、tests/api、docs/api | 接口契约、连续接口测试与接入资料 |
| P7 | apps/web；features/library、manuscript、assistant、proposals、story-bible、style | 集中设计和实现完整前端，接入已验收接口 |
| P7 | tests/e2e | 关键用户操作、真实接口联调与浏览器验证 |
| P8 | scripts、tests/integration、tests/e2e | 启动说明、备份恢复和受控试用 |
| 桌面交付 | apps/desktop | Electron 窗口、本地核心启动和打包 |

前端布局、视觉、编辑和生成反馈在 P7 统一实现并单独验收。后端阶段先明确这些交互所需的数据和状态，避免仅有 SDK 方法透传却无法支持实际操作。

application/writing 是小说业务代码，不是通用工作流执行器。没有独立 workflows/runtime 包，也不预建 runs、run_steps、run_events 表。

SQLite 与文件如何划分在 P2 按保存需求决定；只有实际使用 SQLite 才创建迁移目录。普通文件、会话和业务数据库分别明确归属，不复制两份权威历史。

## 5. 依赖与调用

| 模块 | 约束 |
| --- | --- |
| web（P7） | 只访问公共接口，不访问 Pi、SQLite 或本机文件 |
| contracts | 声明页面实际用到的协议，不导出 Pi 内部类型 |
| agent-pi | 封装 Pi SDK；接收工具与提示词，不导入小说模块 |
| domain（P2） | 纯小说规则，不依赖 Pi、HTTP 或数据库实现 |
| application（P2） | 编排保存、采纳等业务动作；需要时声明存储和执行接口 |
| context（P3） | 接收资料读取能力，处理选材；不反向调用业务写入用例 |
| storage（P2） | 实现业务保存与查询，不驱动 Agent |
| server | 装配 SDK 适配与后续业务模块，提供本机接口 |
| desktop（后续） | 管理窗口与本地核心，不复制业务实现 |

接口只在实际调用需要时引入；不为可能替换的框架预设完整抽象体系。

P1 验证调用：接口测试客户端 → 本机 server → agent-pi → Pi SDK → 模型；SDK 保存会话，服务输出公开事件。P7 再由 Web 接入本机 server。

P3 后端接口用例（P7 再接为页面操作）：
1. 测试客户端通过接口提交目标小说、选区、正文版本与要求。
2. 本机用例读取所选设定和样文，组织上下文并调用 Pi。
3. Pi 通过注册工具读取资料或创建候选提案。
4. 接口返回候选和来源；本轮生成结束，测试客户端查询保存结果。
5. 测试客户端调用采纳/拒绝接口，验证版本检查、新正文保存和拒绝不改正文。

重启后打开会话及已保存候选，由用户继续操作；不引入自动步骤恢复链路。
