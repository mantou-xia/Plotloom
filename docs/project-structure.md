# Plotloom 项目目录结构

更新日期：2026-11-18。本文与 [架构方案](architecture.md)、[开发路线图](roadmap.md) 使用同一套简化范围。P0、P1/P1.1、P2/P2.1 和 P3 已实现；P7 已初始化前端及组件库骨架，尚未实现业务页面。P3 验收状态见专项记录，第 4 节为后续规划。

## 1. 组织原则

- P0—P3 先完成核心后端闭环与验收，P7 实现 Web，P8 试用；P4—P6 在前端之后补充；后续增加 Electron 外壳。
- P1 只做 SDK 后端接入与统一接口：不创建 Worker、工作流运行时、任务仓储或队列适配。
- Pi SDK 集中在 agent-pi，前端使用项目通信协议。
- 小说用例、领域、上下文和存储在对应阶段出现；包内先按功能组织，不先铺完整框架。
- 目录有实际文件和调用方才创建，pnpm workspace 按需纳入包。

## 2. 当前文档

- README.md：项目入口。
- docs/architecture.md：架构与能力归属。
- docs/project-structure.md：本文件。
- docs/roadmap.md：阶段任务与验收。
- docs/p0-validation.md：SDK 本地及真实模型实测记录。
- docs/p1-validation.md：P1 公开接口及真实模型验收记录。
- docs/p2-validation.md：Markdown 资产、候选、文件提交与试验台验收。
- docs/api/p2-workspaces.md：P2 的 17 个接口、调用链、冲突与备份恢复。
- docs/p2.1-validation.md：技能加载、小说聊天、48 项回归与试验台验收。
- docs/api/p2.1-skills.md：15 个新增接口、启用规则、资源与错误说明。
- docs/api/p3-writing.md：大纲留档、创作上下文、候选与联调样本。
- docs/p3-validation.md：独立接口、试验台与真实模型对照。
- docs/api/p1-agent.md：P1 已实现的最小接口契约。
- docs/api/p1-requests.http：模型、会话、流式和停止请求示例。
- experiments/pi-sdk：P0 独立实验、固定依赖、合成资料及验证命令。
- docs/plotloom-agent-architecture.html：历史可视化说明，不作为当前阶段依赖依据。
- docs/plotloom-agent-architecture.diagram.json / .html：架构图源与独立交互图。
- 同名前缀的 validation / visual-check 文件：图与页面校验记录、截图。

当前不存在 .cursor/rules，本轮无可用 .mdc 规则；未找到 space/README.md、space/guanwenbo/plan、space/guanwenbo/memory。后续加入时重新读取。

## 3. 当前后端与前端骨架

```text
Plotloom/
├─ apps/
│  ├─ api-demo/src/              # 公开接口试验台，不是产品编辑器
│  ├─ ui-demo/src/               # 独立组件调试台启动与 iframe 通信，4320 端口
│  ├─ web/src/
│  │  ├─ main.tsx               # React 挂载入口
│  │  ├─ app/                   # 应用装配与根样式
│  │  └─ features/settings/     # 主题偏好状态及浏览器保存
│  └─ server/src/
│     ├─ main.ts                 # 环境配置、本机监听与关闭
│     ├─ bootstrap.ts            # 服务装配、错误边界与关闭钩子
│     ├─ routes/                 # Agent、workspaces、skills、writing 接口
│     └─ streaming/              # 公开事件编码为 SSE，断流不停止
├─ packages/
│  ├─ ui/src/                   # 统一组件库：layouts、theme、button、color-picker、color-swatches、workbench
│  ├─ agent-pi/src/              # SDK 薄适配、元数据、技能与请求资源适配
│  ├─ contracts/src/             # 公开协议及四个业务 catalog
│  ├─ domain/src/                # 路径、选区、差异与技能格式/版本校验
│  ├─ application/src/           # 工作区、候选、技能与创作上下文/审校用例
│  └─ storage/
│     ├─ src/                    # 文件仓储、技能版本、恢复与 Windows 提交助手
│     └─ builtin/novel-writing/  # 内置 SKILL.md、人物参考及模板
├─ tests/api/                    # HTTP / SSE 接口测试，独立于前端执行
├─ tests/demo/                   # 全部路由登记覆盖、响应检查与 SSE 解析
├─ tests/ui/                     # 主题颜色与公开产品组件展示登记覆盖
├─ experiments/                  # P0 小验证，按需创建
├─ scripts/verify-real.ts         # 通用真实模型 HTTP 验收
├─ scripts/evaluate-writing.ts    # 同模型普通聊天/创作对照
├─ evals/writing-samples.ts        # 10 个可重复加载的合成小说样本
├─ docs/api/                     # 接口契约、请求示例、测试运行说明
├─ .env.example
├─ models.json                   # 非敏感模型配置
├─ package.json
├─ pnpm-workspace.yaml
├─ pnpm-lock.yaml
├─ tsconfig.base.json           # 后端与试验台类型检查
└─ tsconfig.frontend.json       # Web 与组件库共用的浏览器/JSX 编译配置
```

