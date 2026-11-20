# Markdown 渲染组件计划

日期：2026-11-19。状态：已完成组件与调试台验收，详见 [验收记录](markdown-renderer-validation.md)。

## 已确认范围

新增独立组件与调试台示例：Markdown/GFM、流式渲染、代码高亮与复制、行内及块级公式、Mermaid 图示、柱状图/折线图/饼图等数据图表。A2UI 后续实施，本轮不执行模型生成的 JavaScript 或 JSX，也不改造旧聊天页面。

## 调研与选型

- Streamdown：面向流式 Markdown，提供不完整语法处理、代码/公式/Mermaid 插件、自定义代码块渲染入口，采用此方案减少自行维护流式解析逻辑。
- Ant Design X Markdown：支持流式、Marked 扩展及组件映射，可作为备选。
- react-markdown：支持 remark/rehype 和自定义组件，但需自行组合流式处理，因此本轮不作为直接底座。
- 数据图表使用 ECharts 按需模块，通过 `echarts` JSON 围栏承载；选择它是因为柱、线、饼图及图例、提示交互可共用配置格式。
- LeiBox 两次检索未找到适用组件，不引入无关展示代码。

核查来源：

- https://streamdown.ai/docs/usage
- https://streamdown.ai/docs/custom-renderers
- https://streamdown.ai/docs/security
- https://streamdown.ai/docs/styling
- https://ant-design-x.antgroup.com/x-markdowns/introduce
- https://github.com/remarkjs/react-markdown
- https://echarts.apache.org/handbook/zh/basics/import/

## 实施步骤

1. 在 `packages/ui` 新建 MarkdownRenderer，采用项目主题与 CSS，避免为渲染器引入整套样式框架。
2. 接入代码、公式、中文排版；图表围栏未完成时显示接收状态，完成后渲染，错误时保留源码与可读提示。
3. ECharts 按需异步加载，跟随容器尺寸变化，卸载释放实例。只解析 JSON，不执行脚本；图表配置采用实际支持的类型与组件。
4. 注册组件调试台，提供基础排版、代码、公式、Mermaid、数据图表、流式、错误样例及公开参数控制。
5. 完成类型检查、组件目录回归、构建、真实浏览器检查，更新使用说明、验收记录和总计划进度。

组件只接收内容和展示参数，不发业务请求。通过框架 components.code 扩展点集中处理围栏语言分派；A2UI 的协议、组件目录和动作回传另行设计，不提前建设。

本轮无可用 `.cursor/rules/*.mdc`；遵循根 AGENTS.md 七条规则。无公开业务接口变更，不涉及接口试验台登记。
