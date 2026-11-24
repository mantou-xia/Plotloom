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

聊天整章使用既有发送消息入口。以“写第四章”“完成第四章”或“重写第四章”等明确写作指令开头，后面直接附大纲。服务锁定目标、当章世界观、适用角色阶段和最近三章前文。大纲里点名的角色优先，未点名时引用当章适用角色。

模型通过 `write_chapter_part(part, content)` 按连续段号暂存正文，每段最多 1500 个 UTF-16 字符，同号替换，段间自动加入一个空行。重试原消息时，已暂存的段落随草稿恢复；新发写章消息会另起草稿。整章含分隔空行最多 20000 个 UTF-16 字符。全文审校通过后，`deliver_chapter(partCount, reason)` 展示拼接后的全文供作者一次确认。新章直接写入正文目录并打开预览。重写已有章生成候选，定位事件携带 `proposalId`，右侧通过原候选接口逐处采纳或拒绝。拒绝或在待确认时停止不会改稿，目标或引用变化拒绝旧请求。重试沿用原轮目标与引用，第一次新建成功后重试返回 409。

旧章节导入使用小说聊天的 `POST /api/sessions/:id/messages`。先上传 UTF‑8 TXT/Markdown，再在导入消息中传当前会话的 `attachmentIds`。Agent 调用 `import_chapters({})`，后端按行首的“第几章”标题确定章界，作者确认卡显示按章号排列的标题。确认才写入 `正文章节/`，工具返回 `imported`、`unchanged`、`paths`，并通过 `tool_end.manuscriptView` 打开第一章预览。正文保留原始字符、段落与换行，章标题整理为 Markdown 一级标题。可导入一文件一章或同文件多个明确章标题，每轮最多 30 章并受现有聊天附件上限约束。

聊天交付新章与旧稿导入共用章号命名，例如 `正文章节/第4章.md`。章标题保留在文稿内容中。重写已有章时按章号复用现有文件路径。

缺标题、正文为空或重复章号时，工具返回 `CHAPTER_IMPORT_AMBIGUOUS`，请核对后重发。拒绝、跳过或在待确认时停止，磁盘正文不会写入。已有同章且内容相同则跳过，并在 `paths` 和预览事件中返回原文件路径。任意同章内容冲突或多份正文会在批量预检时拒绝写入。磁盘故障或开始写入后停止时，已完成章节保留，再次确认导入可继续缺失章节。

小说会话的 `manuscript_workspace` 工具复用正文、大纲和定稿接口。`edit` 直接提交候选，`tool_end.manuscriptView` 返回 `mode: "edit"` 和 `proposalId`，右侧打开差异供作者采纳或拒绝。采纳前正式稿保持原样，其余操作继续使用确认卡。`list`、`refresh` 浏览文稿目录，`open`、`preview`、`history`、`read_final` 定位文稿和定稿，`finalize`、`restore` 校验确认前读取到的磁盘版本，`discard` 丢弃当前浏览器的对应草稿。文稿定位也可从会话详情的 `manuscriptRequest` 获取。浏览器按指令 ID 去重，正文仍由文稿接口读取。不同小说与其他项目无法使用这一工具读写本书。

世界观保存在本书根目录的 `世界观.md`。每项包含主题、生效章、主角得知章和事实；得知章为“未揭示”的条目留在作者档案里。预览与创作可传 `chapterNumber`（1–999999，非法值返回 400）。工作台允许指定章号。接口未指定时优先识别目标文件名，再识别要求里的章号，写作缺省取第一章，无章号的作者讨论可查看全部设定。返回的世界观来源保留磁盘版本，content 为本章适用的内容。同主题取当前已生效、已揭示的最近设定。作者手工编辑时应保留条目格式。

小说工具 `propose_world_rule` 只提议从开篇到结尾都适用的底层规则。接收 `subject`、`fact`、`effective`（新条目须为 1）、`revealed`（主角实际得知章或 null）。章节建议另需明确确立规则的原文 `evidence:{path,quote}`，以及说明全书哪些场景须遵守此规则的 `impact`（最多 300 字符）。生效章不为 1 或章节建议缺少影响说明时，工具返回失败，不创建候选。新章交付后使用刚保存的章节版本取证，等确认时正文变化会阻止采纳。谈设定时复用聊天确认卡，确认后写入，拒绝或跳过保留原稿。若证据来自刚生成的章节候选，返回待审阅建议；作者先采纳章节，再在工作台独立采纳世界观。章节版本不符返回 409 REFERENCE_CONFLICT，设定文件版本冲突返回 409 REVISION_CONFLICT。停止确认中的轮次不会写正式资料。结构化重试核对原轮世界观版本。

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
| propose_change | `{path,content,reason}` | 绑定目标、选区、基础版本和实际引用，创建 P2 候选。正文或大纲的 `tool_end.manuscriptView` 带 `proposalId`，供右侧打开审阅 |

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

### 重试最近一次创作

从会话详情读取 `retryMessageId`，向 `POST /api/sessions/:id/retry` 提交 `{ "messageId": "<retryMessageId>" }`。服务保留旧轮次，按原任务、目标版本与选区、大纲、参考版本与片段、创作要求、字符预算和显式技能重新执行，生成独立的创作记录和候选。新记录使用原模型、思考档位和自动压缩设置，仅在重试期间应用。旧记录从首次执行保存的上下文重建创作参数，已有执行设置无法还原时使用会话当前设置。

正式目标或指定资料发生变化时，重试在调用模型前返回 `409 REVISION_CONFLICT`。已保存的有效技能版本或启用状态发生变化时，返回 `409 RETRY_UNAVAILABLE` 或原发送接口的 `422 SKILL_UNAVAILABLE`。重试占用同一个会话锁，可通过原停止接口结束，旧候选仍可查询。随模型工具调用才发现的资料在新一轮重新读取，日期也使用执行当天。

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
