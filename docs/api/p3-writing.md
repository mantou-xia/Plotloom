# P3 内容创作接口

2026-11-18。接口字段、可编辑示例和错误登记在 `packages/contracts/src/writing-catalog.ts`，由主 catalog 汇总到试验台。模型只产生候选，正式稿仍通过 [P2 逐处采纳](p2-workspaces.md) 更新；会话、技能、模型和 SSE 沿用 [P1](p1-agent.md)、[P2.1](p2.1-skills.md)。

## 接口与任务

| 方法与路径 | 用途 | 返回 |
| --- | --- | --- |
| POST /api/workspaces/:workspaceId/outlines | 用户大纲原文留档，不调用模型 | 200 `{path,content,version}` |
| POST /api/sessions/:id/writing/context | 预览正式资料和版本，不调用模型 | 200 WritingContext |
| POST /api/sessions/:id/writing/messages | 根据资料生成、改写或讨论 | 200 SSE |
| GET /api/sessions/:id/writing | 查询来源、审校与本轮候选，最近在前 | 200 `{requests:WritingResult[]}` |

| task | 目标与范围 |
| --- | --- |
| chapter | 必须指定 target 和正式 outline；提交目标全文候选 |
| continue | 已有 target，服务固定末尾零长度选区；模型只给新增尾部 |
| rewrite | 已有 target，必须有精确 selection；模型只给替换文本 |
| enrich_outline | 已有大纲 target；AI 丰富产生候选，未采纳不更新大纲 |
| discuss | 可无 target，讨论或取证；具体冲突等待下一条用户说明 |

用户自己的大纲通过 outlines 直接原样保存，保留 BOM、换行和内容；已有文件须传当前 baseVersion。AI 丰富大纲才经过候选采纳。不安排固定的大纲讨论步骤，发现具体冲突时才提问。

## 请求与上下文

创作和预览接受同一 WritingRequest：

```json
{
  "task": "chapter",
  "instructions": "依据正式大纲写出码头告别场景，人物克制，少解释情绪。",
  "target": {"path": "章节/第一章.md", "baseVersion": null},
  "outline": {"path": "大纲/第一章.md", "version": "<读取返回的64位版本>"},
  "references": [
    {"path": "人物/林舟.md", "version": "<实际版本>", "role": "character"},
    {"path": "要求/作品.md", "version": "<实际版本>", "role": "requirements"},
    {"path": "样文/认可片段.md", "version": "<实际版本>", "role": "sample"}
  ],
  "maxOutputChars": 4000
}
```

版本占位符不能直接发送。先用 P2 读取或保存接口取得实际值。会话必须通过小说聊天入口创建，工作区从会话归属绑定，不由模型传入。路径是该工作区的合法 `.md` 相对路径，不依赖示例的中文目录名。

- `instructions`：非空，创作接口最多 10000 UTF-16 字符。
- `target`：`{path,baseVersion,selection?}`，新文件版本为 null。选区使用 `{start,end,text}`，起点包含、终点不包含，按 UTF-16 计数，不得切开 emoji，text 必须逐字匹配。
- `outline`：正式文件的 `{path,version}`；chapter 必填。目标与参考路径不得重复或用大小写别名。
- `references`：最多 30 个，role 为 outline/character/requirements/sample/history/other。可选 selection 指定引用片段。
- `maxOutputChars`：200–20000，默认 8000，约束每个候选新增/替换文本；不是精确字数或模型 token 配额。模型 token 能力仍来自模型配置。
- `skillIds`：本轮明确加载的已启用技能，沿用 P2.1 规则。小说默认内置技能自动加载。

WritingContext 返回 `workspaceId/task/instructions/target/sources/maxOutputChars/inputChars/inputLimit`。sources 每项含 `path/content/version/role/selection?`；保留完整原文和版本用于审计与冲突核对。提示词中，目标选区附带前后各最多 1000 字符，参考选区仅呈现所选片段。请求要求与完整资料快照合计上限 60000 字符，超过时明确拒绝；不会静默截掉必要资料。预览不锁定磁盘，发送时再次读取并校验版本。

## 工具与审校

小说请求获得以下受限工具；没有任意文件、命令执行、正式保存或采纳工具：

| 工具 | 模型参数 | 服务行为 |
| --- | --- | --- |
| list_documents | `{}` | 列出所属小说的正式 Markdown |
| read_document | `{path}` | 读取并固定本轮原文版本，再读同路径返回同一快照 |
| search_documents | `{query,paths?}` | 字面查找并保存实际命中文件原文和版本 |
| review_writing | `{status,issues}` | 保存最小审校；证据必须来自本轮对应文件 |
| propose_change | `{path,content,reason}` | 绑定目标、选区、基础版本和实际引用，创建 P2 候选 |

