# P1 通用 Agent 接口草案

日期：2026-11-17。状态：P0 阶段形成的最小设计，**尚未实现**。P0 真实模型验证完成后实施并用 HTTP / SSE 测试确认。

## 边界与基本结构

服务仅监听本机。前端只依赖本契约，不导入 Pi 类型、不访问本机 JSONL、不知道 Pi 内部目录。SDK 的模型、会话与工具接入放在后端适配层。

会话使用不透明 `id`；客户端不提交文件路径。每个会话一次只处理一条生成请求，忙时返回冲突，避免增加消息队列。用户等待和候选选择都是普通消息。会话运行状态只有 `idle` / `running`；已结束消息另有 `completed` / `aborted` / `failed` 结果。

消息公开结构：`{ id, role, content, outcome? }`。`role` 为 `user` / `assistant` / `tool`；`content` 是文本或工具块数组，文本块为 `{ type: "text", text }`，工具块为 `{ type: "tool", callId, name, status, text? }`，`status` 为 `running` / `completed` / `failed`。映射 SDK 已保存条目生成稳定消息标识，不要求前端理解 SDK 消息结构。

## HTTP 接口

以下路径不预先加版本兼容层；如实施后确需替换，按项目规则先确认旧接口是否仍需保留。

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| `GET /api/models` | 无 | `{ models: [{ provider, id, name, configured }] }`；不返回密钥 |
| `GET /api/model-config` | 无 | `{ provider, model, configured }`；未选择时 provider/model 为 null |
| `PUT /api/model-config` | `{ provider, model }` | 同 GET；选择供新会话使用的默认模型，凭据从本机配置读取 |
| `POST /api/sessions` | `{ provider?, model? }`；两者同时提供或均省略 | `201 { id, provider, model, status: "idle" }` |
| `GET /api/sessions` | 无 | `{ sessions: [{ id, provider, model, updatedAt, status }] }` |
| `GET /api/sessions/:id` | 无 | `{ id, provider, model, status, messages }`；必要时从磁盘重开 |
| `POST /api/sessions/:id/messages` | `{ text }` | `200 text/event-stream`，见下文 |
| `POST /api/sessions/:id/stop` | 无 | 等待 SDK 停止后返回 `{ id, status: "idle" }`；空闲时同样返回当前状态 |

新建会话应能立即查询；P1 须验证 SDK 空会话的落盘时机，必要时使用 SDK 会话元信息能力保存，不建立第二份聊天历史。

P1 模型配置只选择已注册供应商和模型，密钥通过本机配置提供。自定义供应商的具体协议/配置格式由 P0 实际接入结果确定，当前不建设通用供应商管理界面或密钥写入接口。

## 流式事件与重新查询

为避免“先开始生成、后订阅导致丢首段”的竞态，消息提交直接返回该次请求的 SSE；前端用 `fetch` 读取 POST 响应流，无需先创建任务再连接另一个订阅接口。

每个 `data` JSON 均含 `sessionId`；事件名写入 SSE 的 `event` 字段。

| 事件 | 额外字段 | 含义 |
| --- | --- | --- |
| `accepted` | `messageId` | 用户消息已接受，后续生成开始 |
| `text_delta` | `delta` | 正文增量 |
| `tool_start` | `callId, name` | 工具开始 |
| `tool_end` | `callId, name, outcome` | 工具成功或失败；完整结果通过消息查询 |
| `retrying` | `attempt, maxAttempts` | SDK 正在有限重试，不代表最终失败 |
| `compacting` | `phase: "start" | "end"` | SDK 正在处理上下文压缩 |
| `completed` | `usage?` | 本轮最终完成 |
| `aborted` | 无 | 本轮已停止 |
| `failed` | `error: { code, message }` | 本轮最终失败 |

每个已接受请求只有一个最终事件：`completed`、`aborted`、`failed`。底层 `agent_end` 不直接映射最终事件，须等待 SDK 重试/压缩完成。用量仅返回 SDK 实际提供的数据，不虚构缺失值。断流本身不等于生成结束。

客户端断开流不自动停止模型；只有 stop 接口主动中止。重新连接后 GET 会话获取已保存消息、正在运行时的当前消息快照与状态，不回放历史 token。服务重启后载入已保存记录，不自动续跑中断步骤；无法确定完成的记录应明确表现为中断。P1 接口测试必须确认该行为。

## 错误

开始流式响应前，错误统一为 `{ error: { code, message } }`：参数错误 400、会话不存在 404、会话忙 409、模型/凭据未就绪 422、内部错误 500。流已开始后通过 `failed` 返回最终错误。消息内容可读且不包含密钥、请求头、凭据路径或供应商原始错误正文。

## P1 实施顺序与验收

1. 创建 `apps/server`、`packages/agent-pi`、`packages/contracts` 和接口测试；固定模型接入配置，显式注册提示和工具。
2. 实现模型选择及会话创建、列出、查询/重开；用接口验证重启前后 ID 与历史一致，两个会话不串用。
3. 实现消息 POST 的 SSE 映射、SDK 结束状态判断及停止；测试正文、工具、成功、失败、中断和忙时冲突。
4. 测试断流后查询、服务重启后继续普通对话；核对空会话、完整回复与中断消息实际保存情况。
5. 交付请求示例、可重复执行的 HTTP / SSE 用例和真实模型验收记录；检查模型错误不泄漏凭据。

所有验收从公开接口完成，不启动产品前端。P1 不实现小说正文、候选采纳、版本管理或自建执行循环；这些能力按路线图在后续阶段增加。
