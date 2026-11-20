# SplitPaneLayout 验收记录

日期：2026-11-20。

## 定位与交付

用户确认：与 PageLayout 同级，页面二选一使用；不依赖 GlobalLayout。新增入口 `@plotloom/ui/layouts/split-pane-layout`，调试台位于「布局组件 → SplitPaneLayout」，提供 5 个样例。未接聊天页面、未修改来源业务组件。

布局使用 `react-resizable-panels@4.24.1`（MIT）的 Group / Panel / Separator。复用 Button、ScrollBox；原生 dialog 同一节点在宽屏非模态面板与窄屏模态覆盖层之间切换。业务内容和打开状态由应用传入，跨刷新宽度保存交给应用回调。

## 验证结果

- `pnpm.cmd typecheck`：通过。
- `pnpm.cmd test:ui`：29 项通过，包含公开组件导出与目录覆盖校验。
- `pnpm.cmd ui:build`：通过；现有大型 chunk 警告仍在。
- `tests/ui/split-pane-browser.js`：真实 Chromium / Playwright CLI，32 项断言通过。
- 桌面截图 `output/playwright/split-pane-desktop.png`、覆盖面板截图 `output/playwright/split-pane-overlay.png` 已目视核查。

浏览器覆盖：默认400px宽度、真实拖拽、方向键、Home/End边界与收起、受控开关、重开恢复宽度、标题参数、独立滚动、关闭重开不卸载且保留输入/滚动、内容切换不重置主区阅读位置、宽窄切换保留内容、原生模态/Tab/Esc/焦点恢复、空插槽、初始关闭、360px视口无横向溢出、无运行错误。

定位并修复：键盘触发的布局回调先于命令式 ref 的尺寸更新，保存旧 ref 会导致重新打开时回退一次调节；现使用回调携带的新布局比例计算像素宽度。分隔条显式设置 width，避免被库的 flex 内联样式覆盖为零宽。

## 八条项目规则核对

1. 仅实现本次明确的双栏布局，未加入多标签/停靠/文档业务。
2. 纯前端公开 props，不访问后端或本机文件；不涉及公开业务接口变更。
3. 尺寸记录、模态切换、容器断点与用途均有注释。
4. 用户补充的页面层级已同步代码、目录和文档。
5. 新增同级布局入口，不替换已有 PageLayout 或 GlobalLayout。
6. 中性灰单侧标题分隔线；层级用背景/间距，无完整边框嵌套或边框叠加阴影。
7. 通用实现放 packages/ui，调试台仅使用占位内容组合。
8. 无额外状态反馈挤动内容；用户主动调整布局时才改变主区宽度，窄屏面板开关不挤动主区。两侧节点持续挂载。

边界：父容器需要明确高度；窄屏覆盖当前视口。内容重新换行或可滚动范围缩小时，滚动位置遵循浏览器裁剪行为。本轮验证 Chromium，未执行其他浏览器引擎验收。
