# C02 CodeBlock 实施与验收

日期：2026-11-19。范围：按 C02 补全语言标识、语法高亮、复制、横向滚动；独立组件与调试台，不接入聊天页面。

## 实施计划与结果

1. 从现有 Markdown 内部实现提取独立 `@plotloom/ui/code-block`，源码和样式集中在 `packages/ui/src/code-block`。保留 Markdown 围栏入口，普通代码块直接复用，图表源码共用内部外框和高亮正文。
2. 继续采用已安装的 `@streamdown/code`，按需加载；未支持的语言和加载失败回退原始文本。异步高亮丢弃过期结果，不执行源码。
3. 复用 Button 与 ScrollBox。源码不强制换行，长代码区域最高 480px；工具栏独立布局，复制使用原始字符串，空内容禁用复制。
4. 提供 `code`、`language`、`streaming`、`className`、`style` 参数与八个独立调试样例。复制失败有明确反馈；内容变化或卸载使旧复制请求失效。
5. 完成类型、组件目录覆盖、构建与真实浏览器验证，更新 C02 状态与使用文档。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `pnpm.cmd typecheck` | 根项目、组件库、Web、组件调试台通过 |
| `pnpm.cmd test:ui` | 29 项通过，公开组件目录覆盖包含新增导出 |
| `pnpm.cmd ui:build` | 通过，仍有既存的大 chunk 提示 |
| `tests/ui/code-block-browser.js` | Chromium 34 项断言通过 |
| `tests/ui/markdown-browser.js` | Chromium 34 项回归通过 |

独立代码块的浏览器验证覆盖：

- TypeScript、Python、JSON 的实际多色高亮，脱离 Markdown 容器独立显示；语言与源码一致。
- 纯文本、未知语言、空代码；源码中的 HTML 不变为可执行 DOM。
- 真实剪贴板复制保留缩进、制表符、空行和末尾换行；Enter 键复制与成功反馈。
- 模拟剪贴板权限拒绝，检查失败提示、源码保留与恢复后的重试；延迟完成的旧复制请求不标记新内容。
- 长代码双向滚动、480px 高度上限、方向键横向滚动、源码滚动时工具栏位置保持、375px 画布不撑破组件。
- 流式停止保留片段，重播完成后源码无缺失、无过期高亮覆盖，忙碌状态正确结束。
- 无浏览器未捕获异常。

Markdown 回归覆盖原有代码高亮和复制、图表源码切换、公式、Mermaid、ECharts、流式停止与完成等 34 项。仅将已提取的代码行样式选择器更新为组件新名称，未删除断言。

已查看截图：`output/playwright/code-block-typescript.png`、`output/playwright/code-block-long.png`。未实测 Firefox、Safari 或真实移动设备。

验证脚本修正了两类等待条件：纯文本分词不生成颜色样式，不能等待带颜色的节点；空反馈隐藏后不能用默认可见角色查询。权限恢复后的成功反馈等待真实异步剪贴板操作完成，未通过降低功能断言绕过验证。

## 复现

```text
pnpm.cmd ui:build
pnpm.cmd --filter @plotloom/ui-demo exec vite preview --host 127.0.0.1 --port 4321 --strictPort
npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-code open http://127.0.0.1:4321
npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-code run-code --filename tests/ui/code-block-browser.js
npx.cmd --yes --package @playwright/cli playwright-cli -s=plotloom-code run-code --filename tests/ui/markdown-browser.js
```

## 七条规则复核

1. 仅实现 C02 四项能力，不添加行号、下载、运行代码或编辑器。
2. 纯展示组件，不依赖应用、后端、数据库或 Pi SDK，无公开业务接口变更。
3. 高亮生命周期、复制时序、原文保留及共享外框均有职责和原因注释。
4. 范围按用户要求回到既定 C02，未继续其他组件。
5. 保留原 Markdown 入口与行为，提取共享能力，没有删除旧公开接口或另建兼容分支。
6. 用背景与间距区分层级，未增加完整边框；焦点沿用 Button 和 ScrollBox。
7. 实现与样式在 `packages/ui`，复用已有 Button、ScrollBox、Textarea、FormField，调试台展示真实组件参数。

本轮无可用 `.cursor/rules/*.mdc`；未找到指定 `space` 文档。无业务协议变更，不涉及 API catalog 或接口试验台登记。聊天页面接入仍按总计划后续推进。

## 复制图标反馈调整（2026-11-19）

按用户要求，复制改用 Lucide Copy 图标和 Button 的 iconOnly 模式；成功后同一图标变绿 2.2 秒再恢复，重复复制重新计时，不显示“已复制”文案。失败说明保留，按钮仍有“复制代码”的可访问名称。普通代码块、Markdown 与图表源码共享此反馈。

`ui:build`（含类型检查）、29 项 UI 测试、39 项代码块浏览器断言和 34 项 Markdown 浏览器断言通过。新增核查实际图标颜色变化、持续显示、重复复制续期、恢复原色及无成功文案；已查看图标按钮截图。Markdown 脚本同步等待 iframe 示例更换及异步复制成功后再断言，避免读取旧示例或旧剪贴板。
