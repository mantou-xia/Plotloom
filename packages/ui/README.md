# 通用组件库

## Tooltip 提示气泡

从 `@plotloom/ui/tooltip` 导入 `Tooltip`：

```tsx
<Tooltip content="保存当前内容"><Button onClick={save}>保存</Button></Tooltip>
```

`content` 为纯文字；`children` 为单个可聚焦元素，自定义组件须透传 ref、事件及 ARIA 属性。
`delay` 为悬停延迟毫秒数（默认 0），`disabled` 仅禁用提示。空白内容不显示。
`className`、`style` 作用于气泡。气泡默认上方显示，通过 Portal 避免滚动容器裁剪，空间不足自动避让。
支持悬停、键盘聚焦、移入气泡保持阅读及 Esc 关闭；减少动态效果偏好下关闭动画。
深色圆角、箭头、缩放与摇摆参考 Uiverse 的 gharsh11032000 / spotty-zebra-83；不包含参考按钮的文字切换。
`shake` 控制出现时是否晃动，默认 `true`；设置 `shake={false}` 关闭晃动，仍保留缩放和淡入淡出。系统减少动态效果偏好优先于此参数。
调试台「反馈组件 → Tooltip」可检查短文字、长文字、禁用、延迟及晃动开关。

这里只维护通用框架标准、基础控件及实际多处复用的卡片/功能组件。具体页面、品牌导航、一次性业务展示及保存反馈在应用内就近组合，不作为库组件登记；不提前创建没有调用方的抽象。

当前公开组件：Button、Card、ToastViewport、TaskComposer、MorphingPopover、ScrollBox、Sidebar 及七个独立侧栏组件、AsciiOcean、ColorPicker、ColorSwatches、GlobalLayout、PageLayout、ThemeRoot。组件通过 props 接收内容、尺寸及操作，不依赖应用状态或后端实现。

## Toast 操作提示

在应用 ThemeRoot 下挂载一个 `ToastViewport`（来自 `@plotloom/ui/toast`），工具函数从 `@plotloom/ui/toast/utils` 导入。

- `toast.success/error/info/loading(message, { id?, duration? })` 返回消息 id；相同类型和内容自动合并并计数，传相同 id 则原位更新。duration 单位毫秒，0 不自动关闭；成功/信息默认 3500，错误 6000，处理中 0。
- `toast.promise(() => Promise, { loading, success, error? })` 在同一条提示上更新结果；success 可根据返回值生成文案，error 可根据错误生成文案。返回原结果，失败继续抛出；AbortError 静默撤销。调用方须处理拒绝。
- `toast.dismiss(id)` 带退出动画关闭；`toast.clear()` 立即清空。已关闭的异步操作完成时不重新弹出。
- 右上角最多显示 3 条，其他先进先出排队；退出结束后补位，排队不计时。悬停或键盘聚焦暂停计时；内容更新重新计时。进入、退出及队列补位使用 180ms 动效，尊重减少动态效果偏好。
- `createToastStore()` 创建独立实例，传给 `<ToastViewport store={store} />`；适用于调试台隔离。一个实例仅挂载一个视口。
- 原生模态弹窗打开时视口自动挂载到弹窗内，避免被顶层遮挡；弹窗关闭恢复全局显示，切换挂载位置时可见提示重新计时。
- 普通导航、后台请求成功不提示；页面加载、空态及聊天生成状态保留。业务请求在操作层包裹，不能在 Button 和 HTTP 层再次弹出重复提示。当前产品通过 `apps/web/src/utils/feedback.ts` 的 `runWithToast` 返回 `{ ok, value? }`，避免按钮产生未处理拒绝；后台失败使用 `notifyRequestError`。
- Toast 按具体功能选择接入，不覆盖所有按钮。创建对话、发送消息、生成完成及停止生成不弹处理中或成功提示，只在失败时使用 `notifyRequestError`；新建业务对象、删除、保存等功能操作可使用完整操作提示。

```tsx
import { ToastViewport } from '@plotloom/ui/toast';
import { toast } from '@plotloom/ui/toast/utils';

<ToastViewport />
toast.success('保存成功');
// 有业务恢复逻辑时，捕获 promise 拒绝；请求本身不弹提示。
await toast.promise(() => save(), { loading: '正在保存…', success: '保存成功' });
```

