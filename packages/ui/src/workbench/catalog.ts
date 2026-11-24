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
  { id: 'document-list-item', name: 'DocumentListItem', category: '基础组件', exportPath: './document-list-item',
    description: '展示文稿类别、日期、标题、扩展名与两行摘要。', interaction: '点击整行，右键展开传入的操作。endContent 提供行尾状态或方向提示。',
    width: 320, height: 180, states: [{ id: 'default', name: '普通', description: '文稿列表项。' }, { id: 'selected', name: '已选中', description: '加深底色。' },
      { id: 'navigation', name: '行尾状态', description: '标题优先展示，行尾同时显示状态与导航图标。' }] },
  { id: 'document-quote-chip', name: 'DocumentQuoteChip', category: 'AI 对话组件', exportPath: './document-quote-chip',
    description: '显示文稿引用，悬停或聚焦时查看引用位置、修改要求和原文。',
    interaction: 'path 和 location 设置标签，text 和 comment 设置预览内容。有 onRemove 时可点击独立移除按钮。',
    width: 560, height: 320, states: [
      { id: 'draft', name: '可移除引用', description: '查看修改要求和原文，点击移除触发回调。' },
      { id: 'sent', name: '历史引用', description: '在浅色和深色模式下查看修改要求与原文。清空 comment 可预览仅有原文的情况。' },
    ] },
  { id: 'action-menu', name: 'ActionMenu', category: '基础组件', exportPath: './action-menu',
    description: '紧贴触发按钮显示一组操作，支持图标和危险操作。',
    interaction: '点击触发按钮展开，使用方向键选择，Enter 执行，Esc 或点击外部关闭。', width: 320, height: 240,
    states: [{ id: 'default', name: '操作菜单', description: '普通操作与危险操作共用同一菜单。' }] },
  { id: 'drawer', name: 'Drawer', category: '布局组件', exportPath: './drawer', description: '从右侧滑入的模态抽屉。',
    interaction: '点击打开，再用关闭键、遮罩或 Esc 退出。open 控制显示，title 设置标题，children 提供正文。桌面宿主中抽屉让出原生标题栏高度。', width: 760, height: 480,
    states: [{ id: 'default', name: '打开与关闭', description: '查看双向动效和背景遮罩。' }] },
  { id: 'notice', name: 'Notice', category: '反馈组件', exportPath: './notice', description: '在原位反馈操作结果。',
    interaction: 'tone 控制状态，children 提供提示文本。', width: 520, height: 220,
    states: [{ id: 'info', name: '信息', description: '普通状态。' }, { id: 'success', name: '成功', description: '操作完成。' }, { id: 'error', name: '失败', description: '可读屏的错误状态。' }] },
  { id: 'skeleton', name: 'Skeleton', category: '反馈组件', exportPath: './skeleton', description: '加载骨架屏先预留空间，超过 150 毫秒后显示带轻缓呼吸动效的灰色占位。',
    interaction: '通过 style 或 className 设置尺寸，lineWidths 设置段落各行宽度，外层区域标注 aria-busy。', width: 400, height: 200,
    states: [{ id: 'default', name: '文本行', description: '文本或列表行的占位。' }, { id: 'block', name: '内容块', description: '四行正文占位，末行收短。' }] },
  { id: 'disclosure', name: 'Disclosure', category: '布局组件', exportPath: './disclosure',
    description: '折叠一组可选内容。', interaction: 'label 设置标题，children 提供内容，defaultOpen 控制初始状态。用鼠标、Enter 或空格切换。', width: 520, height: 300,
    states: [
      { id: 'closed', name: '收起', description: '默认隐藏内容。' },
      { id: 'open', name: '展开', description: '初次显示内容。' },
      { id: 'card', name: '卡片内展开', description: '展开和收起时，卡片高度随内容平滑变化。' },
      { id: 'dialog', name: '弹窗内展开', description: '展开后弹窗随内容增长，达到高度上限后正文可滚动。' },
    ] },
  {
    id: 'settings-section', name: 'SettingsSection', category: '布局组件', exportPath: './settings-section',
    description: '设置分组：标题、可选说明、行间分隔与底部操作。', interaction: '调整 title / description；children 注入 SettingsRow，actions 注入底部按钮。示例交互只更新本地状态。', width: 820, height: 520,
    states: [
      { id: 'default', name: '多行组合', description: '三行设置以中性分隔线区分，底部操作靠右对齐。' },
      { id: 'without-description', name: '无分组说明', description: 'description 为空时不渲染说明段落。' },
      { id: 'narrow', name: '窄容器', description: '280px 容器检查说明及控件换行。' },
    ],
  },
  {
    id: 'settings-row', name: 'SettingsRow', category: '布局组件', exportPath: './settings-row',
    description: '设置行：名称、可选说明与右侧内容插槽。', interaction: '调整 title / description；children 提供控件或详情。切换样例查看 layout 的控件和等宽两列布局。', width: 820, height: 340,
    states: [
      { id: 'default', name: '开关行', description: '切换控件，检查布局稳定。' },
      { id: 'without-description', name: '无说明', description: '仅名称和控件。' },
      { id: 'colors', name: '选色控件', description: '复用 ColorSwatches，检查不同控件宽度。' },
      { id: 'columns', name: '两列详情', description: '说明与详情等宽并从顶部对齐。' },
      { id: 'narrow-columns', name: '窄容器详情', description: '空间不足时详情换到说明下方。' },
      { id: 'narrow', name: '窄容器', description: '280px 容器检查自动换行。' },
    ],
  },
  { id: 'manuscript-frame', name: 'ManuscriptFrame', category: 'Framework', exportPath: './manuscript-frame',
    description: '文稿目录与稿纸布局，窄时支持悬浮目录。', interaction: '选择文稿、切换编辑和预览、点击刷新，缩窄预览检查悬浮目录。',
    width: 740, height: 520, states: [{ id: 'default', name: '文稿', description: '目录与编辑、预览示例' }] },
  { id: 'document-editor', name: 'DocumentEditor', category: 'Framework', exportPath: './document-editor',
    description: '长文编辑、换行、选区与撤销。', interaction: '选择文字查看选区锚点回调，编辑并撤销，或切换只读状态。',
    width: 660, height: 420, states: [{ id: 'default', name: '编辑', description: '输入、选区及撤销' },
      { id: 'read-only', name: '只读', description: '可阅读和复制正文' }] },
  { id: 'image-viewer-frame', name: 'ImageViewerFrame', category: 'Framework', exportPath: './image-viewer-frame',
    description: '显示宿主提供的图片或空态。', interaction: '切换空态与图片，调整预览宽度核对图片比例。', width: 500, height: 380,
    states: [{ id: 'image', name: '图片', description: '适应可用宽度' }, { id: 'empty', name: '空态', description: '未提供图片' }] },
  { id: 'citation-sources-frame', name: 'CitationSourcesFrame', category: 'Framework', exportPath: './citation-sources-frame',
    description: '按编号列出网页引用并定位选中项。', interaction: '查看当前引用定位，打开原网页。', width: 520, height: 340,
    states: [{ id: 'default', name: '引用列表', description: '展示两条公开来源' }] },
  { id: 'file-changes-frame', name: 'FileChangesFrame', category: 'Framework', exportPath: './file-changes-frame',
    description: '文件修改列表、刷新反馈和差异承载区。', interaction: '展开示例文件查看差异，点击刷新检查回调。', width: 620, height: 440,
    states: [{ id: 'default', name: '文件差异', description: '一条可展开的修改' }] },
  ...formCatalog,
  {
    id: 'markdown-reader-frame', name: 'MarkdownReaderFrame', category: 'Framework', exportPath: './markdown-reader-frame',
    description: 'Markdown 只读阅读框架：文件信息、打开操作、独立滚动正文与固定状态栏；工具栏支持自定义。',
    interaction: '修改文件名、路径、Markdown 文本和工具栏插槽；打开与重试仅演示公开回调。',
    width: 860, height: 680,
    states: [
      { id: 'document', name: '阅读文档', description: '真实渲染样本文本，顶部文件栏和底部状态栏固定。' },
      { id: 'long', name: '长文档', description: '正文独立滚动，文件栏保持可见。' },
      { id: 'unopened', name: '尚未打开', description: '没有提供内容；打开按钮演示载入样本。' },
      { id: 'empty', name: '空文件', description: '空字符串表示已打开的空文档。' },
      { id: 'loading', name: '正在读取', description: '加载由调用方控制，状态栏尺寸固定。' },
      { id: 'error', name: '读取失败', description: '错误由调用方提供；重试示例恢复样本文档。' },
      { id: 'custom', name: '自定义工具栏', description: '调用方替换整条工具栏。' },
    ],
  },
  {
    id: 'browser-frame', name: 'BrowserFrame', category: 'Framework', exportPath: './browser-frame',
    description: '浏览器导航与内容承载框架：地址、历史、刷新/停止和状态通过 props 与回调管理，不访问网络。',
    interaction: '输入地址回车，尝试前进后退、刷新停止；示例使用本地内容模拟宿主，可替换工具栏。',
    width: 860, height: 620,
    states: [
      { id: 'ready', name: '已连接示例', description: '本地内容模拟网页和浏览历史。' },
      { id: 'empty', name: '空白页', description: '等待输入网址，回车提交导航意图。' },
      { id: 'loading', name: '正在载入', description: '刷新按钮原位变为停止，不重建网页区域。' },
      { id: 'error', name: '访问失败', description: '错误状态与刷新回调。' },
      { id: 'disconnected', name: '未连接', description: '保留地址草稿，禁用宿主操作。' },
      { id: 'custom', name: '自定义工具栏', description: '调用方替换整条导航栏。' },
    ],
  },
  {
    id: 'workspace-panel', name: 'WorkspacePanel', category: 'Framework', exportPath: './workspace-panel',
    description: '组合分屏、标签管理和可配置的功能入口卡片。',
    interaction: '搜索功能名称或关键词。选择卡片后在当前标签打开内容，收起面板后保留标签。',
    width: 960, height: 560,
    states: [
      { id: 'default', name: '多个功能', description: '展示按配置排列的三个入口。' },
      { id: 'limited', name: '单个功能', description: '只展示当前配置提供的入口。' },
      { id: 'feature-request', name: '定位功能标签', description: 'featureRequest 定位文档；手动和程序打开单实例功能时复用当前标签。' },
    ],
  },
  {
    id: 'workspace-tabs', name: 'WorkspaceTabs', category: 'Framework', exportPath: './workspace-tabs',
    description: '可关闭的内容标签框架：每页独立工具栏和滚动区，切换保留页面状态。',
    interaction: '新增、关闭和方向键切换标签；输入草稿后切换验证保留；空标签、多标签和不可关闭参数通过样例展示。',
    width: 860, height: 540,
    states: [
      { id: 'default', name: '独立页面', description: '两页各自输入和滚动，工具栏由调用方提供。' },
      { id: 'overflow', name: '标签溢出', description: '多个长标题横向滚动，操作区保持可见。' },
      { id: 'empty', name: '空工作区', description: '关闭全部标签后展示调用方空态，仍可新增。' },
      { id: 'fixed', name: '固定标签', description: '首个标签禁止关闭。' },
      { id: 'custom-page', name: '自定义页面框架', description: 'page 插槽自带工具栏、正文和底栏，外层不额外包滚动区。' },
    ],
  },
  {
    id: 'message-status', name: 'MessageStatus', category: 'AI 对话组件', exportPath: './message-status',
    description: '等待响应、生成失败和已停止的独立状态行；可选重试操作，固定占位防止状态切换挤动内容。',
    interaction: '右侧切换状态、错误说明与重试参数；点击或键盘触发异步重试，长错误悬停或聚焦查看全文。',
    width: 520, height: 240,
    states: [
      { id: 'waiting', name: '等待响应', description: '无正文时也展示等待状态，不提供重试入口。' },
      { id: 'failed', name: '生成失败', description: '失败说明与可选重试操作。' },
      { id: 'stopped', name: '已停止', description: '停止状态保持中性色，可由调用方允许重试。' },
      { id: 'no-retry', name: '不可重试', description: '没有回调时只展示失败状态。' },
      { id: 'retrying', name: '重试处理中', description: '宿主控制忙碌状态，阻止重复请求。' },
      { id: 'disabled', name: '重试禁用', description: '保留入口但不能触发。' },
      { id: 'retry-error', name: '重试请求失败', description: '回调拒绝后原位反馈并允许再次重试。' },
      { id: 'long-error', name: '长错误说明', description: '固定行内省略，悬停或聚焦查看全文。' },
      { id: 'hidden', name: '隐藏状态', description: '状态内容隐藏，保留 48px 行高。' },
    ],
  },
  {
    id: 'message-actions', name: 'MessageActions', category: 'AI 对话组件', exportPath: './message-actions',
    description: '回答原文复制与重新生成图标操作；成功、失败和忙碌反馈均保持原按钮尺寸。',
    interaction: '点击或键盘触发复制，检查剪贴板原文；重新生成演示异步回调并防止重复点击。右侧可编辑原文、回调与禁用状态。',
    width: 520, height: 320,
    states: [
      { id: 'default', name: '复制与重新生成', description: '复制 Markdown 原文；重新生成等待回调完成。' },
      { id: 'copy-only', name: '仅复制', description: '没有重新生成回调时只展示复制。' },
      { id: 'regenerating', name: '生成中', description: '生成期间禁止重新触发，仍可复制当前内容。' },
      { id: 'regenerate-disabled', name: '禁止重新生成', description: '单独禁用重新生成，复制仍可用。' },
      { id: 'disabled', name: '全部禁用', description: '保留两个操作的位置，但不允许触发。' },
      { id: 'empty', name: '空回答', description: '没有原文时禁止复制；重新生成仍由调用方决定。' },
      { id: 'failure', name: '回调失败', description: '点击重新生成后回调拒绝，在原按钮内反馈，支持重试。' },
    ],
  },
  {
    id: 'split-pane-layout', name: 'SplitPaneLayout', category: '布局组件', exportPath: './layouts/split-pane-layout',
    description: '与 PageLayout 同级、二选一的页面布局：左右分屏、拖拽调宽、关闭恢复，窄容器自动改为覆盖面板。',
    interaction: '拖动分隔条或用方向键调宽；关闭后重新打开恢复宽度。长内容两侧独立滚动；窄屏支持 Esc、焦点约束与恢复。',
    width: 1080, height: 680,
    states: [
      { id: 'open', name: '左右分屏', description: '主内容、面板内容与标题操作均通过插槽传入。' },
      { id: 'closed', name: '初始收起', description: '主区占满，点击打开右侧面板。' },
      { id: 'overflow', name: '独立滚动', description: '两侧长内容；关闭、重开与宽窄切换保留内容节点。' },
      { id: 'narrow', name: '窄容器', description: '容器宽 560px，面板使用覆盖层，关闭不影响主区宽度。' },
      { id: 'empty', name: '空内容', description: '两个内容插槽为空，保留标题和关闭操作。' },
    ],
  },
  {
    id: 'source-reference', name: 'SourceReference', category: 'AI 对话组件', exportPath: './source-reference',
    description: '网页与文件来源列表：编号、标题、域名或路径、摘要；详情展示完整内容及引用片段。',
    interaction: '点击条目或正文引用打开同一来源，Esc 关闭并恢复焦点。网页打开 HTTP(S) 链接，文件打开交给回调；右侧可编辑来源内容。',
    width: 760, height: 640,
    states: [
      { id: 'mixed', name: '混合来源', description: '网页与文件共用列表，通过来源 ID 打开详情。' },
      { id: 'web', name: '网页来源', description: '网站标题、域名、完整链接、摘要及引用片段。' },
      { id: 'file', name: '文件来源', description: '文件名、路径与片段；文件操作由宿主提供。' },
      { id: 'citations', name: '正文引用联动', description: 'C10 和列表通过相同 ID 打开同一份来源。' },
      { id: 'overview', name: '紧凑来源入口', description: '来源列表通过按钮在弹窗内打开。' },
      { id: 'long', name: '长内容', description: '长标题与路径换行、摘要两行，详情独立滚动。' },
      { id: 'invalid-link', name: '链接不可用', description: '非 HTTP(S) URL 保留为文本，不提供导航。' },
      { id: 'empty', name: '没有来源', description: '空列表不补造任何来源。' },
    ],
  },
  {
    id: 'citation-marker', name: 'CitationMarker', category: 'AI 对话组件', exportPath: './citation-marker',
    description: '嵌入正文的紧凑引用编号；来源名称通过提示层显示，点击回调交给调用方。',
    interaction: '悬停或聚焦查看来源名称；点击、Enter 或空格触发引用回调。示例用现有 Dialog 展示对应编号；可修改编号、来源名称、选中与禁用。',
    width: 760, height: 440,
    states: [
      { id: 'default', name: '单个引用', description: '编号与正文同行，来源名称不挤动段落。' },
      { id: 'multiple', name: '连续引用', description: '三个独立编号，按顺序参与键盘导航。' },
      { id: 'active', name: '当前来源', description: '调用方标记当前来源，仅改变颜色。' },
      { id: 'disabled', name: '不可用来源', description: '保留编号，禁用交互。' },
      { id: 'long-title', name: '长名称与多位编号', description: '完整来源名在浮层中换行，多位编号不截断。' },
    ],
  },
  {
    id: 'attachment-card', name: 'AttachmentCard', category: 'AI 对话组件', exportPath: './attachment-card',
    description: '发送前后共享文件类型图标、名称、大小和真实图片缩略图。',
    interaction: '文件打开通过回调交给调用方；图片支持实际预览。草稿样例可移除；状态样例原位切换处理中、失败和大小。',
    width: 860, height: 560,
    states: [
      { id: 'types', name: '文件与图片', description: '常用类型颜色、长文件名保留扩展名、真实 PNG 缩略图。' },
      { id: 'draft', name: '草稿移除', description: '删除按钮与打开按钮独立，已发送场景不传入删除。' },
      { id: 'status', name: '状态切换', description: '点击切换就绪、处理中、失败；卡片尺寸固定。' },
    ],
  },
  {
    id: 'user-message-bubble', name: 'UserMessageBubble', category: 'AI 对话组件', exportPath: './user-message-bubble',
    description: '右侧对齐的用户原文气泡，保留空格与换行；附件通过插槽组合。',
    interaction: '编辑原文或切换附件插槽，检查窄屏与长文本。文件使用共享卡片；图片直接展示真实缩略图并支持点击预览。',
    width: 860, height: 560,
    states: [
      { id: 'default', name: '短文本', description: '内容自适应宽度并靠右排列。' },
      { id: 'multiline', name: '多行原文', description: '保留输入的空行和缩进。' },
      { id: 'long', name: '长文本', description: '自然撑高，长路径和无空格文本自动换行。' },
      { id: 'literal', name: '字面内容', description: 'Markdown 与 HTML 按纯文本显示。' },
      { id: 'attachments', name: '文字与附件', description: '附件插槽与原文组合展示。' },
      { id: 'attachment-only', name: '仅附件', description: '保留附件区域，不补造文字或空气泡。' },
      { id: 'empty', name: '空内容', description: '正文与附件都为空时不占位。' },
    ],
  },
  {
    id: 'skill-item', name: 'SkillItem', category: '内容组件', exportPath: './skill-item',
    description: '技能展示条目：图标、名称、两行描述和可选诊断，宽度由父布局控制。',
    interaction: '编辑名称、描述与诊断，切换图标；用画布与组件宽度检查换行，不包含点击或后端操作。',
    width: 640, height: 440,
    states: [
      { id: 'default', name: '默认', description: '普通条目，无诊断。' },
      { id: 'warning', name: '诊断', description: '展示调用方提供的不可用原因。' },
      { id: 'long', name: '长描述', description: '描述截断为两行，title 保留完整文字。' },
    ],
  },
  {
    id: 'thinking-content', name: 'ThinkingContent', category: 'AI 对话组件', exportPath: './thinking-content',
    description: '单段公开思考文本或摘要；不承担整个 Agent 过程的阅读控制。',
    interaction: '编辑思考文本或模拟增量；内容自然撑高，空文本不显示。',
    width: 860, height: 640,
    states: [
      { id: 'default', name: '短内容', description: '展示公开思考文本。' },
      { id: 'long', name: '长内容', description: '自然撑高，不设置独立滚动区。' },
      { id: 'streaming', name: '流式思考', description: '模拟同一段思考增量。' },
      { id: 'empty', name: '无公开思考', description: '空文本不占位。' },
    ],
  },
  {
    id: 'tool-call-item', name: 'ToolCallItem', category: 'AI 对话组件', exportPath: './tool-call-item',
    description: '工具名称、操作摘要、状态和按原文展示的输入与结果。',
    interaction: '点击或键盘展开详情，状态与结果更新保留用户选择；回调记录展开状态。',
    width: 860, height: 640,
    states: [
      { id: 'default', name: '已完成', description: '展开输入与结果。' },
      { id: 'running', name: '进行中', description: '状态图标固定占位。' },
      { id: 'failed', name: '失败', description: '展开查看调用方返回的错误。' },
      { id: 'stopped', name: '已停止', description: '保留已接收结果。' },
      { id: 'empty', name: '空结果', description: '区分空字符串与没有返回结果。' },
      { id: 'long', name: '长结果', description: '原文换行，自然撑高，无内层纵向滚动。' },
      { id: 'no-details', name: '无详情', description: '没有输入和结果时不提供空展开入口。' },
      { id: 'visited-page', name: '访问网页', description: '展开详情查看访问页面并打开链接。' },
    ],
  },
  {
    id: 'file-change-summary', name: 'FileChangeSummary', category: 'AI 对话组件', exportPath: './file-change-summary',
    description: '汇总实际写入的文件和增删行数，提供统一的查看变更动作。',
    interaction: '单文件仅展示标题；多文件默认展示前三项，点击文件行触发 onOpenFile，查看变更触发 onViewChanges。',
    width: 580, height: 300,
    states: [
      { id: 'default', name: '单文件', description: '展示一个文件的变更与统计。' },
      { id: 'multiple', name: '多个文件', description: '展示摘要及更多文件入口。' },
    ],
  },
  {
    id: 'file-diff', name: 'FileDiff', category: 'AI 对话组件', exportPath: './file-diff',
    description: '根据带行号的差异块展示原文、新增、删除和未变更内容。',
    interaction: '展开或折叠未变更内容，横向滚动查看长行。label 参数提供可访问名称。',
    width: 560, height: 360,
    states: [
      { id: 'default', name: '编辑文件', description: '对比修改前后的行号与文本。' },
      { id: 'added', name: '新建文件', description: '只展示新增的行。' },
    ],
  },
  {
    id: 'tool-approval-card', name: 'ToolApprovalCard', category: 'AI 对话组件', exportPath: './tool-approval-card',
    description: '展示项目或小说文件操作、目标路径和变更预览。长预览限高滚动，底部保留决定按钮。',
    interaction: '允许一次或拒绝会原位更新状态，尺寸和按钮位置保持稳定。',
    width: 560, height: 340,
    states: [
      { id: 'default', name: '等待审批', description: '可点击允许一次或拒绝。' },
      { id: 'submitting', name: '正在提交', description: '等待决定写入，防止重复提交。' },
      { id: 'approved', name: '已允许', description: '本次操作已获授权，执行结果由过程区展示。' },
      { id: 'denied', name: '已拒绝', description: '保留审批结果。' },
      { id: 'expired', name: '已过期', description: '过期请求不可操作。' },
      { id: 'cancelled', name: '已取消', description: '请求随当前任务结束。' },
      { id: 'long', name: '长预览', description: '滚动正文并检查底部操作。' },
    ],
  },
  {
    id: 'question-card', name: 'QuestionCard', category: 'AI 对话组件', exportPath: './question-card',
    description: 'question 和 options 定义题目，onAnswer 接收单选、自填或跳过，onStop 可提供停止操作。',
    interaction: 'submitting 和 stopping 禁用作答，保持操作位置。',
    width: 560, height: 270,
    states: [
      { id: 'default', name: '等待回答', description: '选中一项或自填后发送，也可跳过。' },
      { id: 'submitting', name: '正在提交', description: '等待服务端确认答案。' },
      { id: 'stopping', name: '正在停止', description: '等待当前任务停止。' },
    ],
  },
  {
    id: 'execution-timeline', name: 'ExecutionTimeline', category: 'AI 对话组件', exportPath: './execution-timeline',
    description: '按发生顺序组合思考、说明、工具、步骤、重试和上下文整理等全部可见过程信息。',
    interaction: '统一定高滚动、展开全部和底部跟随；上翻或查看详情暂停跟随，最终回答自动折叠一次。',
    width: 860, height: 640,
    states: [
      { id: 'default', name: '混合过程', description: '思考、说明与工具按实际顺序穿插。' },
      { id: 'long', name: '长内容', description: '内部滚动或展开全部，恢复定高保留阅读位置。' },
      { id: 'streaming', name: '流式过程', description: '顺序追加与工具原位更新，支持暂停和上翻阅读。' },
      { id: 'no-thinking', name: '无思考模型', description: '无思考记录也能追踪完整工具过程。' },
      { id: 'events', name: '重试与整理', description: '普通事件呈现重试、上下文整理和步骤状态。' },
      { id: 'answering', name: '最终回答', description: '初始折叠，手动展开后不被后续更新收起。' },
      { id: 'completed', name: '已完成', description: '可以回顾整个执行过程。' },
      { id: 'stopped', name: '已停止', description: '停止流式效果，保留已有内容。' },
      { id: 'failed', name: '失败', description: '不补造错误或思考文本，保留已收到的内容。' },
      { id: 'empty', name: '空过程', description: '无记录不占位，可推进事件检查首次出现。' },
    ],
  },
  {
    id: 'agent-activity-header', name: 'AgentActivityHeader', category: 'AI 对话组件', exportPath: './agent-activity-header',
    description: '可拖动旋转的粒子、思考动画图标、状态与耗时；具体内容通过插槽组合。',
    interaction: '思考期间不可收起；进入最终回答后隐藏粒子与状态头部。示例只展开或收起插槽内容，不会重新显示 Header。',
    width: 960, height: 720,
    states: [
      { id: 'reading', name: '阅读', description: 'read 映射阅读中与书页。' },
      { id: 'writing', name: '编写', description: 'write 映射编写中与笔。' },
      { id: 'searching', name: '搜索', description: 'grep 映射搜索中与放大镜。' },
      { id: 'executing', name: '执行', description: 'powershell 映射执行中与机械臂。' },
      { id: 'thinking', name: '思考', description: '无工具阶段由调用方提供活动。' },
      { id: 'unknown', name: '未知工具', description: '未登记工具统一显示处理中。' },
      { id: 'long', name: '长执行过程', description: '组合 ExecutionTimeline；展开全部撑高右侧，粒子尺寸不变。' },
      { id: 'answering', name: '最终回答', description: 'Header 隐藏，整个执行过程可展开收起。' },
      { id: 'failed', name: '失败', description: '保持过程可见并停止粒子运动。' },
      { id: 'stopped', name: '已停止', description: '保留已有内容并停止粒子运动。' },
    ],
  },
  {
    id: 'primary-tabs', name: 'PrimaryTabs', category: '基础组件', exportPath: './primary-tabs',
    description: '一级内容 Tab，灰底白色滑块，支持面板关联、禁用项与受控选中值。',
    interaction: '点击或方向键切换标签与面板；示例可编辑选项文字和整体禁用，回调记录当前值。',
    width: 640, height: 360,
    states: [
      { id: 'default', name: '默认', description: '三项受控选择，方向键切换。' },
      { id: 'disabled', name: '整体禁用', description: '所有选项不可操作。' },
      { id: 'option-disabled', name: '禁用单项', description: '归档不可选，键盘跳过。' },
    ],
  },
  {
    id: 'code-block', name: 'CodeBlock', category: 'AI 对话组件', exportPath: './code-block',
    description: '独立代码块：语言标识、语法高亮、原文复制与横向滚动；Markdown 复用同一实现。',
    interaction: '修改右侧源码和语言，点击复制或键盘操作；长代码可双向滚动，流式示例可停止和重播。',
    width: 860, height: 680,
    states: [
      { id: 'default', name: 'TypeScript', description: '类型、函数和模板字符串高亮，复制保留原始源码。' },
      { id: 'python', name: 'Python', description: '注释、缩进和表达式高亮。' },
      { id: 'json', name: 'JSON', description: '对象、字符串、布尔值和数字高亮。' },
      { id: 'plain', name: '纯文本', description: '未指定语言，保留缩进、制表符和末尾换行。' },
      { id: 'unknown', name: '未知语言', description: '保留语言标识，源码按纯文本显示。' },
      { id: 'long', name: '长行与长代码', description: '横向和纵向滚动，工具栏保持可见。' },
      { id: 'empty', name: '空代码', description: '空内容保留结构并禁用复制。' },
      { id: 'streaming', name: '流式代码', description: '源码增量更新，停止保留片段，重播后完整显示。' },
    ],
  },
  {
    id: 'markdown', name: 'MarkdownRenderer', category: 'AI 对话组件', exportPath: './markdown',
    description: '流式 Markdown，含代码高亮、公式、Mermaid 与 ECharts 数据图表。',
    interaction: '右侧编辑 Markdown、模拟流式并选择水墨晕开、雾中凝字或柔光显影；代码可复制，图表可切换源码，数据图表支持悬停与图例交互。',
    width: 860, height: 820,
    states: [
      { id: 'default', name: '基础排版', description: '标题、列表、引用、表格与链接。' },
      { id: 'code', name: '代码块', description: '多语言高亮、复制和未知语言回退。' },
      { id: 'math', name: '数学公式', description: '行内公式、积分和矩阵。' },
      { id: 'mermaid', name: 'Mermaid 图示', description: '流程图与时序图，支持源码切换。' },
      { id: 'charts', name: '数据图表', description: '柱状图、折线图与饼图。' },
      { id: 'streaming', name: '流式回答', description: '模拟增量，默认水墨晕开；支持切换三种逐字渐现、停止和重新播放。' },
      { id: 'errors', name: '错误内容', description: '错误图表保留源码，正文持续可读。' },
    ],
  },
  {
    id: 'dialog', name: 'Dialog', category: '反馈组件', exportPath: './dialog',
    description: '通用模态弹窗，标题、说明、正文和底部操作由调用方传入。',
    interaction: 'Esc、关闭按钮或点击遮罩关闭；dismissOnBackdrop 为 false 时点击遮罩保留弹窗。焦点保持在弹窗内，关闭后返回触发按钮。',
    width: 720, height: 640,
    states: [
      { id: 'default', name: '打开', description: '展示基础内容和底部操作。' },
      { id: 'closed', name: '关闭', description: '点击触发按钮打开，检查焦点恢复。' },
      { id: 'overflow', name: '长内容', description: '正文独立滚动，标题和操作区保持可见。' },
      { id: 'form', name: '保留表单', description: '填写内容后点击遮罩，确认文字仍在。可以用取消、关闭或 Esc 退出。' },
    ],
  },
  {
    id: 'tooltip', name: 'Tooltip', category: '反馈组件', exportPath: './tooltip',
    description: '深色圆角提示气泡，带箭头、缩放与轻微摇摆；不改变触发元素外观。',
    interaction: '悬停或 Tab 聚焦显示，Esc 关闭；右侧修改文案、延迟或禁用提示。',
    width: 640, height: 360,
    states: [
      { id: 'default', name: '短提示', description: '默认在触发元素上方显示，空间不足时自动避让。' },
      { id: 'long', name: '长提示', description: '长文字在气泡内自动换行。' },
      { id: 'sections', name: '分段提示', description: 'content 可以传入包含标题与正文的说明内容。' },
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
        { id: 'top-layer', name: '跨越裁剪容器', description: 'topLayer 开启原生非模态顶层，面板可超出滚动容器，仍跟随触发器。' },
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
    id: 'cover-card', name: 'CoverCard', category: '基础组件', exportPath: './cover-card',
    description: '竖版封面卡片，支持叠加独立的透明操作按钮。',
    interaction: '通过 title、imageSrc、background 和 onOpen 设置封面与主操作，通过 actions 提供图标、标签和回调。悬停或键盘聚焦可显示操作。',
    width: 260, height: 364,
    states: [{ id: 'default', name: '封面与操作', description: '悬停、使用 Tab 或在触屏上查看操作按钮。' }],
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
    id: 'task-composer', name: 'TaskComposer', category: 'AI 对话组件', exportPath: './task-composer',
    description: 'LeiBox Deep Agent Composer 原版：附件、权限、上下文、模型选择与思考强度滑块。',
    interaction: '点击模型与权限胶囊体验形变展开；拖动思考滑块，悬停上下文环；选择附件或输入后发送，观察原版动画与回调。',
    width: 800, height: 540,
    states: [
      { id: 'default', name: '输入框', description: '切换浅色和深色，检查输入框的底色、阴影以及聚焦反馈。' },
      { id: 'busy', name: '生成中', description: '显示原版停止按钮，点击触发停止回调。' },
      { id: 'stopping', name: '停止处理中', description: '原版停止中加载状态，阻止重复点击。' },
      { id: 'disabled', name: '禁用', description: '通过原版 disabled 参数禁止组件交互。' },
      { id: 'no-models', name: '模型列表为空', description: '原版模型面板的空列表提示。' },
      { id: 'reset-draft', name: '原位重置草稿', description: '输入内容、添加附件后改变 draftKey，清空草稿但保留编辑器、模型与档位。' },
      { id: 'draft-context', name: '已有草稿资料', description: 'draftContext 显示在输入框内，hasDraftContext 为 true 时可直接发送宿主提供的资料。' },
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
    { "id": "unavailable", "name": "操作占位", "description": "置顶和归档分别通过禁用原因保留占位，条目仍能选择；右侧清空原因后恢复示例操作。" },
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
  "description": "分组标题使用开合文件夹表达展开状态，支持自定义图标。启用操作区后，右键标题可试用 contextMenu。",
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
  "description": "可折叠分组支持开合图标；内容缩进仅作用于条目内部，子项 hover 和点击覆盖整行。启用操作区后可右键标题打开菜单。",
  "interaction": "右侧修改公开参数，悬停、点击和键盘聚焦检查实际反馈；点击结果显示在回调记录。",
  "width": 400,
  "height": 320,
  "states": [
    {
      "id": "default",
      "name": "展开",
      "description": "独立组件的展开初始状态，右侧属性可继续调整。"
    },
    { "id": "loading", "name": "加载态", "description": "内容行保留高度，延迟显示灰色骨架。" },
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
      { id: 'loading', name: '加载态', description: '内容行保留高度，延迟显示灰色骨架。' },
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
    description: '统一滚动盒子，默认保留轨道占位，支持仅在溢出时留出空间。', interaction: '增减内容检查溢出前后的布局；悬停、Tab 聚焦、滚轮和方向键检查真实滚动，右侧可调整方向与显示方式。', width: 640, height: 520,
    states: [
      { id: 'vertical', name: '纵向滚动', description: '默认纵向，悬停或聚焦显示滑块。' },
      { id: 'horizontal', name: '横向滚动', description: '横向轨道始终占位，内容增减不改变可用高度。' },
      { id: 'both', name: '双向滚动', description: '两个方向均保留滚动空间。' },
      { id: 'short', name: '短内容', description: '内容未溢出，点击增加内容观察布局不跳动。' },
      { id: 'overflow-only', name: '按需占位', description: 'reserveScrollbarSpace 为 false，点击增加内容直至溢出，观察原生滚动条。' },
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
    id: 'desktop-title-bar', name: 'DesktopTitleBar', category: '布局组件', exportPath: './layouts/desktop-title-bar',
    description: '桌面窗口标题栏，展示应用名称、可拖动区域和原生窗口按钮的位置。',
    interaction: 'title 设置标题文字，style 可调整预览尺寸。切换主色和主题，悬停三个窗口按钮查看反馈。窗口操作在 Windows 桌面应用中验证。',
    width: 520, height: 180,
    states: [
      { id: 'default', name: '标准标题栏', description: '标题栏随主色变化，右侧三个图标模拟原生按钮的悬停反馈。' },
      { id: 'modal', name: '模态遮罩', description: '打开弹窗后观察标题栏和右侧按钮区域的蒙层。原生按钮的色值同步在 Windows 桌面应用中验证。' },
    ],
  },
  {
    id: 'global-layout', name: 'GlobalLayout', category: '布局组件', exportPath: './layouts/global-layout',
    description: '侧栏融入同色主题外壳，右侧保留白色内容卡片，弹性把手调节侧栏宽度。', interaction: '靠近中间显示把手；拖动调宽，越界阻尼并在松手后回弹。聚焦后方向键调整，Shift 加速，Home/End 到边界，双击或 Esc 恢复初始宽度。两侧独立滚动。', width: 1000, height: 600,
    states: [
      { id: 'content', name: '侧栏与正文', description: '通过 sidebar 和 children 注入样例内容。' },
      { id: 'flat', name: '平铺双栏', description: 'variant="flat" 去掉外壳留白和正文圆角，单侧分隔线区分侧栏；保留调宽和独立滚动，gap 不生效。' },
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
