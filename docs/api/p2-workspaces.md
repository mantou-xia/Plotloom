# P2 Markdown 工作区接口

2026-11-18。本阶段新增 17 个 JSON 接口，不调用模型、不产生 SSE。全部接口已登记到 `packages/contracts/src/catalog.ts`（资产详情来自 `workspace-catalog.ts`）；试验台展示完整字段、可编辑示例与公共错误说明。验收见 [P2 验证记录](../p2-validation.md)。

## 1. 启动与资料归属

按根 README 启动本机服务和试验台。P2 不需要模型密钥；写入当前只支持 Windows。同一服务数据目录只运行一个服务实例。

选择已存在的本机空文件夹创建小说。后端创建“大纲”“正文章节”“角色卡”三个目录。不同工作区不能重复或嵌套，也不能与服务数据目录重叠。正式文稿是用户目录中的 UTF-8 `.md` 文件，可用外部编辑器编辑；通用文稿接口仍按书内相对路径读写。相对路径使用 `/` 并与磁盘大小写一致，不允许越界、符号链接、目录联接或 Windows 别名路径。

`<dataDir>/novels/<workspaceId>/state.json` 保存登记、候选和历史清单；同级 `revisions/<revisionId>.md` 保存快照。内部 JSON 不是已废弃的 JSON 正文资产兼容格式，不能替代磁盘当前稿。Pi 会话仍由 SDK JSONL 保存，P2 不关联小说聊天。

## 2. 接口目录

下表的 `:workspaceId` 是登记返回的 `id`；候选和差异 ID 均来自当前工作区内的响应。

| 方法与路径 | 请求要点 | 返回与用途 |
| --- | --- | --- |
| GET /api/workspaces | 无 | `{workspaces}`，登记列表 |
| POST /api/workspaces | `{title, root}` | 201，工作区 `{id,title,root,createdAt}` |
| GET /api/workspaces/:workspaceId | 无 | 工作区；同时核对上次未决提交 |
| PUT /api/workspaces/:workspaceId/shelf | `{pinned?,coverId?}`，至少一项 | 工作区及当前书架设置 |
| GET /api/workspaces/:workspaceId/documents | 无 | `{paths}`，实际 Markdown 相对路径 |
| GET /api/workspaces/:workspaceId/manuscript-stats | 无 | `{chapters,characters}`，仅统计已保存的正文章节及其中非空白的 Unicode 字符，含 Markdown 标记 |
| POST /api/workspaces/:workspaceId/document/read | `{path}` | `{path,content,version}`，现读磁盘 |
| PUT /api/workspaces/:workspaceId/document | `{path,baseVersion,content}` | 保存后的文档；自动创建所需父目录 |
| POST /api/workspaces/:workspaceId/history | `{path}` | `{revisions}`，作者显式留档的定稿 |
| POST /api/workspaces/:workspaceId/finalize | `{path,baseVersion}` | 定稿 ID、路径、来源版本及留档时间 |
| POST /api/workspaces/:workspaceId/restore | `{path,revisionId,baseVersion}` | 恢复后的文档，新增历史记录 |
| GET /api/workspaces/:workspaceId/proposals | 无 | `{proposals}`，候选及各处状态 |
| POST /api/workspaces/:workspaceId/proposals | `{path,baseVersion,content,selection?,references?}` | 201，保存候选但不写正式稿 |
| GET /api/workspaces/:workspaceId/proposals/:proposalId | 无 | 候选基础稿、目标稿及差异 |
| POST /api/workspaces/:workspaceId/proposals/:proposalId/changes/:changeId | `{action:"accept"或"reject"}` | 更新后的候选；仅处理该处 |
| POST /api/workspaces/:workspaceId/proposals/:proposalId/decision | `{action:"accept"或"reject"}` | 更新后的候选；处理全部剩余差异，采纳一次写入 |
| POST /api/workspaces/:workspaceId/search | `{query,paths?}` | `{matches,limit:100}`，字面子串与 UTF-16 位置 |
| POST /api/workspaces/:workspaceId/export | `{files:[{path,revisionId?}]}` | `{files:[{path,content,version}]}`，原始 Markdown |
| POST /api/workspaces/:workspaceId/backup | `{destination}` | `{destination,files}`，写入新的资产备份目录 |
| GET /api/workspaces/:workspaceId/recovery | 无 | `{pending,current?,intendedContent?}`，查看未决状态 |
| POST /api/workspaces/:workspaceId/recovery | `{version}` | `{pending:null}`，核对后保留现稿并结束未决记录 |