SDK 适配只封装当前需要的创建/打开会话、发消息、订阅、停止与配置。工具注册、参数格式校验、压缩、重试、会话落盘直接调用 SDK，不实现通用 AgentExecutor 框架或空仓储接口。

P1—P3 先由接口测试客户端验证请求、流式响应、停止和重新查询。P7 现已创建 `apps/web`（TypeScript + React + Vite），后续接入同一套公开接口。

`apps/web/src/app` 组合 `ThemeRoot`、`GlobalLayout` 和 `PageLayout`。全局布局提供左侧 `aside`、右侧唯一 `main`，一级页面位于 `main` 中，以 PageLayout 统一纵向间距和内边距。品牌、设置导航与保存反馈在应用内组合，选色能力复用 ColorSwatches；`features/settings` 管理浏览器主题偏好，不包含业务请求或状态管理框架。主题色通过组件库统一 CSS 变量传播。

业务按 `apps/web/src/features/<feature>` 组织页面组合、状态、hooks 和公开接口调用，一次性业务展示和样式就近维护。`packages/ui` 只维护通用框架标准、基础控件及实际复用的卡片/功能组件；不把整页包装成库组件，不在应用内复制通用组件。组件只通过 props、children 和回调与应用交互。详见 [组件库说明](../packages/ui/README.md) 与 [Feature 约定](../apps/web/src/features/README.md)。

按接口调试需求新增 `apps/api-demo`，使用 Vite + 原生 TypeScript 独立运行。`packages/contracts/src/catalog.ts` 登记公开接口的模块、用途、字段、示例和检查信息；`tests/demo` 验证目录覆盖及流解析。浏览器只调用 HTTP / SSE，不依赖后端内部实现；该测试页不改变 P7 产品前端的范围。使用说明见 [接口测试 Demo](api/demo.md)。

会话文件存放在配置指定的本机数据目录，不提交到 Git。浏览器断线重新读取会话消息与当前状态，不建立持久化 token 事件回放表。

技能存于 `<dataDir>/skills/packages/<id>/<version>/<name>/`，清单与工作区默认值在 `skills/state.json`；版本文件写完后发布清单。聊天归属和覆盖设置保存为 Pi 自定义条目。`application/skills` 通过端口获取会话元数据，`agent-pi` 只接收通用技能快照；两者由 server 装配。

P3 的五个工具薄适配位于 `apps/server/src/writing.ts`，业务在 `application/writing.ts`。上下文规模尚小，未创建独立 context 包。业务记录复用 Pi 自定义条目，候选来源随 P2 候选保存；普通演示与小说请求使用各自提示和工具。

## 4. 后续按业务增加

| 阶段 | 位置 | 具体职责 |
| --- | --- | --- |
| P4—P5 | context/visibility、retrieval、provenance；storage/search | 时间、知情、来源及检索接口 |
| P6（后置） | application/writing/prompts、domain/style、evals | 高级风格和偏好反馈；核心评测在 P3 |
| P1—P6 | packages/contracts、tests/api、docs/api | 接口契约、连续接口测试与接入资料 |
| P7 | apps/web；features/library、manuscript、assistant、proposals、story-bible、style | 集中设计和实现完整前端，接入已验收接口 |
| P7 | tests/e2e | 关键用户操作、真实接口联调与浏览器验证 |
| P8 | scripts、tests/integration、tests/e2e | 启动说明、备份恢复和受控试用 |
| 桌面交付 | apps/desktop | Electron 窗口、本地核心启动和打包 |

前端布局、视觉、编辑和生成反馈在 P7 统一实现并单独验收。后端阶段先明确这些交互所需的数据和状态，避免仅有 SDK 方法透传却无法支持实际操作。

application/writing 是小说业务代码，不是通用工作流执行器。没有独立 workflows/runtime 包，也不预建 runs、run_steps、run_events 表。

正式文稿为用户工作区的 Markdown；内部登记、候选和历史清单在 `<dataDir>/novels/<id>/state.json`，历史快照在同级 `revisions/<revisionId>.md`，不能缓存另一份当前正文。Windows 提交助手位于 `packages/storage/src/commit-markdown.ps1`。具体提交与恢复见 P2 实施计划。Pi 会话仍由 SDK 独立保存，不复制消息。

## 5. 依赖与调用

| 模块 | 约束 |
| --- | --- |
| web（P7） | 只访问公共接口，不访问 Pi、SQLite 或本机文件 |
| ui（P7） | 通用框架、控件及实际复用组件的统一维护入口；不依赖 web、feature 状态或后端内部实现 |
| contracts | 声明页面实际用到的协议，不导出 Pi 内部类型 |
| agent-pi | 封装 Pi SDK；接收工具与提示词，不导入小说模块 |
| domain（P2） | 纯小说规则，不依赖 Pi、HTTP 或数据库实现 |
| application（P2） | 编排保存、采纳等业务动作；需要时声明存储和执行接口 |
| application/writing（P3） | 编译正式资料、审校证据和候选；通过会话元数据端口持久化，不依赖 Pi |
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
