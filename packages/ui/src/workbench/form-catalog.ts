import type { ComponentExample } from './catalog.ts';

const entries = [
  ['input', 'Input', '文本、密码、前后图标与清空操作。'],
  ['textarea', 'Textarea', '多行输入、最大长度与字数统计。'],
  ['select', 'Select', '单选、多选、搜索、清空及禁用选项。'],
  ['checkbox', 'Checkbox', '独立勾选与半选状态。'],
  ['checkbox-group', 'CheckboxGroup', '多选组，以数组接收值。'],
  ['radio-group', 'RadioGroup', '单选组，方向键切换选项。'],
  ['switch', 'Switch', '开关状态与轻微滑块回弹。'],
  ['number-input', 'NumberInput', '数值输入、步进、范围和空值。'],
  ['form-field', 'FormField', '统一关联标签、说明、必填标记和错误信息。'],
] as const;

/** 每个公开表单组件独立登记，组合示例只验证字段语义，不承载业务页面。 */
export const formCatalog: ComponentExample[] = entries.map(([id, name, description]) => ({
  id, name, description, category: '表单组件', exportPath: `./${id}`, width: 640, height: id === 'form-field' ? 760 : 480,
  interaction: '右侧调整公开参数；画布内检查键盘、值变化、提交及重置。系统减少动态效果时关闭回弹。',
  states: [
    { id: 'default', name: '默认', description: '常用参数，可直接交互并查看回调。' },
    { id: 'disabled', name: '禁用', description: '通过字段禁用内部控件和辅助按钮。' },
    { id: 'error', name: '校验错误', description: '错误由调用方传入，标签及说明保持关联。' },
    ...(id !== 'form-field' ? [{ id: 'readonly', name: '只读', description: '保留当前值，禁止修改。' }] : []),
    ...(id === 'input' ? [{ id: 'password', name: '密码', description: '显示与隐藏密码，保持值和焦点。' }] : []),
    ...(id === 'select' ? [{ id: 'multiple', name: '多选', description: '返回字符串数组；清空后为空数组。' }, { id: 'empty', name: '空列表', description: '无选项时展示空态。' }] : []),
    ...(id === 'checkbox' ? [{ id: 'indeterminate', name: '半选', description: '通过 indeterminate 表达部分选中。' }] : []),
  ],
}));
