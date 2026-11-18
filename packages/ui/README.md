# 通用组件库

这里只维护通用框架标准、基础控件及实际多处复用的卡片/功能组件。具体页面、品牌导航、一次性业务展示及保存反馈在应用内就近组合，不作为库组件登记；不提前创建没有调用方的抽象。

当前公开组件：Button、ScrollBox、Sidebar 及七个独立侧栏组件、AsciiOcean、ColorPicker、ColorSwatches、GlobalLayout、PageLayout、ThemeRoot。组件通过 props 接收内容、尺寸及操作，不依赖应用状态或后端实现。

## Sidebar 侧栏组件

从 `@plotloom/ui/sidebar` 导入 `Sidebar`。七个独立组件分别通过 `@plotloom/ui/sidebar/nav-item`、`session-item`、`settings-item`、`group-header`、`group`、`section`、`action-button` 子路径导入。业务侧栏由应用组合，组件内部不请求小说或会话接口。

- `Sidebar`：按 `header`、`fixNavItems`（固定导航）、滚动内容区、`footer` 排列。滚动区内依次为 `navItems`（普通导航）和 `groups`（外层分类集合），共用一个 ScrollBox。可选插槽不传则不占空间；支持 `label`、`className`、`style`，默认高度 100dvh，嵌入时设置有界高度。旧固定内容及混合 children 参数已直接移除，无兼容分支。
- 侧栏根节点统一提供四周 8px padding，header、固定导航、body、footer 均不再提供 padding。header 到 body 连续排列，有无固定导航都不加 margin；footer 上方用 8px margin，普通导航与分类之间、相邻分类之间用 12px margin 分隔。条目按钮内部的文字留白仍由各控件维护。
- 外层分类标题与内层分组标题使用 `--pl-primary-subtle` 作为 hover／按下背景，覆盖整行；标题按钮不叠加普通 ghost 的灰色反馈。点击留下的焦点不维持整行高亮，鼠标离开立即恢复，键盘焦点提示由 Button 提供。禁用标题时不显示整行 hover。
- `SidebarSection`：外层分类，接收 `label`、`expanded`、`onExpandedChange`、`actions`、`children`、`disabled`、`className`、`style`。标题右侧箭头控制整个分类；操作按钮与标题并列，独立触发。收起使用 hidden 隐藏整类内容并退出键盘导航，保留内部状态。`disabled` 仅禁用标题切换，操作插槽由调用方控制。
- `SidebarGroup` 和 `SidebarSection` 均支持 `contentState="ready | empty | error"`（默认 ready）。ready 渲染 children，empty 用灰色显示 `emptyText`（默认“暂无聊天”），error 用红色显示 `errorText`（默认“加载失败”）；异常／空态替代内容，不影响标题和折叠。状态由业务显式传入，不根据 children 数量猜测。提示为不可点击的纯文本，无 hover、边框或选中态，长文案自然换行；内层分组跟随 indent 缩进。调试台提供独立样例和状态、文案控件。
- 项目、小说、最近只是调用方选择的分类名称，不是写死的组件类型。例如项目分类内放多个 `SidebarGroup`，每组再放对话；最近分类可直接放多个 `SidebarSessionItem`。外层分类与内层分组各自控制展开，均不创建额外滚动区。`SidebarGroup` 不带顶部 margin 或 padding。
- `SidebarNavItem`、`SidebarSettingsItem`：`label`、`icon`、`active`、`disabled`、`actions`、`onClick`。标题单行省略，并通过原生 title 提供完整文字；操作区固定占位，悬停或聚焦显示，触屏常显。没有路由依赖，调用方负责响应点击。
- `SidebarSessionItem`：保留 `label`、`active`、`disabled`、`onClick`，不再提供左侧 `icon` 和省略号 `actions`。`timeLabel` 接收相对时间文案（如“3 分钟前”“2 天前”）；`status` 为 `running / unread / failed` 或不传，分别展示正在进行、已完成未查看、失败。`pinned` 与 `onPinnedChange` 控制置顶，`onArchive` 通知归档；未传操作回调时不显示对应按钮。组件不排序、不移除会话、不调用业务接口。
- 会话元数据平时叠放，悬停或焦点进入时向左展开，离开后收起；触屏常展开，减少动态效果时取消动画。工具栏覆盖标题，标题宽度不变、不产生省略号；左侧用文字渐隐露出真实背景，自动匹配主题与侧栏渐变。状态、时间和操作均无独立底色，顺序为状态、时间、置顶、归档；成功图标绿色、失败图标红色。行宽不超过 280px 时状态缩为图标并保留完整提示。按钮与标题同级，操作不触发打开会话。交互参考 LeiBox `stacked-metadata`（设计参考 Gabriel），按现有主题与 Button 重写，不引入演示字体和场景代码。
- `SidebarGroup`：`label`、`collapsedIcon`、`expandedIcon`、`expanded`、`onExpandedChange`、`actions`、`children`。点击标题只切换展开状态，不打开工作台；收起时子项隐藏并退出键盘导航。新增操作放在 actions 中，和标题按钮同级，不触发折叠。
- 每个条目支持 `rowHeight`、`indicatorWidth`、`indicatorHeight`、`style` 和 `className`；功能、设置条目另支持 `gap`、`iconSize`。各组件具有独立 TSX/CSS 文件，共用内部行机制以保持交互一致。
- `SidebarGroupHeader` 不再显示展开箭头或单一 `icon`；默认收起显示 Folder、展开显示 FolderOpen。业务通过 `collapsedIcon`、`expandedIcon` 传入 ReactNode，例如 `<Book />` / `<BookOpen />`，或 `<img src={uploadedIconUrl} alt="" />`；上传与资源地址由业务管理，组件只渲染。传 null 隐藏对应状态图标。`iconSize` 同时约束 SVG 和图片，`aria-expanded` 保留展开状态语义。
- `SidebarGroupHeader` 支持 `contentId` 关联外部内容；`SidebarGroup` 组合它与 children，`indent` 只改变内部条目的文字、图标缩进，不缩窄整行。子项左侧留白同样响应 hover 和点击，背景与分组标题对齐。两者支持行高、间距和图标尺寸。调试台可切换默认文件夹与业务传入书籍图标。
- `SidebarActionButton` 接收必填 `label`、`icon`，以及 Button 的尺寸、禁用、加载、危险和点击参数；透明反馈复用底层 Button。
- 调试台「侧栏组件」提供八个独立入口，七个原子/分组/分类组件可单独调参，Sidebar 用于验证整体组合。
- 图标插槽使用项目 Lucide 图标；空态和异常态由调用方通过状态参数指定。选中只标识当前目的地，不自动将所属分组也标为选中。
- 侧栏背景从左上到右下渐变，读取 ThemeRoot 的用户主色，与白底混合为 12% 到 2% 的浅色渐变；品牌、固定入口、滚动区与底部共用连续背景。调试台的预设及自定义配色实时生效，不需要独立维护侧栏颜色状态。
- 调试台提供嵌套分类、选中、收起、空内容、长标题、长列表和固定功能入口样例；新聊天位于 fixNavItems，普通功能页位于 navItems，项目、小说、最近分类位于 groups。会话独立预览另提供已完成未查看、失败、已置顶样例，可修改时间、状态、置顶与操作显隐。新增、置顶、归档和新聊天只验证回调，不代表真实业务能力。