调试台「反馈组件 → ToastViewport」可编辑内容、类型、时长，验证并发、重复消息与异步成功/失败。

## Card 通用卡片

从 `@plotloom/ui/card` 导入 `Card`，通过 `children` 组合内容。

- `material`：`normal`（默认）或 `liquid-glass`；后者折射卡片背后的真实页面内容，内部文字和控件保持清晰。
- `borderRadius`：默认 8px，与基础控件圆角一致；支持数字（px）或 CSS 长度。
- `padding`：默认 12px，支持数字（px）或 CSS 简写。
- `backgroundColor`：默认 `#ffffff`，支持 CSS 颜色值；普通材质直接填充，液态玻璃取 10% 作为染色。
- `bordered`：默认 `false`；开启后使用 1px 中性灰实线，无阴影。

支持原生 div 属性、`ref`、`className`、`style`；公开外观参数优先于 style 中对应样式。调用方用背景差异和间距区分嵌套层级，不在带完整边框的父容器下直接放置带边框的 Card，也不为带边框的 Card 添加完整边框子项、阴影或 outline。

```tsx
import { Card } from '@plotloom/ui/card';

<Card>默认卡片内容</Card>
<Card borderRadius={16} padding={20} backgroundColor="#f8fafc" bordered>自定义卡片内容</Card>
<Card material="liquid-glass" borderRadius={32} padding={24}>液态玻璃卡片内容</Card>
```

液态玻璃使用 `backdrop-filter` 与按尺寸生成的 SVG 位移图，只生成光学贴图，不截图、不复制页面内容、不要求背景图片。Chrome / Edge 等 Chromium 引擎启用折射；Firefox / Safari 等其他引擎采用透明模糊玻璃。背景必须在卡片后方可见；纯色背景无法显现折射，祖先的 opacity、filter、mask 或 backdrop-filter 可能限制浏览器可采样的背景范围。四角一致的圆形圆角效果最佳，复杂椭圆/不同角简写的折射模型按左上角近似。

尺寸改变时更新位移图；滚动和背景内容更新无需重建。切回普通材质或卸载时清理观察器和动画帧。系统开启减少透明度或强制颜色时关闭透明滤镜，恢复实色。模型来自用户提供的 `liquid-glass.html`，原作者 MIT 许可保留在 `src/card/LICENSE-liquid-glass.txt`。

调试台「基础组件 → Card」提供默认、带边框和液态玻璃样例，五个参数可实时调整。液态玻璃样例将卡片覆盖在真实文字、色块上，点击「移动背后内容」可检查实时采样和前景按钮交互。

## TaskComposer 提示词输入框

从 `@plotloom/ui/task-composer` 导入 `TaskComposer`、`TaskComposerOptions` 和 `ComposerMessage`，使用 `<TaskComposer options={options} className="..." />`。按用户 2026-11-19 的明确要求保留 LeiBox 原版布局、字体、胶囊形变、滑块和附件动效。菜单共用 `MorphingPopover`；引擎及类型声明补充宿主数据和异步回调，上游与本地校验值分别记录于 `src/task-composer/original/source.json`。

| options 参数 | 含义 |
| --- | --- |
| `models / modelLabels / selectedModel / onModelChange` | 唯一模型 ID 列表、展示名称、当前模型；异步回调成功后更新选择。 |
| `modelNames` | 按模型 ID 提供纯模型名，收起按钮只显示此名称；菜单仍使用 modelLabels 区分提供商。省略时沿用原标签。 |
| `value / thinkingOptions / onValueChange` | 当前思考档位、实际可用档位及标签、异步保存；value 不是草稿。 |
| `busy / stopping / onStop` | 生成与停止状态及回调。 |
| `disabled / reducedMotion` | 禁用交互、减少动态效果；动态效果默认遵循系统设置。 |
| `height` | 展示区域建议高度，默认 600px；正式聊天传 0 随内容布局。 |
| `permissionOptions / onPermissionChange` | false 隐藏权限演示菜单；选择回调不授予真实权限。 |
| `advancedMentions` | false 隐藏计划/目标等未实现的演示入口。 |
| `projectPath / onSearchFiles` | 项目标识及异步文件候选搜索；组件不访问本机文件。 |
| `skills` | 当前可选择技能的 id、name、description；支持 @ 与 / 菜单。 |
| `context` | tokens（null 表示待估算）及 contextWindow。 |
| `attachmentAccept / maxAttachments` | 文件选择类型与附件数量上限。 |
| `onAttachmentUpload / onAttachmentRemove` | 上传接收 name、mimeType、base64 data，返回服务端 id/size；移除接收服务端 ID。错误附件阻止发送，可移除后重传。 |
| `onSubmit` | 接收 text、model、thinking、attachments、skills、mentions、permission；false 或抛错保留草稿，异步宿主在服务端 accepted 后返回 true 才清空。 |