所有 POST 读取接口均用 JSON 请求体传递文档路径，避免中文路径和选区内容混入 URL。创建工作区/候选成功为 201，其余成功为 200。

## 3. 最小调用链

在试验台选择“新建小说”，填写本机已存在的空目录，例如：

```json
{"title":"灯塔","root":"D:/Novels/灯塔"}
```

工作区 ID 会自动填入后续页面。选择“手工保存 Markdown”，新建时 `baseVersion` 为 `null`：

```json
{"path":"章节/0001.md","baseVersion":null,"content":"旧一\n不改甲\n旧二\n不改乙\n旧三\n"}
```

保存返回内容 SHA-256 `version`。创建候选时把它填入 `baseVersion`，提交整篇候选内容：

```json
{"path":"章节/0001.md","baseVersion":"填入刚返回的64位版本","content":"新一\n不改甲\n新二\n不改乙\n新三\n","references":[]}
```

返回的 `changes` 有三处差异。试验台自动填入候选及第一处差异 ID；分别提交 `{"action":"accept"}` 或 `{"action":"reject"}`，处理其他位置时替换 `changeId`。最后重新读取文档，只有已采纳内容进入正式稿。

版本恢复先查询 history，选择该文件的 `revisionId`，再读取当前文档，把当前 `version` 填到 restore 的 `baseVersion`。读取旧内容可以调用 export 并指定 `revisionId`；恢复保留定稿清单，不新增定稿。

## 4. 版本、选区与状态

- `version` 是 UTF-8 内容 SHA-256；不存在的文件返回 `version:null, content:""`。BOM 和 CRLF 作为原文保留。定稿 ID 与内容版本不同。自动保存、外部编辑和回退不会生成定稿记录。内部保留引用和中断恢复使用的快照。
- 历史 `source` 为 `observed/manual/accepted/restored`；分别表示观察到的外部内容、手工保存、采纳和恢复。`createdAt` 是本应用记录时间，不是外部编辑器的保存时间；外部未被观察到的中间稿不在历史中。
- 选区 `{start,end,text}` 为 UTF-16 半开区间 `[start,end)`，文本必须精确匹配，不能切开 emoji 的代理对。提供选区时，`content` 只表示选区替换内容；后端保留范围外原文。
- 正文与大纲的新候选用未变段落对齐前后文，一段改成多段时按同一处处理。识别到原句跨段移动时，移出与移入一起处理。选区候选只替换精确选区，整处审批。已有候选按原范围继续审阅，其他工作区 Markdown 沿用行差异。`start/end/before/after` 对应基础稿；每处状态为 `pending/accepted/rejected`，采纳后附 `revisionId`。后端根据已采纳内容重建预期当前稿，支持前方长度变化及乱序采纳。
- 候选总体状态为 `pending`（未处理）、`partial`（仍有未处理处）、`accepted`（全采纳）、`rejected`（全拒绝）、`resolved`（采纳/拒绝混合且已处理完）。重复相同决定幂等，反向决定返回冲突；撤销采纳使用历史恢复。
- `references:[{path,version}]` 记录实际参考资料，不能重复或包含目标文件。参考内容变化时拒绝采纳，保留候选；核对后创建新候选。正式稿外部变化时同样拒绝覆盖，首版没有强制覆盖或自动合并。
- 搜索只匹配正式文件原文，不是语义召回；最多返回 100 处。导出保留 Markdown 语法，不转换为去格式 TXT。

## 5. 错误与中断恢复

错误沿用 `{error:{code,message}}`。处理含义如下，精确字段说明也在试验台“错误说明”中：