## 统一滚动容器

后续新增或修改需要滚动的内容区域，统一复用 `@plotloom/ui/scroll-box` 的 `ScrollBox`，不再各自实现滚动条显隐样式。当前已有区域本轮不批量迁移。

```tsx
import { ScrollBox } from '@plotloom/ui/scroll-box';

<ScrollBox style={{ height: 320 }} aria-label="内容列表" role="region">
  {children}
</ScrollBox>
```

- `orientation`：`vertical`（默认）、`horizontal`、`both`。
- `scrollbarVisibility`：仅实际溢出时生效；`auto`（默认，悬停或焦点进入时显示）、`always`（始终显示可用滑块）。未溢出时滑块和箭头保持透明，悬停、聚焦也不显示；内容增减、折叠与尺寸变化时自动更新。
- 支持原生 div 属性、`children`、`className`、`style`、`onScroll` 和指向实际滚动元素的 `ref`；默认 `tabIndex=0`，支持键盘滚动。
- 调用方约束相应方向的尺寸；自动高度会随内容展开。滚动方向与占位由组件控制，不通过 `style.overflow` 改写。
- 原生滚动机制始终开启，显隐只改变颜色，不改变占位；系统覆盖式滚动条的外观由浏览器管理，同样不会因内容溢出挤压布局。
- 调试台提供空内容、短内容、横向、纵向、双向样例及内容增减按钮，用于验证溢出前后尺寸稳定。

