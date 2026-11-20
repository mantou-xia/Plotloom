# 文件附件与真实缩略图

日期：2026-11-20。

## 授权与范围

用户要求附件按参考图展示、图片直接显示真实图片，并尽量与 TaskComposer 保持一致；随后明确确认同时统一 TaskComposer 的文件样式。实现共享 AttachmentCard / AttachmentThumbnail，替换 C07 调试样例中的占位按钮。文件打开通过回调提供；消息示例组合现有 Dialog 预览图片。

不扩展后端上传格式、不接入真实聊天页面、不把完整 C09 横向图片组标记完成。

## 关键决策

- 图标与卡片共用一个组件，因为上传前后独立维护会产生外观差异。复用已安装的 Font Awesome 与 Lucide，不增加依赖。
- 名称与扩展名分开布局，避免长文件名截断后无法判断类型；完整名称保留在 title。
- 大小使用上传已有的字节数，补全 ComposerAttachment 的可选 size 类型，不改变业务接口。
- 样式由共享组件携带，使 TaskComposer Shadow DOM 与普通消息 DOM 获得同一套样式。
- 详情行固定高度；图片始终占用 68×68，状态更新与加载失败不改变附件尺寸。
- TaskComposer 保留现有上传、预览、增删动效；发送后场景不提供移除操作。

## 验证结果

- `pnpm.cmd test:ui`：29 项通过，包含组件目录登记和 Composer 源码本地修改哈希。
- `pnpm.cmd exec tsc -p .tmp/attachment-tsconfig.json`：本轮共享附件、样例、C07 和 TaskComposer 定向类型检查通过。
- `tests/ui/user-message-browser.js`：27 项通过。
- `tests/ui/attachment-browser.js`：24 项通过，覆盖类型图标、大小、长名称保留后缀、6 次状态切换位置与尺寸稳定、移除恢复、真实文件选择、两处图标路径及计算样式一致、真实图片加载、原有预览与退出删除。
- 目视检查 `output/playwright/attachment-types.png`、`attachment-composer.png`、`user-message-attachments.png`。
- 整体 `@plotloom/ui typecheck` 和 `ui:build` 未通过：其他工作区变更中的 `packages/ui/src/thinking-panel/thinking-panel.tsx` 缺失，仍被两个调试样例引用。此问题不在附件修改范围，未覆盖或恢复他人变更，不能据此宣称整体可合并。

## 八条规则核对

1. 只实现明确要求的附件展示与一致性，不扩展上传和聊天业务。
2. 只接收 props 与回调，无后端内部依赖。
3. 关键类型识别、固定布局、Shadow DOM 样式和共享入口均有注释。
4. 范围与样式统一方式已澄清。
5. 用户明确确认替换原 TaskComposer 文件视觉，无兼容旧样式分支。
6. 文件卡片无边框或阴影，类型颜色仅用于图标；聚焦用阴影。
7. 共享能力在 packages/ui；独立登记调试样例，消息用插槽组合。
8. 卡片状态固定行、图片固定尺寸，快速切换实测无位置或尺寸变化。

未修改公开业务接口，因此无接口试验台变更。
