# 通用表单组件计划

用户已确认：本轮在 packages/ui 建设 Input、Textarea、Select、Checkbox/CheckboxGroup、RadioGroup、Switch、NumberInput、FormField，注册到组件调试台；不批量替换现有页面。

1. 使用统一 8px 圆角、32/40/48px 控件高度、浅灰底色和主题焦点反馈。无完整边框套嵌或彩色边框；错误由文案与浅背景表达。
2. 复用已安装的 Base UI（deep-agent-base-ui 包别名），负责字段关联、选择键盘操作、数字步进及表单语义；业务组件只暴露项目所需参数。
3. Input 支持清空、密码显隐和图标；Textarea 支持字数统计；Select 支持单/多选、选项搜索、清空、禁用项和空结果；Checkbox/RadioGroup 支持分组；Switch 支持开关；NumberInput 支持步进、范围和空值；FormField 统一标签、必填、说明与错误。
4. 选择弹层、选中标记、开关滑块使用轻微回弹。键入不缩放控件，减少动态效果时停用动效。
5. 每个公开组件登记独立入口与参数控制；提供表单提交/重置的组件组合验证，不引入业务页面、请求或 Toast。
6. 完成类型检查、构建、现有 UI 测试及浏览器键盘、焦点、状态、提交/重置与窄屏检查，记录实际结果。

本轮 .cursor/rules、space/README.md 及 space/guanwenbo 的计划/记忆文档不存在。遵循根 AGENTS.md。LeiBox 两次检索无匹配，不引入演示组件。

2026-11-19：以上步骤已完成。类型检查、构建、20 项现有测试、37 项浏览器断言与键盘/窄屏检查通过，详见 `form-components-validation.md`。
