# 侧栏组件验证（2026-11-18）

## 本轮范围

- Sidebar 保留通用容器；七个独立入口：SidebarNavItem、SidebarSessionItem、SidebarSettingsItem、SidebarGroupHeader、SidebarGroup、SidebarSection、SidebarActionButton。旧入口已按用户确认直接替换，不提供兼容层。
- header → fixNavItems → ScrollBox（navItems、groups）→ footer。groups 内按业务需要组合外层 SidebarSection，每个分类可以容纳多个 SidebarGroup 或直接放对话。
- 功能、会话、设置均有独立组件和 CSS，内部复用行交互机制；分组组合独立标题组件，业务数据与路由交给应用。
- 侧栏组合调试台登记八种初始样例；新增、更多与新聊天仅为回调演示。
- 用户已明确先在组件库内完成组合，产品入口后续统一接入；本轮未改 apps/web、业务接口或会话数据接入。

## 验证结果

### 空态与异常态验收

- SidebarGroup、SidebarSection 增加 contentState（ready / empty / error）、emptyText、errorText。状态由调用方显式指定；内部共享提示样式，正常状态仍展示 children。
- 空态默认灰色“暂无聊天”，异常态默认红色“加载失败”；提示无 hover、点击或选中行为，标题与操作保留。分组提示左侧为 8px + indent（默认合计 32px），分类提示左侧为 8px。
- 两种容器均验证空态、异常态、长自定义异常文案、折叠隐藏及 Enter 展开、切回正常内容；长文案不横向溢出，异常文字计算颜色为 rgb(220, 38, 38)。
- 组合侧栏空态覆盖三个内层分组和最近分类；新增最近条目后，该分类恢复正常内容。异常样例显示四处异常提示。
- `pnpm.cmd ui:build`（含类型检查）和 `pnpm.cmd test:ui` 11 项通过。
- 浏览器脚本：`output/playwright/verify-sidebar-content-states.js`。已查看 group-empty、group-error、section-empty、section-error 四张截图，均位于 `output/playwright/`。

### 统一间距与分类 hover 验收

- 标题交互修正：外层分类和内层分组标题不再通过 focus-within 持续高亮，仅悬停／按下时反馈。浏览器确认点击后即使焦点仍保留，移开鼠标时两类标题背景均立即恢复透明；点击和 Enter 仍正确切换展开状态。此次 `pnpm.cmd ui:build` 通过。
- hover 差异来自外层分类标题沿用了普通 ghost 按钮的灰色反馈；现改为与导航、内层分组相同的主题浅色整行反馈，标题按钮背景透明，禁用状态不触发行反馈。
- 根节点统一四周 8px padding，并使用 border-box；header、fixNavItems、body、footer 四个直接子区域的计算 padding 均为 0，左右边缘对齐。
- header、固定导航、body 连续衔接，无额外 margin；临时移除可选固定导航后，header 与 body 也直接相接。几何断言允许 0.1px 亚像素误差。
- footer 使用 8px 上 margin；navItems 到 groups、相邻分类之间使用 12px 上 margin，分类容器不再使用 gap。
- 浏览器在湖蓝、青绿两种主题下验证分类与内层分组 hover 颜色相同，且颜色跟随主题变化；标题按钮没有叠加灰色背景。
- `pnpm.cmd ui:build`（含类型检查）通过。验证脚本为 `output/playwright/verify-sidebar-spacing.js`，截图 `output/playwright/sidebar-spacing.png` 已查看。

### 外层分类与侧栏层级验收

- 直接替换旧固定内容和混合 children 参数，现有调用与组件文档已迁移；未保留兼容分支。
- 调试台新增 SidebarSection 独立入口及标题、展开、禁用、操作区控件。Sidebar 组合演示项目分类包含 Alpha、Beta 两组，小说分类包含小说分组，最近分类直接包含对话；名称和内容均由调用方传入。
- 浏览器确认 DOM 层级符合 header、固定导航、滚动区、footer 顺序；滚动区内先 navItems 后 groups。
- 内层 SidebarGroup 的计算 margin-top、padding-top 均为 0px。
- 收起项目分类同时隐藏其中所有分组；Tab 跳过隐藏内容进入小说分类；Enter、空格均能切换外层分类。
- Alpha 收起、Beta 展开时，收起再展开项目分类，两组原状态保持；分类操作独立触发，新增最近条目成功。
- 30 条长列表滚动 600px，navItems 同步向上移动约 600px，header、fixNavItems、footer 顶部坐标完全不变。浏览器坐标比较允许亚像素误差。
- 独立分类禁用标题切换生效；长标题省略且不产生横向溢出；分类操作点击不触发折叠，关闭操作区参数后按钮移除。
- `pnpm.cmd ui:build`、组件库与 web 类型检查通过；`pnpm.cmd test:ui` 7 项通过，包含新增分类公开导出登记覆盖。
- 浏览器控制台无错误或警告；截图已查看：`output/playwright/sidebar-hierarchy.png`。交互验证脚本：`output/playwright/verify-sidebar-hierarchy.js`、`output/playwright/verify-sidebar-section.js`。