原版内部管理草稿、临时附件和引用标记；通过回调注入真实业务数据，不依赖接口地址、Pi SDK 或应用状态。没有上传回调时仍可供组件调试台本地演示，不能当成后端上传。正式聊天由 `apps/web/src/features/agent/chat-composer.tsx` 完成公开协议适配，`composer-request.ts` 将标记还原为文字并发送真实附件/技能 ID。纯类型可从 `@plotloom/ui/task-composer/types` 导入，避免 Node 数据转换测试依赖 JSX 入口。后端能力清单见 `docs/task-composer-backend-adaptation.md`。

调试台提供原版、生成中、停止中、禁用、无模型和减少动态效果六种样例，并记录公开回调。正式聊天已替换旧简易输入框，保留组件原版视觉和动效。

来源：https://leibox.pantoria.cn/docs/animations/deep-agent-composer 。保留源码声明，来源许可说明见 `original/source.json`。依赖按原版清单安装；Shadow DOM 隔离原版样式，避免影响其他组件。本组件按本次用户指令保留原版视觉细节；不改写项目全局边框规范。

## MorphingPopover 按钮形变面板

从 `@plotloom/ui/morphing-popover` 导入。直接提取 LeiBox `MorphingMenuShell` 的形变逻辑，TaskComposer 的模型和权限菜单均共用此实现。按钮内容和面板内容由调用方组合，不依赖模型、权限或后端。

```tsx
import { useState } from 'react';
import { Button } from '@plotloom/ui/button';
import { MorphingPopover } from '@plotloom/ui/morphing-popover';

function ToolPicker() {
  const [open, setOpen] = useState(false);
  return <MorphingPopover open={open} onOpenChange={setOpen} label="工具选择" panelWidth={264}
    trigger={props => <Button {...props} variant="secondary">工具</Button>}>
    <div style={{ padding: 12 }}>
      <Button variant="ghost" onClick={() => setOpen(false)}>完成选择</Button>
    </div>
  </MorphingPopover>;
}
```

- `open / onOpenChange`：受控开关；外部点击或 Escape 请求关闭。选择完成时由调用方关闭。
- `trigger / children`：触发器和任意面板内容。推荐 trigger 渲染函数，将其属性透传给 Button，获得点击切换与展开语义；普通 ReactNode 需自行连接开关及 ARIA 属性。
- `panelWidth`：数字像素或 CSS 长度；不传时按内容尺寸。`panelAlign` 为 `left / right`（默认 left），`panelPlacement` 为 `above / below`（默认 above）。以触发器底边或顶边为锚点，浮层限制在宿主视口内，内容过高时内部滚动。
- `label`：面板的可访问名称，默认“功能面板”。`className / style` 作用于容器，`panelClassName` 作用于内容层。
- `reducedMotion`：不传时遵循系统偏好。`staggerContent` 对内容中的 `[data-menu-item]` 或 `[role=menuitem]` 使用原版交错动画。普通选项无需自行设置 menuitem 角色。
- `triggerLayout="block"` 支持铺满的触发器，默认 inline；`panelShadow / zIndex` 默认原版阴影及 50；`unstyled` 仅关闭内容层底色，外壳仍绘制表面；`layoutId` 用于标记动画节点。

保留原版宽高独立弹簧、模糊与收回时序，动态内容重新测量；关闭动画结束后卸载面板，卸载清理动画和监听。普通 DOM 和 TaskComposer 的 Shadow DOM 使用同一份样式与上下文。面板为非模态浮层，不锁定页面焦点；父级应留出可见空间，避免 overflow 裁切。