审校 status 为 clear 或 needs_input；clear 必须无问题，有问题必须 needs_input。每个问题为 `{kind,message,evidence:[{path,quote}]}`，kind 为 setting/viewpoint/missing_material；设定及视角冲突至少有一条逐字原文证据。新读取资料后重新审校。同一轮一旦发现需澄清问题，不能自己重新标 clear 并提交候选；用户下一条说明后可发起新一轮。

这保证审校流程和证据存在，不保证模型能发现所有语义冲突，不包含全书自动检索、完整知情状态重建或自动修订循环。

普通小说消息 `/sessions/:id/messages` 也获得这些能力，以 discuss 记录。要新建章节或精确改写请使用结构化创作接口；普通消息只能对本轮实际读取的已有文件提案。普通无小说归属的聊天保持 P1 行为，不获得小说工具。小说业务请求不加载 P1 演示资料工具或固定 A/B 提示。

## 流式与结果

沿用 accepted/text_delta/thinking_delta/tool_start/tool_end/retrying/compacting/completed/aborted/failed 十类公开事件。`completed` 只表示模型本轮结束，可能是候选、讨论或待澄清；不能据此认为已生成或已采纳正文。

查询 WritingResult 得到 `id/sessionId/createdAt/outcome/context/review/proposals`：

- outcome 为 running/completed/aborted/failed。review 未执行时为 null。
- proposals 为当前状态的完整 P2 候选，含 `origin:{sessionId,requestId,reason}`。来源随候选保存，用户不能通过 P2 请求伪造 origin。
- 候选只在用户调用原采纳接口后写入正式 Markdown。拒绝、不采纳和停止均不自动更新正式稿。
- 正式目标或引用发生变化，P2 版本检查阻止创建或采纳旧候选；重读后重新发起创作。
- 断开 SSE 只取消订阅。调用 `/sessions/:id/stop` 才停止生成；返回 idle 时已收尾，已完成候选仍可查询。
- 重启后历史、来源与候选可读取；未结束的运行显示 aborted，由用户决定是否重新发起，不自动续跑。

## 错误与最短联调流程

| 状态 / 错误 | 处理 |
| --- | --- |
| 400 INVALID_REQUEST | 修正字段、路径、任务要求、选区或重复引用 |
| 404 SESSION_NOT_FOUND / WORKSPACE_NOT_FOUND | 核对实际 ID |
| 409 SESSION_BUSY | 等待或停止该聊天；不排队 |
| 409 REVISION_CONFLICT / REFERENCE_CONFLICT | 重读当前目标和资料，重新核对后发起 |
| 422 NOVEL_SESSION_REQUIRED | 通过小说入口新建聊天 |
| 422 WRITING_SOURCE_MISSING | 保存所需正式资料后再试 |
| 422 WRITING_CONTEXT_TOO_LARGE | 减少本轮资料或拆分章节 |
| 422 MODEL_NOT_CONFIGURED / SKILL_UNAVAILABLE | 检查模型及已启用技能依赖 |
| 工具失败 WRITING_REVIEW_REQUIRED / WRITING_NEEDS_INPUT | 核对审校或提供下一条澄清；本轮不提交候选 |
| 工具失败 WRITING_TARGET_MISMATCH / WRITING_OUTPUT_TOO_LARGE | 目标或文本预算不符合请求，保留正式稿 |

1. 建立本机小说目录，POST `/api/workspaces` 登记，POST `/api/workspaces/:workspaceId/sessions` 创建小说聊天。
2. PUT `/api/workspaces/:workspaceId/document` 保存人物/要求/样文；POST `outlines` 保存用户大纲原文。
3. 用实际返回版本组装请求，先预览 context，再发送 writing/messages。
4. 接收最终事件后 GET writing，检查资料、审校和候选；有问题就发送下一轮说明。
5. 用 P2 proposals 的逐处 accept/reject 接口审阅；通过 document/read、history、restore、export 读取、回退或导出。

试验台“内容创作”模块可直接执行上述请求。独立回归执行 `pnpm.cmd test` 和 `pnpm.cmd test:demo`。固定的 10 个合成样本在 `evals/writing-samples.ts`；配置本机 `.env` 后运行 `node --env-file-if-exists=.env scripts/evaluate-writing.ts`，会新建隔离小说并完成同模型普通聊天对照，报告保存在 `output/p3-real-*/report.json`。每次运行调用真实模型并消耗用量。

样本、请求、返回文本、资料、审校、候选、耗时及 token 均保留，便于联调重放和逐份阅读。运行次数与质量结论见 [P3 验收](../p3-validation.md)，不能把协议通过等同于文学质量优于普通聊天。