### 原子组件替换验收

- 六个独立组件均有公开导出、独立 TSX/CSS、调试目录入口与属性控件；Sidebar 继续提供七种组合示例。公开导出目录覆盖测试通过。
- 三种 item 分别验证选中、禁用、行高改为 52px、短线宽度改为 6px；参数作用于真实组件。
- 独立分组标题验证点击收起、Enter 展开，点击操作按钮不改变折叠状态；分组内容缩进可调整为 40px。
- 独立操作按钮验证大尺寸为 48×48px、加载时禁用；透明反馈继续复用底层 Button。
- 组合侧栏验证内部滚动 500px 时固定入口与底部位置不变、折叠隐藏子项、展开恢复；渐变和选中样式保留。已查看 `output/playwright/sidebar-atoms-composed.png`。
- 替换完成后 `pnpm.cmd ui:build`（含类型检查）通过，`pnpm.cmd test:ui` 7 项通过；代码中无旧 SidebarItem 或旧行样式引用。
- 开发服务在导入先于新文件写入时缓存了解析失败，已重启当前 ui-demo 开发服务并确认页面恢复；最终构建不受影响。

- `pnpm.cmd --filter @plotloom/ui typecheck` 通过。
- `pnpm.cmd test:ui`：7 项通过，包含新增公开导出的调试目录覆盖。
- `pnpm.cmd ui:build` 通过（含调试台类型检查）。
- 浏览器：点击折叠后子条目不可见；Enter 重新展开；点击条目更新当前项。
- 浏览器：更多操作保留当前选中；新增操作增加条目，不误触折叠。
- 浏览器：空分组可通过新增按钮变为一个条目。
- 浏览器：30 条内容产生内部滚动，滚动位置达到 761px，底部设置位置不变。
- 浏览器：长标题真实宽度 432px、可见宽度 154px，按单行省略；组件宽度调整到 220px 无横向溢出。
- 已查看截图 `output/playwright/sidebar.png`。
- 历史固定功能区验证：内部列表滚动 600px 后，新聊天区域顶部仍为 78.390625px，底部设置位置同样不变；新聊天点击触发 onNewChat，Tab 可进入滚动区的功能页面入口。旧插槽现已替换为 fixNavItems，当前验证见上方层级验收。
- 已查看固定入口组合截图 `output/playwright/sidebar-fixed.png`；此次扩展后的调试台构建与 7 项 UI 测试均通过。
- 渐变背景补充验证：方向为左上到右下，使用主题主色与浅底混合（12% 到 2%）。浏览器切换预设青绿、自定义 #b453c8 后背景实时更新；已查看截图 `output/playwright/sidebar-gradient.png`。
- 渐变样本覆盖黑、白、高饱和黄/青/品红、默认蓝和自定义紫色；沿渐变取 11 个采样点，正文及次要文字最小对比度为 4.55:1，选中行沿用已验证的主题色前景和实色背景。此次样式更新后调试台构建通过。

## 七条规则核对

1. 只实现已确认侧栏结构，不增加工作台、置顶、归档或业务接口。
2. 组件只通过 props 和回调交互，不依赖后端、路由或应用状态。
3. 关键组件及操作隔离、显隐占位规则均有注释。
4. 已按用户明确范围只完善组件库组合，产品入口后续统一接入。
5. 用户明确允许直接替换旧侧栏实现；已清理旧导出与调用，没有修改业务接口。
6. 行与分组无完整边框，底部仅中性灰单侧分隔；聚焦复用 Button。
7. 通用实现位于 packages/ui，调试台使用占位内容，没有放入完整业务页面。

本轮没有公开业务接口变更，不涉及接口试验台登记变更。