调试台「反馈组件 → MorphingPopover」提供向上、向下、右对齐、减少动态效果、自定义内容与收起状态六种样例。除收起状态外，切换后直接显示面板；通过“收起预览”后再展开或点击真实按钮体验形变。下方提供 trigger / children / open 的组合步骤和可复制的最小组件代码，代码跟随样例及面板宽度更新。自定义内容样例展示同一外壳可容纳说明、分栏和操作按钮，后续扩展对话框工具时替换按钮和 children 即可，无需复制动画实现。

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

## 通用表单组件

所有组件与样式在 `src/form` 维护。调试台「表单组件」提供九个独立入口、参数编辑与提交/重置示例。浅灰背景、8px 圆角、无完整边框；`size="sm | md | lg"` 对应 32 / 40 / 48px 输入高度。下拉弹层、勾选标记和开关滑块带轻微回弹，遵循系统减少动态效果设置，键入时不缩放文本。

| 导入路径 / 组件 | 常用参数与值 |
| --- | --- |
| `@plotloom/ui/input` · `Input` | `value/defaultValue` 为字符串；`onValueChange`；`type` 支持 text/password/email/url/tel/search；`clearable`、`startIcon/endIcon`；密码自动提供显隐按钮 |
| `@plotloom/ui/textarea` · `Textarea` | 字符串值与 `onValueChange`；`rows`、`maxLength`、`showCount`；计数采用原生字符串长度规则 |
| `@plotloom/ui/select` · `Select` | `options: { value: string; label: string; disabled?: boolean }[]`；单选值 `string \| null`，`multiple` 时为 `string[]`；`searchable/clearable` 默认 true；`emptyText`、`placeholder` |
| `@plotloom/ui/checkbox` · `Checkbox` | `checked/defaultChecked`、`onCheckedChange`、`indeterminate`、`label`、`value` |
| `@plotloom/ui/checkbox-group` · `CheckboxGroup` | `options` 同 Select；`value/defaultValue: string[]`、`onValueChange`、`orientation`；同名字段提交多个值 |
| `@plotloom/ui/radio-group` · `RadioGroup` | `options` 同 Select；`value/defaultValue: string \| null`、`onValueChange`、`orientation`；方向键切换 |
| `@plotloom/ui/switch` · `Switch` | `checked/defaultChecked`、`onCheckedChange`、`label`、`value` |
| `@plotloom/ui/number-input` · `NumberInput` | `value: number \| null`、`defaultValue`、`onValueChange`；`min/max/step`；清空产生 null，关闭滚轮误操作，`inputRef` 指向实际输入框 |
| `@plotloom/ui/form-field` · `FormField` | `label`、`description`、`error`、`required`、`disabled`；标签与说明/错误自动关联内部控件 |

输入类支持 `disabled`、`readOnly`、`name`、`className/style`。没有 FormField 时必须提供自身标签或 `aria-label`。FormField 的 `required` 传给单个控件；复选组的「至少选择一项」需要调用方校验并传入 `error`，不把每个选项标记为必选。错误文案由调用方管理，不触发 Toast 或业务请求。

非受控字段用 `defaultValue/defaultChecked` 初始化，可通过原生 `<button type="reset">` 恢复；阻止 reset 默认行为时保持现值。受控字段用 `value/checked` 与回调配合，重置时由调用方恢复状态。切换 Select 的单选/多选模式时使用不同 `key`，避免把字符串状态沿用到数组状态。清空和密码操作会将焦点返回文本输入；Select 支持方向键、Enter、Escape 与焦点归还。

```tsx
import { FormField } from '@plotloom/ui/form-field';
import { Input } from '@plotloom/ui/input';
import { Select } from '@plotloom/ui/select';

<FormField label="名称" required description="填写显示名称" error={error}>
  <Input name="name" value={name} onValueChange={setName} clearable />
</FormField>
<FormField label="类型">
  <Select name="type" value={type} onValueChange={setType}
    options={[{ value: 'a', label: '类型 A' }, { value: 'b', label: '类型 B' }]} />
</FormField>
```

浏览器回归脚本为 `tests/ui/form-browser.js`，执行方式和验收记录见 `docs/form-components-validation.md`。
