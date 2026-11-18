# P1 通用 Agent 接口

日期：2026-11-17。状态：**已实现，确定性 HTTP / SSE 测试及真实模型验收通过**。详见 [P1 验证记录](../p1-validation.md)。类型定义位于 `packages/contracts/src/index.ts`，不包含 Pi 类型。

## 边界与基本结构

服务仅监听本机。前端只依赖本契约，不导入 Pi 类型、不访问本机 JSONL、不知道 Pi 内部目录。SDK 的模型、会话与工具接入放在后端适配层。

会话使用不透明 `id`；客户端不提交文件路径。生成、配置修改、命名和手动压缩共用会话互斥边界，忙时返回 409，不排队。用户等待和候选选择都是普通消息。状态仍为 `idle` / `running`，另有 `activity: idle | generating | configuring | compacting` 区分操作；已结束消息提供 `completed` / `aborted` / `failed` 结果。

消息公开结构：`{ id, role, content, outcome? }`。`role` 为 `user` / `assistant` / `tool`；`content` 是内容块数组，正文为 `{ type: "text", text }`，模型可见思考为 `{ type: "thinking", text }`，工具块为 `{ type: "tool", callId, name, status, text? }`。工具 `status` 为 `running` / `completed` / `failed`。思考签名、加密数据和已隐去内容不公开；没有 thinking 块不表示模型没有推理。已保存消息 ID 重启后稳定，临时快照以 `stream:` 开头；完成后以 GET 返回的保存结果为准。

用户消息的 `outcome` 表示该次请求的最终结果，运行中省略；assistant 消息也提供已知结果。工具状态为对应工具执行结果，工具失败后模型仍可解释问题并正常结束。强制退出后未完成请求标为 `aborted`，未保存的 token 不保证恢复。

## HTTP 接口

以下路径不预先加版本兼容层；如实施后确需替换，按项目规则先确认旧接口是否仍需保留。

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| `GET /api/models` | 无 | `{ models: [{ provider, id, name, configured, reasoning, thinkingLevels, contextWindow, maxTokens, input }] }` |
| `GET /api/model-config` | 无 | `{ provider, model, configured, thinkingLevel }`；未选择时 provider/model 为 null |
| `PUT /api/model-config` | `{ provider, model, thinkingLevel? }` | 同 GET；只影响以后新会话 |
| `POST /api/sessions` | `{ provider?, model?, thinkingLevel?, name? }`；模型标识成对 | `201 { id, provider, model, thinkingLevel, name, status, activity }` |
| `GET /api/sessions` | 无 | `{ sessions: [{ id, provider, model, thinkingLevel, name, updatedAt, status, activity }] }` |
| `GET /api/sessions/:id` | 无 | 会话摘要字段加 `messages`；必要时从磁盘重开 |
| `GET /api/sessions/:id/config` | 无 | `{ id, provider, model, thinkingLevel, capabilities }` |
| `PUT /api/sessions/:id/config` | `{ provider?, model?, thinkingLevel? }`，至少一项，模型标识成对 | 同 GET；只改变此会话并保存 |
| `PUT /api/sessions/:id/name` | `{ name }`，1–120 字符，不能全空白 | 会话摘要，名称去除首尾空白 |
| `GET /api/sessions/:id/tools` | 无 | `{ id, tools: [{ name, description, parameters, active }] }`；parameters 为 JSON Schema |
| `GET /api/sessions/:id/context` | 无 | `{ id, status, activity, tokens, contextWindow, percent, autoCompaction }` |
| `GET /api/sessions/:id/stats` | 无 | `{ id, userMessages, assistantMessages, toolCalls, toolResults, totalMessages, usage? }` |
| `POST /api/sessions/:id/compact` | `{ instructions? }`，最多 2000 字符；默认发送 `{}` | `{ id, status: "idle", outcome, summary?, tokensBefore?, estimatedTokensAfter?, usage? }` |
| `POST /api/sessions/:id/compact/stop` | 无 | `{ id, status }`；只取消手动压缩，不干扰普通生成 |
| `POST /api/sessions/:id/messages` | `{ text, skillIds? }` | `200 text/event-stream`，见下文 |
| `POST /api/sessions/:id/stop` | 无 | 停止当前生成或手动压缩，等待收尾后返回 `{ id, status: "idle" }` |

新建会话立即保存并可查询，重启后仍存在。SDK 1.5.2 不持久化仅有元信息的空会话，因此创建时将 SDK 公共 API 返回的头和元信息写入同一 JSONL，再交给 SessionManager 打开；之后消息、工具结果与压缩全部由 SDK 保存，没有第二份聊天历史。

