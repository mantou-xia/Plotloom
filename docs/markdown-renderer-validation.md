# MarkdownRenderer 验收记录

日期：2026-11-19。范围：组件库 C01 Markdown 渲染及 C02 内部代码块能力、组件调试台；未接入聊天页面，未实施 A2UI。

## 交付内容

- 公开入口 `@plotloom/ui/markdown`，参数为 `content`、`streaming`、`textEffect`、`className`、`style`。
- Markdown/GFM、代码高亮与复制、KaTeX 行内与块级公式、Mermaid 图示、ECharts 柱状图/折线图/饼图。
- 图表源码切换、流式接收状态、无效内容回退；图表依赖按需加载，容器变化重算，卸载释放实例。
- 调试台「内容组件 → MarkdownRenderer」提供基础、代码、公式、Mermaid、数据图表、流式和错误七个样例；编辑器复用 Textarea/FormField。
- 采用 Streamdown 2.8.0、@streamdown/code 2.0.1、@streamdown/math 1.0.4、@streamdown/mermaid 1.0.4、@streamdown/cjk 1.0.5、KaTeX 0.16.47、ECharts 6.1.0，版本已锁定。

## 自动检查

| 检查 | 结果 |
| --- | --- |
| `pnpm.cmd typecheck` | 根项目、组件库、Web 与组件调试台全部通过 |
| `pnpm.cmd test:ui` | 29 项通过，包含组件目录覆盖及 3 项新图表配置测试 |
| `pnpm.cmd ui:build` | 通过，公式字体随构建产物输出 |
| `pnpm.cmd web:build` | 通过 |

构建仍提示部分 chunk 超过 500 kB。Markdown 示例约 796 kB、ECharts 模块约 566 kB（均为压缩前 JS）；通过动态导入隔离，Shiki 语言与 Mermaid 子模块按实际需要加载。本轮没有调高告警阈值或宣称已消除包体积问题。

## 真实浏览器验证

使用 Playwright CLI 与 Chromium，在 `127.0.0.1:4321` 的生产构建预览执行，避免开发服务首次依赖预构建刷新影响验证。可用如下方式复现：

```text
pnpm.cmd ui:build
pnpm.cmd --filter @plotloom/ui-demo exec vite preview --host 127.0.0.1 --port 4321 --strictPort
npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-md open http://127.0.0.1:4321
npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-md run-code --filename tests/ui/markdown-browser.js
```

`tests/ui/markdown-browser.js` 的 34 项断言全部通过，覆盖：

- 标题、GFM 表格、引用、任务列表、行内代码与链接属性。
- TypeScript/Python 实际高亮、未知语言回退、合法代码块 DOM、原始代码复制、复制反馈和 Enter 键操作。
- 行内、块级、积分与矩阵公式；错误公式不阻断正文。
- 流程图与时序图 SVG、源码切换与重新绘制。
- 柱、线、饼三类数据图表，中文标题、真实 SVG 图例点击与悬停提示。
- 窄屏触发尺寸重算，图表不撑破正文。
- 无效 JSON 与 Mermaid 分别提示并保留源码；HTML 脚本与 javascript 链接不会执行。
- 流式围栏未完成时等待，停止保留内容，重新播放后正确结束，图表正常绘制，无残留错误。
- 修改内容移除旧图表，浏览器无未捕获异常。

补充检查 3 项通过：长代码在块内横向滚动；十列表格在 327px 正文宽度内展示；拦截网络提供的图片测试素材正确显示替代说明并随容器缩放。该补充脚本在本地 `output/playwright/markdown-extra-check.js`。

已查看代码与公式截图，并保存图表截图：`output/playwright/markdown-code.png`、`markdown-math.png`、`markdown-charts.png`。输出目录为本地验证产物。

验证中修正：Shiki 双主题 token 的颜色来自 `htmlStyle.color`；KaTeX CSS 版本与插件运行时对齐；Windows 剪贴板读取比对统一 CRLF/LF。没有删除失败断言绕过检查。

## 项目七条规则核对

1. 范围限已确认的 Markdown 基建；仅开放 bar/line/pie，不提前实现 A2UI 协议或任意脚本运行。
2. 组件不依赖应用 feature、Pi SDK、数据库或后端内部实现；无业务网络请求。
3. 渲染入口、语言分派、高亮加载、图表配置检查及实例生命周期均有职责与原因注释。
4. 图表范围已由用户明确确认后实施。
5. 新增独立能力，没有替换旧聊天渲染入口或清理旧接口；后续页面替换仍需按规则处理。
6. 组件层级采用背景和间距；代码与图表容器无完整边框，不叠加边框阴影；表格与引用仅单侧中性灰分隔。
7. 通用渲染在 `packages/ui` 维护，示例只组合公开组件和参数；输入与按钮复用现有组件。

无公开业务接口变更，本轮不触发 API catalog、接口试验台和独立接口测试的新增登记要求。

## 逐字渐现补充验收（2026-11-19）

用户确认本轮范围为 Markdown 组件与调试台；增加 `textEffect`：`ink` 水墨晕开（默认）、`mist` 雾中凝字、`light` 柔光显影。参考本机 `C:/Users/Lenovo/Documents/ChatGPT/ui test demo/demos/text-emergence.html`。

复用 Streamdown 的字符级新增内容跟踪与跨块时间线，配合独立 CSS 动画；不增加网络协议或依赖。水墨采用 360ms 时长、120ms 柔焦停留和 90ms 聚焦；雾与柔光为 640ms。高速输入时采用 320ms 积压窗口压缩错开间隔，避免长回复持续积压。单字保存首次挂载时序，防止下一分块将仍在播放的时长改为 0；完成的字清理动画，停止或自然结束时清除逐字包装。静态正文和减少动态效果设置下直接显示文字。

验证结果：

- `pnpm.cmd typecheck`、`pnpm.cmd test:ui`（29 项）、`pnpm.cmd ui:build` 通过；构建仍有既存的大 chunk 提示。
- 原 `tests/ui/markdown-browser.js` 的 34 项浏览器回归通过，覆盖代码、公式、图示、图表及流式完成。
- 新增 `tests/ui/markdown-emergence-browser.js` 的 23 项 Chromium 断言通过：默认值、静态正文、三种真实动画中间帧、高频追加保留单字时序、停止清理、重播完整性、自然完成清理、减少动态效果、窄屏及无未捕获异常。
- 已查看三种效果播放中截图，保存于 `output/playwright/emergence-ink.png`、`emergence-mist.png`、`emergence-light.png`。未实测 Firefox、Safari 与真实移动设备。

复现新增检查：在上述预览会话执行 `npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-md run-code --filename tests/ui/markdown-emergence-browser.js`。

七条规则逐项复核：范围仅三种效果；保持纯展示组件；新增时序与样式逻辑有注释；范围经用户确认；扩展已有参数而非替换旧接口；未增加边框或阴影层级；通用能力及样式均在 `packages/ui`，调试台组合公开参数。无公开业务接口变更。

## 后续范围

- 聊天正文与思考内容接入仍在页面组合阶段处理。
- A2UI 的声明式协议、自定义语法公开 API、组件目录、交互回传后续单独实施；当前未知语言只展示源码。
- 数据图表当前支持已登记的 ECharts 配置子集；不能将其他 ECharts 图表类型或任意 JavaScript 配置视为已支持。
