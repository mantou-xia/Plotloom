# TaskComposer 后端适配清单

更新：2026-11-19。正式聊天已接入当前 TaskComposer，旧简易输入框已移除。小说工作区前端本轮不接入，先完成通用项目 Agent 闭环。验收结果见 `project-agent-validation.md`。

## 已接入正式页面

| 能力 | 公开协议 | 当前行为 |
| --- | --- | --- |
| 普通/项目会话 | POST /api/sessions，GET /api/chats、/api/sessions/:id | 创建时可填写现存绝对目录或复用最近目录；目录固定并持久化，历史可重开。 |
| 文件与终端任务 | POST /api/sessions/:id/messages（SSE），GET .../tools | 项目会话由 Pi 执行 read、grep、find、ls、edit、write 和平台终端；Windows 使用 powershell。前端显示工具状态和历史结果。 |
| 模型与思考档位 | GET /api/models，GET/PUT .../config | provider+id 唯一标识模型，按实际 thinkingLevels 渲染档位；保存成功后生效，失败保留原配置。 |
| 文本、流式生成与停止 | POST .../messages、.../stop | accepted 后清空草稿；失败保留未接收草稿，运行中停止调用后端；断开页面不终止任务，重开读取快照。 |
| 附件 | POST/GET .../attachments，GET/DELETE .../attachments/:attachmentId | PNG/JPEG/WebP、UTF-8 TXT/Markdown，上传成功才发送真实 ID；未发送附件可移除，错误可移除重传；历史按需预览。图片需模型支持。 |
| 技能 | GET /api/skills、GET/PUT .../skills，消息 skillIds | 先启用聊天技能，再通过 @ 或 / 选择本轮技能；按当前会话工具诊断依赖。技能不会授予额外权限。 |
| 项目文件引用 | POST .../project-files | 关键词搜索相对路径候选，@ 引用还原为消息文字，由 Agent 工具读取文件；不是版本快照。 |
| 上下文与压缩 | GET .../context，PUT .../config，POST .../compact、.../compact/stop | 显示真实估算，未知值标为待估算；自动压缩开关、手动压缩及停止；生成/压缩结束后刷新。 |

## 现阶段边界

- 项目工具直接执行，项目路径只是默认 cwd，不是沙箱；尚无批准/自动审查/完全访问三档权限系统。
- 计划模式、持续目标模式未实现，正式输入框隐藏这些演示入口。
- 项目目录创建后不可切换；切换项目需新建聊天。无项目普通聊天不自动获得项目文件及终端工具。
- 小说工作区引用快照与创作流程已有后端接口，本轮不接正式前端；项目 @ 路径不冒充小说版本引用。
- 不支持 PDF、Word、音视频附件；单图最多 10 MiB，单文本最多 1 MiB，单轮最多 10 个附件且合计不超过 20 MiB。
- @ 搜索跳过依赖、构建、版本目录及符号链接；最多扫描 5000 项、返回 40 项，返回 truncated。它是有限候选检索，不是完整文件浏览器。
- 技能库页面当前展示列表；完整的创建、导入、编辑等管理仍通过接口试验台。

## 分层与运行环境

Pi 负责 Agent 循环、文件/终端工具、会话保存、模型配置与压缩。Plotloom 负责 HTTP/SSE 契约、项目归属、候选搜索、附件与技能业务及 UI 适配。`packages/ui` 只接收 props/回调；`apps/web` 只访问公开协议，不依赖 Pi 或磁盘。

Pi 的 find/grep 依赖 fd/rg；SDK 按其默认规则探测或下载工具。当前 Windows 验收环境已在 `C:/Users/Lenovo/.pi/agent/bin/fd.exe` 安装官方 fd v10.5.2，rg 已存在。外网下载不可用的机器应预装工具，不能将缺失工具时的执行错误标成成功。

契约与登记见 `packages/contracts/src/index.ts`、`catalog.ts`、`skill-catalog.ts`；独立接口测试见 `tests/api/projects.test.ts`，目录覆盖见 `tests/demo/projects.test.ts`，组件参数见 `packages/ui/README.md`。
