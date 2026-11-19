import { formCatalog } from './form-catalog.ts';

export interface ComponentExample {
  id: string;
  name: string;
  category: string;
  exportPath: string;
  description: string;
  interaction: string;
  width: number;
  height: number;
  states: { id: string; name: string; description: string }[];
}

/** 产品组件的展示登记；与公开 TSX 导出做覆盖校验，新增组件时必须同步补充。 */
export const componentCatalog: ComponentExample[] = [
  ...formCatalog,
  {
    id: 'tooltip', name: 'Tooltip', category: '反馈组件', exportPath: './tooltip',
    description: '深色圆角提示气泡，带箭头、缩放与轻微摇摆；不改变触发元素外观。',
    interaction: '悬停或 Tab 聚焦显示，Esc 关闭；右侧修改文案、延迟或禁用提示。',
    width: 640, height: 360,
    states: [
      { id: 'default', name: '短提示', description: '默认在触发元素上方显示，空间不足时自动避让。' },
      { id: 'long', name: '长提示', description: '长文字在气泡内自动换行。' },
      { id: 'disabled', name: '禁用提示', description: '关闭提示，触发按钮仍可正常使用。' },
    ],
  },
  {
    id: 'morphing-popover', name: 'MorphingPopover', category: '反馈组件', exportPath: './morphing-popover',
    description: '按钮形变为面板的通用容器，模型与权限菜单共用此实现。',
    interaction: '切换样例直接显示展开效果；收起后点击按钮体验形变。下方提供组合步骤和可复制代码，右侧可调整面板宽度。',
    width: 720, height: 760,
    states: [
      { id: 'default', name: '向上展开', description: '左对齐，保留原版形变与弹簧动画。' },
      { id: 'below', name: '向下展开', description: '从触发器顶边向下展开。' },
      { id: 'right', name: '右对齐', description: '面板与触发器右侧对齐。' },
      { id: 'reduced-motion', name: '减少动态效果', description: '无动画地展开与收回。' },
      { id: 'custom-content', name: '自定义面板内容', description: '同一容器承载说明、分栏和操作按钮，children 可替换为任意内容。' },
      { id: 'closed', name: '收起状态', description: '展示工具按钮起点，点击按钮或展开预览体验形变。' },
    ],
  },
  {
    id: 'toast', name: 'ToastViewport', category: '反馈组件', exportPath: './toast',
    description: '全局操作提示：成功、失败、信息和处理中；最多显示三条，其余排队，重复消息合并。',
    interaction: '画布内编辑内容、类型与时长，验证并发、去重、异步原位更新、手动关闭与悬停暂停；显示和消失均带动效。store 可注入以隔离实例。',
    width: 900, height: 640,
    states: [
      { id: 'default', name: '操作提示', description: '使用公开工具触发各类消息；默认 3.5 秒，错误 6 秒，处理中持续显示。' },
      { id: 'queue', name: '并发队列', description: '六条消息按先后顺序展示，只有可见消息开始计时。' },
    ],
  },
  {
    id: 'card', name: 'Card', category: '基础组件', exportPath: './card',
    description: '通用卡片容器，默认 8px 圆角、12px 内边距、纯白背景、无边框。',
    interaction: '右侧切换普通/液态玻璃材质，调整圆角、内边距、背景颜色及边框。液态玻璃样例可移动真实文字与色块背景，检查实时折射。',
    width: 640, height: 360,
    states: [
      { id: 'default', name: '默认卡片', description: '白底无边框；浅灰画布用于观察圆角与内边距。' },
      { id: 'bordered', name: '带边框', description: '中性灰 1px 实线边框，不叠加阴影或内部完整边框。' },
      { id: 'liquid-glass', name: '液态玻璃', description: '折射卡片背后的页面内容，前景文字与按钮保持清晰；非 Chromium 浏览器降级为模糊玻璃。' },
    ],
  },
  {
    id: 'task-composer', name: 'TaskComposer', category: '输入组件', exportPath: './task-composer',
    description: 'LeiBox Deep Agent Composer 原版：附件、权限、上下文、模型选择与思考强度滑块。',
    interaction: '点击模型与权限胶囊体验形变展开；拖动思考滑块，悬停上下文环；选择附件或输入后发送，观察原版动画与回调。',
    width: 800, height: 540,
    states: [
      { id: 'default', name: '原版输入框', description: '保留原版布局、样式与动效，输入提示词或添加附件后发送。' },
      { id: 'busy', name: '生成中', description: '显示原版停止按钮，点击触发停止回调。' },
      { id: 'stopping', name: '停止处理中', description: '原版停止中加载状态，阻止重复点击。' },
      { id: 'disabled', name: '禁用', description: '通过原版 disabled 参数禁止组件交互。' },
      { id: 'no-models', name: '模型列表为空', description: '原版模型面板的空列表提示。' },
      { id: 'reduced-motion', name: '减少动态效果', description: '原版 reducedMotion 参数保留操作并减少动画。' },
    ],
  },
{
  "id": "sidebar-nav-item",
  "name": "SidebarNavItem",
  "category": "侧栏组件",
  "exportPath": "./sidebar/nav-item",
  "description": "功能页面入口独立展示与参数调整；不依赖完整侧栏或业务状态。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "普通",
      "description": "独立组件的普通初始状态，右侧属性可继续调整。"
    },
    {
      "id": "selected",
      "name": "选中",
      "description": "独立组件的选中初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "long",
      "name": "长标题",
      "description": "独立组件的长标题初始状态，右侧属性可继续调整。"
    }
  ]
},
{
  "id": "sidebar-session-item",
  "name": "SidebarSessionItem",
  "category": "侧栏组件",
  "exportPath": "./sidebar/session-item",
  "description": "无左侧图标的会话行；右侧叠放相对时间、任务状态、置顶与归档，沿用主题样式。",
  "interaction": "悬停或键盘聚焦向左展开，离开后收起；触屏常展开。置顶切换示例状态，归档仅记录回调，不打开会话或调用后端。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "普通",
      "description": "正在进行的会话；右侧调整时间文案、状态及置顶。"
    },
    { "id": "unread", "name": "已完成未查看", "description": "完成但尚未查看；标签保留完整状态说明。" },
    { "id": "failed", "name": "失败", "description": "失败状态使用独立警示色，不改变行的主题配色。" },
    { "id": "pinned", "name": "已置顶", "description": "置顶按钮呈按下状态；点击可取消，仅示例状态。" },
    {
      "id": "selected",
      "name": "选中",
      "description": "独立组件的选中初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "long",
      "name": "长标题",
      "description": "独立组件的长标题初始状态，右侧属性可继续调整。"
    }
  ]
},
{
  "id": "sidebar-settings-item",
  "name": "SidebarSettingsItem",
  "category": "侧栏组件",
  "exportPath": "./sidebar/settings-item",
  "description": "设置入口独立展示与参数调整；不依赖完整侧栏或业务状态。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "普通",
      "description": "独立组件的普通初始状态，右侧属性可继续调整。"
    },
    {
      "id": "selected",
      "name": "选中",
      "description": "独立组件的选中初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "long",
      "name": "长标题",
      "description": "独立组件的长标题初始状态，右侧属性可继续调整。"
    }
  ]
},
{
  "id": "sidebar-group-header",
  "name": "SidebarGroupHeader",
  "category": "侧栏组件",
  "exportPath": "./sidebar/group-header",
  "description": "分组标题使用开合文件夹表达展开状态，无额外箭头；支持业务传入两套图标，右侧可切换书籍示例。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "展开",
      "description": "独立组件的展开初始状态，右侧属性可继续调整。"
    },
    {
      "id": "collapsed",
      "name": "收起",
      "description": "独立组件的收起初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "long",
      "name": "长标题",
      "description": "独立组件的长标题初始状态，右侧属性可继续调整。"
    }
  ]
},
{
  "id": "sidebar-group",
  "name": "SidebarGroup",
  "category": "侧栏组件",
  "exportPath": "./sidebar/group",
  "description": "可折叠分组支持开合图标；内容缩进仅作用于条目内部，子项 hover 和点击覆盖整行。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "展开",
      "description": "独立组件的展开初始状态，右侧属性可继续调整。"
    },
    { "id": "empty", "name": "空态", "description": "展开后显示缩进的灰色暂无聊天文字；右侧可修改文案。" },
    { "id": "error", "name": "异常态", "description": "展开后显示红色加载失败提示，不展示普通条目；右侧可修改文案。" },
    {
      "id": "collapsed",
      "name": "收起",
      "description": "独立组件的收起初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "long",
      "name": "长标题",
      "description": "独立组件的长标题初始状态，右侧属性可继续调整。"
    }
  ]
},
{
  "id": "sidebar-action-button",
  "name": "SidebarActionButton",
  "category": "侧栏组件",
  "exportPath": "./sidebar/action-button",
  "description": "图标操作按钮独立展示与参数调整；不依赖完整侧栏或业务状态。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "普通",
      "description": "独立组件的普通初始状态，右侧属性可继续调整。"
    },
    {
      "id": "disabled",
      "name": "禁用",
      "description": "独立组件的禁用初始状态，右侧属性可继续调整。"
    },
    {
      "id": "loading",
      "name": "加载",
      "description": "独立组件的加载初始状态，右侧属性可继续调整。"
    }
  ]
},
  {
    id: 'sidebar-section', name: 'SidebarSection', category: '侧栏组件', exportPath: './sidebar/section',
    description: '外层分类，整体展开或收起项目、小说或最近对话；内部可容纳多个 SidebarGroup 或直接放置对话。',
    interaction: '点击标题或按 Enter、空格切换整类内容；分类操作独立触发，收起后保留内部状态。右侧可调整标题、展开、禁用与操作区。',
    width: 400, height: 320,
    states: [
      { id: 'default', name: '展开分类', description: '分类中直接放置对话；多分组嵌套可在 Sidebar 组合示例验证。' },
      { id: 'collapsed', name: '收起分类', description: '隐藏整个分类内容，子项退出键盘导航。' },
      { id: 'long', name: '长标题', description: '分类标题省略，展开箭头和独立操作区保持可见。' },
      { id: 'disabled', name: '禁止折叠', description: '禁用标题切换；操作插槽由调用方控制。' },
      { id: 'empty', name: '空态', description: '分类下显示灰色暂无聊天文字，标题和操作仍保留。' },
      { id: 'error', name: '异常态', description: '分类下显示红色加载失败文字，支持自定义文案。' },
    ],
  },
  {
    id: 'sidebar', name: 'Sidebar', category: '侧栏组件', exportPath: './sidebar',
    description: 'header、fixNavItems、滚动内容区（navItems 与外层分类 groups）、footer；分类内部组合多个分组或对话。',
    interaction: '点击分组仅展开或收起；点击条目切换选中；新增、置顶和归档回调独立触发。会话元数据悬停或键盘聚焦时向左展开；右侧可调节尺寸和主题色。',
    width: 400, height: 640,
    states: [
      { id: 'default', name: '分类与内层分组', description: '项目分类容纳 Alpha、Beta 两个独立分组，小说分类容纳小说分组，最近分类直接容纳对话。分类由业务按需选择，示例仅展示组合能力。' },
      { id: 'selected', name: '选中条目', description: 'active 控制当前条目，点击可切换选中；设置项复用同一导航行。' },
      { id: 'collapsed', name: '收起分组', description: 'expanded=false；点击标题或按 Enter、空格展开。' },
      { id: 'empty', name: '空分组', description: '分组和最近分类通过 contentState 展示统一空态；点击新增按钮恢复最近分类的普通条目。' },
      { id: 'error', name: '异常分组', description: '分组和最近分类显示红色异常提示，标题仍可折叠；仅演示状态，不请求业务接口。' },
      { id: 'long', name: '长标题', description: '会话工具栏覆盖标题，展开不改变标题宽度；文字在左侧渐隐露出背景，完整标题通过提示查看。' },
      { id: 'overflow', name: '长列表', description: '30 条内容使用统一 ScrollBox，滚动时头部与底部保持固定。' },
      { id: 'fixed', name: '固定功能入口', description: 'fixNavItems 放置新聊天示例；navItems 与 groups 共用滚动区。滚动 30 条会话时头部、新聊天和底部保持固定。' },
    ],
  },
  {
    id: 'ascii-ocean', name: 'AsciiOcean', category: '背景组件', exportPath: './ascii-ocean',
    description: '浅底 ASCII 鲨鱼与鱼群背景，保留摆尾、群游、指针避让和点击水波。',
    interaction: '移动鼠标或点击海洋；聚焦画布后按 Enter 制造水波。右侧可暂停和调整游动速度，尺寸改变时保留当前场景。',
    width: 1000, height: 640,
    states: [
      { id: 'swimming', name: '鲨鱼与鱼群', description: '四种鲨鱼与小鱼群自动游动，点击水面触发惊散并记录坐标。' },
      { id: 'paused', name: '暂停画面', description: '暂停自动游动，保留当前海洋与水波交互；取消暂停继续游动。' },
    ],
  },
  {
    id: 'scroll-box', name: 'ScrollBox', category: '基础组件', exportPath: './scroll-box',
    description: '统一滚动盒子：滚动条始终保留占位，显隐不挤压内容。', interaction: '增减内容检查溢出前后的布局；悬停、Tab 聚焦、滚轮和方向键检查真实滚动，右侧可调整方向与显示方式。', width: 640, height: 520,
    states: [
      { id: 'vertical', name: '纵向滚动', description: '默认纵向，悬停或聚焦显示滑块。' },
      { id: 'horizontal', name: '横向滚动', description: '横向轨道始终占位，内容增减不改变可用高度。' },
      { id: 'both', name: '双向滚动', description: '两个方向均保留滚动空间。' },
      { id: 'short', name: '短内容', description: '内容未溢出，点击增加内容观察布局不跳动。' },
      { id: 'empty', name: '空内容', description: '没有内容时仍保留滚动占位。' },
    ],
  },
  {
    id: 'button', name: 'Button', category: '基础组件', exportPath: './button',
    description: '六种按钮类型及危险、禁用、加载、尺寸和图标能力统一展示。', interaction: '总览平铺全部类型；右侧参数作用于交互试用。悬停、按下、Tab 聚焦检查真实状态；加载和禁用不可触发回调。', width: 760, height: 720,
    states: [
      { id: 'overview', name: '全部按钮', description: '同页展示六种类型、四类状态、三档尺寸及图标组合。' },
      { id: 'primary', name: '主要按钮', description: 'variant="primary"，默认可点击。' },
      { id: 'secondary', name: '次按钮', description: 'variant="secondary"，中性底色辅助操作。' },
      { id: 'subtle', name: '浅底按钮', description: 'variant="subtle"。' },
      { id: 'ghost', name: '透明按钮', description: 'variant="ghost"。' },
      { id: 'text', name: '文字按钮', description: 'variant="text"，紧凑文字操作。' },
      { id: 'link', name: '链接样式', description: 'variant="link"，链接外观，仍使用原生 button 语义。' },
      { id: 'danger', name: '危险操作', description: 'danger=true，独立危险色，不跟随主色变化。' },
      { id: 'loading', name: '加载中', description: 'loading=true，保留尺寸并阻止重复点击。' },
      { id: 'icons', name: '图标按钮', description: '前置、后置、双侧或纯图标通过右侧调节。' },
      { id: 'disabled', name: '禁用按钮', description: 'disabled=true，点击不应触发回调；右侧可独立修改变体。' },
      { id: 'long', name: '长文本', description: '窄视口下检查按钮文字换行。' },
    ],
  },
  {
    id: 'color-picker', name: 'ColorPicker', category: '基础组件', exportPath: './color-picker',
    description: '常驻纯色面板：取色、HEX/RGB 输入、预设与最近颜色。', interaction: '拖动或方向键取色；切换 HEX/RGB 输入，Esc 撤销草稿；点击 + 记录当前颜色，最多保留十色。', width: 400, height: 560,
    states: [
      { id: 'default', name: '当前主题色', description: '受控颜色与调试台配色同步。' },
      { id: 'black', name: '黑色起始', description: '从 #000000 开始，检查低亮度选色。' },
      { id: 'white', name: '白色起始', description: '从 #ffffff 开始，检查高亮度选色。' },
      { id: 'rgb', name: 'RGB 输入', description: '初始显示 RGB，三个通道接受 0—255 的整数；对外仍提交 HEX。' },
    ],
  },
  {
    id: 'global-layout', name: 'GlobalLayout', category: '布局组件', exportPath: './layouts/global-layout',
    description: '侧栏融入同色主题外壳，右侧保留白色内容卡片，弹性把手调节侧栏宽度。', interaction: '靠近中间显示把手；拖动调宽，越界阻尼并在松手后回弹。聚焦后方向键调整，Shift 加速，Home/End 到边界，双击或 Esc 恢复初始宽度。两侧独立滚动。', width: 1000, height: 600,
    states: [
      { id: 'content', name: '侧栏与正文', description: '通过 sidebar 和 children 注入样例内容。' },
      { id: 'empty', name: '空布局', description: '两个区域为空，保留布局结构。' },
      { id: 'overflow', name: '长内容', description: '左右内容超过卡片高度，分别滚动且不撑开外层布局。' },
    ],
  },
  {
    id: 'page-layout', name: 'PageLayout', category: '布局组件', exportPath: './layouts/page-layout',
    description: '一级页面布局：左侧标题、右侧操作按钮，正文居中限宽并独立滚动。', interaction: '调整标题、操作区、正文最大宽度、内边距和间距；点击操作按钮查看回调，切换长正文检查页头固定。示例只使用占位内容。', width: 1000, height: 600,
    states: [
      { id: 'content', name: '普通内容', description: '标题与操作按钮位于顶部，三个正文块居中；缩小最大宽度可观察左右留白。' },
      { id: 'empty', name: '空正文', description: '不传 children，保留标题和操作区，正文区域为空。' },
      { id: 'overflow', name: '长正文', description: '24 个占位内容块触发正文滚动，滚动时页头保持位置。' },
    ],
  },
  {
    id: 'theme-root', name: 'ThemeRoot', category: '主题', exportPath: './theme-root',
    description: '将一组主题变量传播到内部组件。', interaction: '切换右侧配色，观察按钮、文字和选中底色；嵌套模式检查主题隔离。', width: 640, height: 450,
    states: [
      { id: 'default', name: '主题传播', description: '同一 ThemeRoot 内的按钮复用当前颜色。' },
      { id: 'nested', name: '嵌套主题', description: '内层固定青绿，外层随调试台配色改变。' },
    ],
  },
  {
    id: 'color-swatches', name: 'ColorSwatches', category: '基础组件', exportPath: './color-swatches',
    description: '可复用的颜色预设与自定义弹窗入口，不包含设置页或保存逻辑。', interaction: '调整圆点直径、间距和组件宽高；点击加号打开取色弹窗，Esc 或点击外部关闭。', width: 520, height: 640,
    states: [
      { id: 'default', name: '标准圆点', description: '传入六个示例色；业务保存反馈不属于组件样例。' },
      { id: 'compact', name: '紧凑圆点', description: '28px 圆点；尺寸与间距继续通过右侧调节。' },
    ],
  },
];