P1 模型配置只选择已注册且已配置凭据的模型。PUT 的默认选择保存于数据目录 `model-config.json`，重启后优先于环境默认值；不改变已有会话的模型。`configured` 表示存在可用凭据，不保证供应商一定接受凭据。无凭据仍可读取历史。自定义供应商通过根目录 `models.json` 按 SDK 格式登记，密钥由 `.env` / 本进程环境提供，不提供密钥写入接口。

创建请求必须有 JSON 对象，使用默认模型发送 `{}`。消息 `text` 必须是非空白字符串，最多 100000 字符；请求体上限 1 MiB。未知字段、类型错误和缺少必要参数返回 400。

P2.1 新增可选 `skillIds:string[]`，最多 50 项且不可重复：仅明确加载本轮已启用技能，不改变启用设置；未启用、已删除或缺少声明工具返回 422。小说聊天归属、技能默认/覆盖和受限资源加载见 [P2.1 接口](p2.1-skills.md)。技能设置可在生成中修改，只影响下一请求；工具查询展示当前 SDK 实例，下一条消息装配后刷新。

### P1.1 配置与上下文语义

思考档位全集为 `off/minimal/low/medium/high/xhigh/max`，具体支持值取 `thinkingLevels`。能力来自 SDK 模型定义；`reasoning` 不保证上游返回可见思考。显式不支持的档位返回 422，不静默忽略；只换模型而省略档位时，由 SDK 按新模型能力调整旧档位，响应返回实际值。创建时省略档位继承默认设置，未配置则从 `off` 开始。

会话模型、档位和名称直接保存在 SDK 会话记录，空会话修改也可跨进程恢复；默认设置独立保存，不回写已有会话。配置/生成/压缩要求凭据；已注册模型的历史、配置、上下文、统计、工具查询和命名不要求凭据。

`capabilities` 为 `{ reasoning, thinkingLevels, contextWindow, maxTokens, input }`。窗口和最大输出是注册模型定义，输入类型只是能力说明，当前消息接口仍仅接受文本。

上下文 `tokens` 和 `percent` 是 SDK 估算，未知时为 null；`percent` 单位为百分比，不是 0–1 小数。压缩后等待新回复期间可能未知。`autoCompaction` 表示 SDK 自动压缩开关，本轮只读。统计提供 SDK 消息计数与已保存的已知用量，包括已记录的压缩；进行中未保存的用量不保证包含，也不返回费用估算。

手动压缩是等待结束的 JSON 请求，客户端应允许较长等待。`outcome` 为 `completed` 或 `aborted`，成功返回摘要及压缩前后估算。断开 HTTP 不停止压缩；取消接口或通用停止接口会等待取消收尾，原请求返回 `aborted`。压缩不删除原历史，失败保持原记录；空会话、内容不足或刚压缩过返回 `COMPACTION_UNAVAILABLE`。

## 流式事件与重新查询

为避免“先开始生成、后订阅导致丢首段”的竞态，消息提交直接返回该次请求的 SSE；前端用 `fetch` 读取 POST 响应流，无需先创建任务再连接另一个订阅接口。

每个 `data` JSON 均含 `sessionId`；事件名写入 SSE 的 `event` 字段。

| 事件 | 额外字段 | 含义 |
| --- | --- | --- |
| `accepted` | `messageId` | 用户消息已接受，后续生成开始 |
| `text_delta` | `delta` | 正文增量 |
| `thinking_delta` | `delta` | 模型实际返回的可见思考文本；与正文独立累加 |
| `tool_start` | `callId, name` | 工具开始 |
| `tool_end` | `callId, name, outcome` | 工具成功或失败；完整结果通过消息查询 |
| `retrying` | `attempt, maxAttempts` | SDK 正在有限重试，不代表最终失败 |
| `compacting` | `phase: "start" | "end"` | SDK 正在处理上下文压缩 |
| `completed` | `usage?` | 本轮最终完成 |
| `aborted` | 无 | 本轮已停止 |
| `failed` | `error: { code, message }` | 本轮最终失败 |

每个已接受请求只有一个最终事件：`completed`、`aborted`、`failed`。底层 `agent_end` 不直接映射最终事件，须等待 SDK 重试/压缩完成。用量仅返回 SDK 实际提供的数据，不虚构缺失值。断流本身不等于生成结束。

`usage` 字段为 `{ input, output, cacheRead, cacheWrite, totalTokens }`，合计本次请求中 SDK 提供的所有模型调用和压缩用量。全部缺失或全零时省略，不表示没有消耗。配置价格为占位值，因此不返回推测账单金额。

客户端断开流不自动停止模型；只有 stop 接口主动中止，服务正常关闭时也会停止并保存。重新连接后 GET 会话获取已保存消息、正在运行时的当前消息快照与状态，不回放历史 token。服务强制退出后载入已保存记录，不自动续跑中断步骤；缺少请求结束标记时公开结果为 `aborted`。请求开始/结束使用 SDK 自定义条目记录引用和结果，不保存 token 日志。

