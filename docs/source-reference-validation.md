# C11 SourceReference 验收

日期：2026-11-20。范围：组件库来源列表与详情、独立调试台、C10 联动示例。真实聊天数据接入与后端来源协议不在本轮范围。

## 实现与公开参数

从 `@plotloom/ui/source-reference` 导入 `SourceReference`、`ReferenceSource`、`WebSource`、`FileSource`。

| 参数 | 说明 |
| --- | --- |
| sources | 来源数组，按调用方顺序展示；每项提供唯一 id、显示编号 index、title、kind，可选 summary/excerpt |
| selectedId | 受控的当前来源 ID，null 关闭详情；可由正文 C10 或列表设置 |
| onSelectedChange | 点击列表提供来源 ID，关闭详情提供 null |
| onOpenFile | 可选文件打开回调，接收完整 FileSource；实际文件操作由宿主负责 |
| className / style | 作用于来源列表根元素 |

网页来源的 `kind` 为 web，提供 url；文件来源为 file，提供 path。编号由调用方维护，不按数组位置重编，确保与正文引用一致。

## 关键决策

- 列表与正文共用 selectedId，避免两套来源选择状态不一致。没有提前绑定聊天协议。
- 复用 Button、Dialog 和 Dialog 内的 ScrollBox，来源详情在固定尺寸模态层中阅读，列表不被展开内容挤动。
- 列表摘要显示两行、路径省略；详情完整保留标题、链接或路径、摘要和引用片段。缺失的可选内容直接省略，不补造来源。
- 所有内容作为纯文本展示；网页域名从实际 URL 解析，只有绝对 HTTP(S) URL 提供新窗口导航并设置 noopener/noreferrer。
- 文件路径不转换为 file://，组件不直接访问本机文件。缺少打开回调时显示“暂无法打开此文件”。
- 来源不自动抓取，无 favicon 请求，无网络或文件加载业务状态。
- 调试台提供混合来源、网页来源、文件来源、正文引用联动、长内容、无效链接、空列表七个样例，允许编辑标题、链接、路径、摘要、片段和文件操作能力。

## 验证

- `pnpm.cmd --filter @plotloom/ui typecheck`：通过。
- `pnpm.cmd test:ui`：29 项通过，含公开组件导出与调试台目录覆盖。
- `pnpm.cmd ui:build`：通过，仍有既有大块体积提示，无新增依赖。
- `tests/ui/source-reference-browser.js`：29 项通过。覆盖网页/文件列表、域名与完整地址、引用原文换行、真实点击打开目标链接（测试拦截外网）、文件打开回调、无文件能力、来源关闭焦点恢复、C10 网页及文件 ID 联动、脚本与无效 URL、窄屏、长路径与片段、独立滚动、固定关闭按钮、HTML 字面文本、缺失摘要和空列表。
- 打开和关闭详情前后列表位置及尺寸一致；文件回调反馈也不改变详情尺寸。
- 目视检查 `output/playwright/source-reference-list.png`、`source-reference-web.png`、`source-reference-narrow.png`。

## 八条规则核对

1. 仅实现 C11 明确要求及 C10 联动示例，没有抓取器、下载器或文件访问层。
2. 数据通过 props 传入，文件操作通过回调，前后端解耦。
3. 编号归属、受控 ID、URL 处理、文件操作和固定布局均有注释。
4. 按既有 C11 计划范围推进；真实接口接入仍独立实施。
5. 新增组件，不替换或删除既有业务实现，保留 C10 独立示例。
6. 列表与片段使用背景及间距，无完整边框套嵌；Dialog 无边框，聚焦采用现有阴影反馈。
7. 通用组件位于 packages/ui，复用既有控件；调试台只展示组件数据与交互。
8. 详情模态层不占文档流，长内容独立滚动，关闭和操作按钮不随正文滚走，实测列表与操作反馈稳定。

无公开业务接口新增或变更，接口试验台要求不适用。