- ColorSwatches 接收 `presets`、`color/onChange`、`label`、`swatchSize`、`gap`；可用 `feedback` 插槽在入口与弹窗内展示调用方反馈。
- GlobalLayout 接收侧栏与正文插槽及弹性调宽参数，见下方说明；PageLayout 的一级页面布局参数见下文。
- 组件根元素支持 `style`，尺寸调整通过公开属性生效。调试台分别设置画布与组件尺寸，详见 `docs/ui-demo.md`。
- 原 SettingsNavigation 与 ThemeSettings 已按用户确认直接替换，无兼容导出。

## AsciiOcean 字符海洋背景

从 `@plotloom/ui/ascii-ocean` 导入。只包含鲨鱼与鱼群 Canvas 背景，默认浅底，保留参考中的四种鲨鱼、群游、捕食和摆尾。移动指针触发避让，点击水面使鱼群惊散并产生水波；聚焦画布后按 Enter 在中心制造水波。

```tsx
import { AsciiOcean } from '@plotloom/ui/ascii-ocean';

<AsciiOcean style={{ height: 600 }} paused={false} speed={1} />
```

- `style`、`className`：设置背景容器。默认宽高均为 100%，父容器须有确定高度，也可通过 style 指定高度；背景不会自行覆盖页面。叠加业务内容时，由应用在同一定位容器内组合前景层，前景按钮保持自己的交互。
- `paused`：默认 false。暂停不重建场景，恢复后继续游动；仍可点击产生静态水波。
- `speed`：默认 1，范围 0.25—2；仅调整模拟时间，不重建鱼群。
- `onSplash({ x, y })`：鼠标点击或 Enter 触发水波后通知调用方，坐标为组件内的 CSS 像素。
- 系统开启减少动态效果时保持静态；页面隐藏、背景离屏时停止动画，重新可见后继续。卸载释放动画帧、监听器、观察器和画布缓冲区。
- 字体随组件打包，不需要外部网络。原始固定版本引擎来自用户提供的 `ascii-ocean.html`，原作者及 MIT/OFL 声明保留在 `src/ascii-ocean/vendor`；不包含水母、自定义图片或示例页面 UI。

调试台在「背景组件 → AsciiOcean」提供游动和暂停两个样例、速度控制及点击坐标反馈。该背景采用参考配色，不随调试台主题色改变。

## PageLayout 一级页面布局

从 `@plotloom/ui/layouts/page-layout` 导入。顶部左侧显示 `title`，右侧 `actions` 接收调用方组合的按钮；正文通过 `children` 传入。页头位于滚动区域外，正文复用 ScrollBox 独立滚动，不新增 main 标签。

- `title?: string`：页面标题，不提供描述区。
- `actions?: ReactNode`：右侧操作区；标题和操作均未提供时不渲染页头。
- `maxWidth?: number`：正文最大宽度，默认 1200px，居中；窄屏撑满扣除内边距及滚动条占位后的可用宽度。
- `padding?: number`：页头和正文内边距，默认 24px。
- `gap?: number`：正文直接子项的纵向间距，默认 24px。
- `style?: CSSProperties`：根元素样式。默认高度为 100dvh；嵌入其他容器时设置具体高度，或在父容器高度确定时设置 `height: '100%'`。保持有界高度才能实现正文内部滚动。

```tsx
<PageLayout title="作品" actions={<Button onClick={onCreate}>新建作品</Button>}>
  {children}
</PageLayout>
```

## 图标使用约定

本项目统一使用 Lucide。React 组件在 `packages/ui` 内按名称导入 `lucide-react`；原生接口试验台通过 `@plotloom/ui/icons/dom` 使用同一图标体系，不引入 React 渲染运行时。

- 新增图标先在 https://lucide.dev/icons 按业务含义和同义词查找，再核对已安装版本的真实导出名；不得猜测名称。
- 不使用字符、emoji 或手写 SVG 替代库内已有图标，不混用其他图标库。正常文字、公式、尺寸乘号及品牌文字不受影响。
- 静态按需导入，不导入全量 `icons` 或动态加载整个图标库；原生入口只登记实际调用的图标。
- 保持 2px 描边、继承文字颜色。常规图标 16px，主题色按钮 20px、关闭按钮 18px、紧凑色块勾选 12px。
- 装饰图标隐藏于辅助技术；纯图标按钮必须提供中文 `aria-label`，状态图标必须有可读的状态说明。
- 图标使用与样式在组件库维护；页面负责组合组件，不另建图标实现。