SSE 每 15 秒发送注释心跳，可忽略。慢客户端待发送缓冲超过 1 MiB 时断开流，生成继续，使用 GET 查询。正常客户端每次请求收到一次 `accepted` 和一个最终事件；如果底层启动在接受用户消息前失败，可直接收到 `failed`。

## 错误

开始流式响应前，错误统一为 `{ error: { code, message } }`：参数错误 400、会话不存在 404、会话忙 409、模型/凭据未就绪 422、内部错误 500。流已开始后通过 `failed` 返回最终错误。消息内容可读且不包含密钥、请求头、凭据路径或供应商原始错误正文。

| HTTP / 场景 | code | 客户端处理 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 修正请求 |
| 403 | `ORIGIN_FORBIDDEN` | 使用本机同源访问；无页面的测试客户端可不发送 Origin |
| 404 | `SESSION_NOT_FOUND` / `NOT_FOUND` | 刷新列表或核对路径 |
| 409 | `SESSION_BUSY` | 等待或显式停止后重新发消息 |
| 409 | `COMPACTION_UNAVAILABLE` | 当前无可压缩内容，继续对话后再试 |
| 422 | `MODEL_NOT_SELECTED` / `MODEL_NOT_FOUND` / `MODEL_NOT_CONFIGURED` | 选择有效模型或补充本机凭据 |
| 422 | `THINKING_LEVEL_UNSUPPORTED` | 查询模型可用档位后选择 |
| 500 | `INTERNAL_ERROR` / `SESSION_INVALID` | 检查本机服务及数据 |
| 502 | `COMPACTION_FAILED` | 压缩失败，原历史保留，检查模型配置后再试 |
| 503 | `SERVER_CLOSING` | 服务重启后重新查询 |
| SSE failed | `MODEL_FAILED` | 查询已保存消息，再由用户重新发起 |

服务只监听 `127.0.0.1`，拒绝异站 Origin，不提供开放 CORS。日志只记录请求标识、错误码、会话标识及结束状态，不记录用户正文、密钥或供应商原始错误。SDK JSONL 属于私有本机数据，可能包含供应商原始错误，不作为接口响应直接返回。

## 请求示例与测试

启动方式见 [README](../../README.md)。[p1-requests.http](p1-requests.http) 包含全部接口的请求，可在支持 HTTP 文件的客户端逐条执行；创建会话后把返回的 ID 填入变量。

一次工具调用的 SSE 示例（实际增量次数随模型变化）：

```text
event: accepted
data: {"sessionId":"会话ID","messageId":"消息ID"}

event: tool_start
data: {"sessionId":"会话ID","callId":"read-1","name":"read_fixture"}

event: tool_end
data: {"sessionId":"会话ID","callId":"read-1","name":"read_fixture","outcome":"completed"}

event: text_delta
data: {"sessionId":"会话ID","delta":"灯塔-731。A：检查台阶。"}

event: completed
data: {"sessionId":"会话ID","usage":{"input":20,"output":10,"cacheRead":0,"cacheWrite":0,"totalTokens":30}}

```

本机确定性协议替身的测试数据位于 `tests/api/fixture.ts`：`TOOL` 触发真实 SDK 工具循环，`WAIT:*` 保持流打开，`FAIL` 返回带测试密钥的失败，`RETRY*` 触发有限重试，`SEED_COMPACTION` / `COMPACT` 触发真实 SDK 摘要压缩。这些是测试模型指令，产品 API 不为它们添加特殊分支。实际只读资料为 `packages/agent-pi/fixtures/scene.md`。

```text
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd verify:real
```

前两项无需真实凭据；最后一项须先配置 `.env`，会发出真实模型请求。测试均从 HTTP 进入，同一服务经过独立进程重启，详见验证记录。

## P1 实施顺序与验收

1. 创建 `apps/server`、`packages/agent-pi`、`packages/contracts` 和接口测试；固定模型接入配置，显式注册提示和工具。
2. 实现模型选择及会话创建、列出、查询/重开；用接口验证重启前后 ID 与历史一致，两个会话不串用。
3. 实现消息 POST 的 SSE 映射、SDK 结束状态判断及停止；测试正文、工具、成功、失败、中断和忙时冲突。
4. 测试断流后查询、服务重启后继续普通对话；核对空会话、完整回复与中断消息实际保存情况。
5. 交付请求示例、可重复执行的 HTTP / SSE 用例和真实模型验收记录；检查模型错误不泄漏凭据。

所有验收从公开接口完成，不启动产品前端。P1 不实现小说正文、候选采纳、版本管理或自建执行循环；这些能力按路线图在后续阶段增加。
