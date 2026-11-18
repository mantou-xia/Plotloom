// 调试工具专用入口；产品应用只导入具体组件，不引用本入口。
export { ComponentWorkbench } from './workbench.tsx';
export { ComponentPreview } from './component-preview.tsx';
export { defaultControls } from './controls.ts';
export type { PreviewControls, ComponentDimension } from './controls.ts';