| HTTP / code | 处理方式 |
| --- | --- |
| 400 INVALID_REQUEST | 检查路径、选区、请求字段和候选是否有实际修改 |
| 404 ASSET_NOT_FOUND | 确认工作区、候选、差异或历史确实属于当前工作区 |
| 409 REVISION_CONFLICT / REFERENCE_CONFLICT | 重新读取并核对当前稿或引用资料；保留现稿，不盲目重试旧请求 |
| 409 WORKSPACE_NOT_EMPTY | 选择空文件夹；含隐藏文件或子目录的文件夹也视为非空 |
| 409 WORKSPACE_OVERLAP / BACKUP_EXISTS | 使用独立工作区或新的备份目录 |
| 409 CHANGE_RESOLVED | 查看既有决定；撤回已采纳内容走历史恢复 |
| 409 FILE_BUSY / FILE_UNWRITABLE / WORKSPACE_UNAVAILABLE | 等待旧写者退出，或检查占用、权限及目录，然后重新读取 |
| 409 COMMIT_UNCERTAIN | 调用 recovery 查看并核对；不能把未确认提交视为已采纳 |
| 422 ENCODING_UNSUPPORTED / DIFF_TOO_COMPLEX / PLATFORM_UNSUPPORTED | 转 UTF-8、缩小修改范围，或在 Windows 执行写入 |
| 500 ASSET_INVALID | 元数据格式无效，检查本机备份 |

提交前保存快照与待提交记录，写入助手 PID 先落盘再发指令。Windows 比较原稿与写入共用一个排除外部写入/删除的文件句柄。服务异常退出后，先检查旧写者是否仍活着；仍在运行返回 FILE_BUSY，不提前清除记录。旧写者已退出时，磁盘等于目标则补齐状态，等于原稿则撤销未生效记录，其他内容返回 COMMIT_UNCERTAIN。

处理未决提交：GET recovery 比较 `current` 与 `intendedContent`，必要时另存内容；确认保留磁盘稿后，POST recovery 传刚读取的 `current.version`。期间又改稿则仍返回冲突。该操作只记录当前内容并清除未决标记，不写正式稿，也不自动采纳候选。无未决记录时返回 `pending:null`。P2 没有后台生成任务或专用停止接口；P1 模型停止协议保持不变。

## 6. 资产备份与恢复

备份目标须为不存在的绝对目录，父目录已存在，不能与当前小说或内部数据目录重叠。备份时暂停外部编辑；逐文件复制不是整目录同时点快照。失败目录可能不完整，应换新目标重试。

备份包含 `manuscripts/`（正式 Markdown）、`metadata/state.json`、`metadata/revisions/`（历史及候选）和 `README.md`。不包含 Pi 聊天、模型配置、凭据或非 Markdown 附件。

恢复步骤：

1. 停止服务，先备份现有服务数据。
2. 将备份的 manuscripts 放到希望继续使用的小说目录。
3. 从备份 state.json 读取工作区 ID，将 metadata 恢复到 `<dataDir>/novels/<工作区ID>/`，保留 ID、历史和候选。
4. 修改恢复后的 state.json 中 `workspace.root` 为步骤 2 的绝对路径，确保不与其他登记工作区重叠。
5. 启动服务，用原工作区 ID 查询文档、历史和候选并核对。不要另行登记成新工作区后期待旧历史自动关联。

只需要取回正文时，直接打开或复制 manuscripts 即可。完整应用（含会话）备份在 P8 单独验收。

## 单章 TXT 下载

`POST /api/workspaces/:workspaceId/chapter/export-txt` 接收 `{"path":"正文章节/第四章.md"}`，返回 `filename`、`content` 和源 Markdown 的 `version`。浏览器用 UTF-8 保存返回的文本。已有标题保留文字，导出不补标题；单章来自当前磁盘，历史定稿和候选仍可由原接口查阅。无效路径或大纲返回 400，未知文稿或工作区返回 404。

聊天工具 `manuscript_workspace` 使用 `action: "export_txt"` 和正文路径。作者确认后，`tool_end.manuscriptView` 带有 `workspaceId`、`path`、`mode: "export_txt"` 和单次下载的 `downloadId`。客户端按标识去重，再从单章接口取得文件内容。拒绝或在等待确认时停止不会产生下载指令。右侧正文编辑器的“定稿选项”提供同一下载入口。