当前语义：选中使用 `Check`，添加使用 `Plus`，关闭使用 `X`，发送使用 `ArrowUpRight`，流程使用 `ArrowRight`，提示使用 `Info`，响应空状态使用 `Braces`，会话标识使用 `Hash`，检查失败使用 `CircleAlert`，加载使用 `LoaderCircle`。

## Button


从 `@plotloom/ui/button` 导入，现有 `primary / subtle / ghost` 调用继续有效。

| 属性 | 可选值 / 含义 |
| --- | --- |
| `variant` | `primary` 主按钮（默认）、`secondary` 中性次按钮、`subtle` 浅主题底、`ghost` 透明、`text` 紧凑文字、`link` 链接外观 |
| `size` | `sm / md / lg`，默认 `md`，最小高度分别为 32 / 40 / 48px |
| `danger` | 独立危险配色，可与六种类型组合 |
| `disabled` | 原生禁用，不响应鼠标或键盘激活 |
| `loading` | 由调用方控制，显示加载图标和 `aria-busy`，禁用操作；原内容保留占位与可访问名称，切换不改变尺寸 |
| `startIcon / endIcon` | 前后图标插槽，图标作为装饰隐藏于辅助技术；项目内使用 Lucide |
| `iconOnly` | 方形纯图标按钮，图标放入 `children`，调用方必须提供中文 `aria-label` |

支持原生按钮属性、事件、`ref`、`className` 和 `style`；默认 `type="button"`，表单提交显式设置 `type="submit"`。`variant="link"` 仅改变外观，仍是按钮，不提供 `href`；真实链接导航使用原生链接语义。

加载状态不会自动管理请求或计时；由调用方在操作结束后恢复。减少动态效果偏好下停止加载旋转。无完整边框，聚焦通过阴影提示。

调试台 Button 默认同页展示全部类型与常规、危险、禁用、加载状态，以及三档尺寸和图标组合；顶部「交互试用」接受右侧全部属性控制。总览滚动复用 ScrollBox。

## GlobalLayout 弹性卡片布局

直接替换原固定列布局，不保留旧版模式。外层使用与 Sidebar 一致的主题浅色渐变，左侧透明融合到外壳，只保留右侧白色圆角内容卡片。嵌入 Sidebar 时通过背景变量关闭重复渐变，避免出现接缝；独立 Sidebar 仍显示原主题渐变。用背景与 16px 外层内边距区分层级，不嵌套完整边框。默认高度为 100dvh，可用 style 设置有界高度。

- `sidebar` / `children` 分别注入左侧栏和右正文；右侧为唯一 main，两侧使用 ScrollBox 独立滚动。
- `sidebarWidth` 是初始及重置宽度，默认 256px；改变此参数会重新设置宽度。`minSidebarWidth` / `maxSidebarWidth` 默认 180 / 440px，按有效的非负最小、最大宽度传入。
- `gap` 默认 20px，最小 16px 以保留把手操作空间；改变间距或宽度边界会按初始宽度重新布局。`contentPadding` 设置正文滚动容器内边距，默认 0。
- 靠近分隔区显示把手，拖动调整侧栏；把手沿拖动方向弯曲，越界最多约 15px 阻尼拉伸，松手回到合法边界。触屏保持把手可见；减少动态效果偏好下不弯曲或弹性拉伸。
- 聚焦后左右键每次调整 8px，Shift 加速到 32px；Home / End 到边界；双击或 Esc 恢复初始宽度，拖动中 Esc 或 pointercancel 恢复拖动前宽度。
- 容器变窄时自动收缩侧栏范围，优先保留右侧空间，两列不换行；不自动持久化拖拽结果。
- 嵌入自带滚动的 PageLayout / Sidebar 时设置 `style={{ height: '100%' }}`，使其适应卡片内部高度；正文页头继续由 PageLayout 管理。
- 动效根据 LeiBox Elastic Panel Resize 的独立 DOM/SVG 实现适配到真实布局；设计参考 Alvish，来源及署名保留在 `src/layouts/use-elastic-sidebar.ts`。未引入演示场景运行时或额外依赖。
