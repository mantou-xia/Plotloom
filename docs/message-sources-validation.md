# 聊天附件与文档引用验收

日期：2026-11-19。执行计划见 `message-sources-plan.md`。

## 交付范围与协议

- 新增 `POST/GET /api/sessions/:id/attachments`，上传或列出当前会话附件。
- 新增 `GET/DELETE /api/sessions/:id/attachments/:attachmentId`，读取原始内容或移除未发送附件。
- 扩展 `POST /api/sessions/:id/messages`：支持 attachmentIds、references，可纯附件或纯引用发送；现有 text/skillIds 用法保留。
- 扩展 `GET /api/sessions/:id`：用户消息可返回 attachments 元信息和 references 实际内容快照，正文保留用户原始文字。
- 已同步 catalog.ts 及 source-catalog.ts；试验台分组为“聊天附件”，四条新路由与现有消息/历史字段均纳入 tests/demo 全目录覆盖，共 56 条路由。

支持 PNG、JPEG、WebP 图片，UTF-8 TXT、Markdown 文本；不支持 PDF/Word。图片单个最大 10 MiB，文本 1 MiB，单轮最多 10 个附件、合计 20 MiB，最多 20 个文档引用。文字与实际引用文本合计最多 100000 字符。

上传/读取使用 JSON base64，接口不接收附件的本机路径。图片校验实际格式和解码，沿用 Pi 已使用的 Photon 0.3.4；声明为应用直接依赖，避免导入 Pi 内部文件。图片输入交给 Pi 原生 prompt images，不重写模型执行循环。

普通聊天可显式引用已登记工作区的指定历史版本及 UTF-16 选区。小说聊天仍限定本书，沿用创作流程的当前版本校验；不会借引用获取跨书工具或修改原稿的权限。

已发送附件禁止删除，返回 409 ATTACHMENT_IN_USE；生成、配置或压缩中删除返回 409 SESSION_BUSY。删除与消息准备共用会话锁。附件、来源和原文均跨重启保留。图片模型不支持、无效来源和预算错误在 SSE 开始前拒绝，不写入用户消息；运行中的停止/失败继续使用原 SSE 终态。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| pnpm.cmd test | 64 项全部通过 |
| pnpm.cmd test:demo | 7 项全部通过 |
| pnpm.cmd typecheck | 通过 |
| pnpm.cmd demo:build | 通过 |
| git diff --check | 通过 |

`tests/api/sources.test.ts` 使用独立服务进程、真实 HTTP/SSE、Pi SDK 和文件存储，模型端使用协议替身。覆盖五种类型、原文读取、重启、无凭据附件管理、删除、错误类型/编码/大小/空文件、跨会话隔离、图片能力、纯图片/纯文本附件/混合输入、历史原文、模型请求中的图片、连续对话、指定历史版本、选区与 emoji、跨工作区显式引用、小说跨书拒绝、总量限制、发送与删除竞争、生成中删除冲突、停止和失败历史。

试验台使用 Playwright 完成 31 步实际页面操作，没有模拟 HTTP：选择真实图片/文本文件上传、列表、图片解码预览、文本安全展示、加入消息、文档加入引用、混合发送、纯附件/纯引用、原稿修改后引用旧版本、历史来源、已发送删除拒绝、生成中删除拒绝、停止后删除、未知附件、无效上传、模型不支持图片、失败终态、跨会话拒绝。正常请求字段检查全部通过；页面无 JS 运行异常，7 条控制台 HTTP 错误均为主动验证的预期错误。760px 窄屏无横向溢出。

本机材料：`output/playwright/message-sources-report.txt`、`message-sources-run.js`、`message-sources-image.png`、`message-sources-history.png`、`message-sources-narrow.png`。

本阶段未调用外部模型验证图片理解质量；模型协议中的实际图片/文本输入已验证。产品聊天页面附件控件尚未接线，权限三档和计划模式不在本阶段交付内。

## 七条规则核对

1. 不过度设计：限定已确认格式、附件归属及文档引用，复用现有版本快照和 Pi 输入。
2. 前后端解耦：contracts 仅公开协议；application 编译资料，storage 存储，agent-pi 适配 SDK；试验台只走 HTTP。
3. 关键注释：覆盖原始资料校验、版本固定、会话锁、历史投影及前端安全预览。
4. 需求澄清：已取得两类引用均支持、附件格式限定的明确答复。
5. 旧接口：增量扩展，未替换或删除；已有文本、技能与创作接口全量回归通过。
6. 边框规范：新增文件输入沿用现有中性实线控件，预览用背景与间距，没有嵌套完整边框或新增阴影叠加。
7. 组件归属：已检查组件库；试验台原有原生控件和页面样式继续复用，附件编码/预览逻辑是该页面的业务辅助，不提取无复用需求的通用组件。

本阶段后端与接口试验台交付完成。
