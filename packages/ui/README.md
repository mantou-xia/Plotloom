# 通用组件库

## SettingsSection / SettingsRow 设置结构

```tsx
import { SettingsSection } from '@plotloom/ui/settings-section';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { Switch } from '@plotloom/ui/switch';

<SettingsSection title="偏好" description="管理当前偏好。">
  <SettingsRow title="启用提示" description="在操作结束时提示。">
    <Switch aria-label="启用提示" checked={enabled} onCheckedChange={setEnabled} />
  </SettingsRow>
</SettingsSection>
```

- 两者提供 `title`、可选 `description`、`children`，并透传根元素的 `className`、`style`、`ref` 等属性。
- Section 的 children 直接组合 Row，分组复用 Card 的背景容器，相邻行仅用单侧分隔线；Row 本身没有卡片外框。
- Row 的 children 可以是开关、下拉、选色器等既有控件，控件须提供自身可访问名称。行提供说明分组语义，不自动克隆控件或绑定其值。
- 控件的值、禁用、保存回调和反馈由应用负责；保存反馈使用 toast 或稳定占位区域，避免改变行高。
- 两者默认使用三级分组标题、四级行标题，适合置于设置分类的二级标题下。行按可用空间自然换行。
- 调试台分别登记两个组件，提供多行组合、无说明、选色和窄容器示例，以及标题、说明和尺寸参数。

## SplitPaneLayout 分屏页面布局

与 `PageLayout` 同级：普通页面使用 PageLayout，需要左右分屏的页面使用 SplitPaneLayout，二选一；不要求也不依赖 GlobalLayout。

```tsx
import { SplitPaneLayout } from '@plotloom/ui/layouts/split-pane-layout';

<SplitPaneLayout open={open} onOpenChange={setOpen} panelTitle="文档"
  panel={<DocumentContent />} onPanelWidthChange={savePreferredWidth}>
  <ConversationContent />
</SplitPaneLayout>
```

- `children` / `panel` 注入两侧内容，`panelTitle` 为必填标题，`panelActions` 注入右侧标题操作；组件内含关闭按钮。
- `open` / `onOpenChange` 受控开关。拖拽收起、关闭按钮、Esc 和窄屏遮罩均通知调用方。
- `defaultPanelWidth=400` 仅初始化；`minPanelWidth=280`、`maxPanelWidth=720`、`minMainWidth=320` 均为像素，要求正数、最小值不大于最大值。默认宽度受可用空间及上下限约束。
- `breakpoint=760` 按组件容器判断，实际阈值不低于两侧最小宽度加分隔条 8px。窄屏右侧覆盖当前视口，原生模态层处理背景交互与焦点约束。
- 两侧使用 ScrollBox 独立滚动；关闭重开保留内容节点、输入与滚动位置，恢复最近用户调节宽度。窗口变窄造成的换行和可滚动范围变化仍遵循浏览器行为。
- `onPanelWidthChange(px)` 在用户结束拖拽或键盘调宽后触发；组件不写存储。应用可保存并在下次挂载传回 `defaultPanelWidth`。
- `className` / `style` 作用于根节点，默认宽高 100%，父级需提供有界高度。内容不应再套 PageLayout。
- 底层依赖 `react-resizable-panels@4.24.1`（MIT）；仅使用 Group、Panel、Separator，未引入工作台业务能力。

调试台「布局组件 → SplitPaneLayout」提供分屏、收起、独立滚动、窄容器和空内容五种示例。

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
| `draftKey` | 字符串或数字；值变化时原位清空文本、附件和引用，保留编辑器 DOM、模型与思考档位。旧上传及发送结果不会回填新草稿。 |
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

调试台提供原版、生成中、停止中、禁用、无模型、原位重置草稿和减少动态效果七种样例，并记录公开回调。重置样例通过按钮改变 `draftKey`，用于检查文本与附件清空而模型控件不闪现。正式聊天已替换旧简易输入框，保留组件原版视觉和动效。

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
- `topLayer`：默认 false。触发器位于滚动或裁剪容器内时设为 true，展开期间使用原生非模态 popover 顶层与视口定位，避开祖先裁剪并跟随滚动；收起后恢复原位。调试台“跨越裁剪容器”样例展示此参数。
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


## MarkdownRenderer 富文本渲染

从 `@plotloom/ui/markdown` 导入，适用于 Agent 正文与其他 Markdown 内容展示：

```tsx
import { MarkdownRenderer } from '@plotloom/ui/markdown';

<MarkdownRenderer content={markdown} streaming={isGenerating} />
```

- `content: string`：累计的完整 Markdown 文本；流式时由调用方持续追加，不向组件传单个增量片段。
- `streaming?: boolean`：默认 false；生成期间为 true，完成或停止后为 false。组件不管理网络连接或消息状态。
- `textEffect?: 'ink' | 'mist' | 'light'`：流式正文逐字渐现，分别为水墨晕开（默认）、雾中凝字、柔光显影。静态内容直接显示；已显示文字不重复播放，完成或停止后移除动画包装。系统开启减少动态效果时，收到的文字直接清晰显示。
- 单字时长沿用参考：水墨 360ms，雾与柔光 640ms。正常错开间隔分别为 45ms / 320ms；快速输入时自动压缩间隔，避免显现队列长时间落后于接收进度。围栏代码、公式、图示和数据图表不拆字播放。
- `className`、`style`：作用于根元素，可设置宽高；窄屏图表随容器重算尺寸。
- 支持标题、列表、引用、GFM 表格/任务列表/删除线、链接、图片、行内代码。原始 HTML 以文本处理，不执行脚本。
- 代码围栏显示语言、Shiki 高亮与复制；未知语言以纯文本保留。长代码在块内横向滚动。复制需要浏览器提供 Clipboard API，失败时给出手动复制提示。
- 公式使用 `$...$` 或独占行的 `$$...$$`；采用 KaTeX 支持的 LaTeX 语法，不是完整 TeX 执行环境。普通货币美元符号用 `\$` 转义。
- `mermaid` 围栏渲染图示；`echarts` 围栏接收严格 JSON，支持 `bar`、`line`、`pie`，可配置柱线组合及环形饼图。图表均支持源码切换与复制。
- ECharts 支持的顶层配置为 `title`、`legend`、`grid`、`xAxis`、`yAxis`、`series`、`dataset`、`color`、`tooltip`；未开放地图、graphic、toolbox 或脚本回调。Tooltip 固定为 richText，禁止外部图片及链接跳转。
- 流式图表未接收完整时显示接收状态；停止后按已有内容尝试展示，解析失败时保留源码与错误说明，其他正文继续显示。
- Shiki、Mermaid、ECharts 按需加载；图表卸载释放观察器和实例，不引入 Tailwind。

数据图表示例：

````markdown
```echarts
{
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三"] },
  "yAxis": { "type": "value" },
  "series": [{ "type": "bar", "data": [12, 18, 15] }]
}
```
````

自定义语法的入口集中在内部 `MarkdownCode` 的语言分派处，目前只注册 Mermaid/ECharts；其他围栏保持代码展示。后续 A2UI 在此接入经过校验的声明式内容与受控组件，协议、动作回传和公开扩展 API 本轮未实现。

调试台「内容组件 → MarkdownRenderer」提供七个样例，右侧可编辑内容、模拟流式输入并选择文字渐现效果；切换效果会重播以便比较。详见 `docs/markdown-renderer-validation.md`。

## CodeBlock 独立代码块

```tsx
import { CodeBlock } from '@plotloom/ui/code-block';

<CodeBlock code={source} language="typescript" streaming={isGenerating} />
```

- `code: string`：原始源码，不传 Markdown 围栏。展示和复制保留缩进、空行与末尾换行；空字符串禁用复制。
- `language?: string`：默认 `text`。支持高亮器已注册的语言及别名，语言名会去除首尾空格并转小写；未知语言保留标识并按纯文本展示。语言留空时标识为「纯文本」。
- `streaming?: boolean`：默认 false，增量接收期间为 true。组件显示当前代码并处理异步高亮更新，不管理网络连接；调用方在完成或停止后设为 false。
- `className`、`style`：作用于组件根元素。源码使用统一 ScrollBox，长行横向滚动，内容区最高 480px；根元素设置固定高度时源码区可收缩，工具栏与源码分别布局。
- 复制使用图标按钮并调用浏览器 Clipboard API；成功后图标变绿 2.2 秒再恢复，重复复制重新计时，不显示“已复制”文案；失败提示手动选择复制。内容变化或卸载后，旧复制请求不会污染当前状态。
- 高亮按需加载，加载失败仍可阅读和复制原文。组件只展示源码，不运行代码，不包含下载、行号或编辑器能力。

Markdown 的普通围栏复用 CodeBlock；Mermaid/ECharts 的源码模式复用同一高亮、滚动与复制实现。独立使用时不需要 Markdown 容器或样式。

调试台「内容组件 → CodeBlock」提供 TypeScript、Python、JSON、纯文本、未知语言、长行与长代码、空代码、流式代码八个样例；右侧可编辑源码、语言和流式模拟。验收见 `docs/code-block-validation.md`。


## SkillItem 技能条目

从 `@plotloom/ui/skill-item` 导入 `SkillItem`。在 `ul/ol` 中使用，通过 `name`、`description`、`icon` 和可选 `warning` 提供展示内容，支持 `className/style`。组件不依赖 SkillInfo 或后端接口，技能来源、可用性判断和诊断文案由页面处理。

组件自身不设置固定宽度或最大宽度，列数由外部布局控制；描述最多显示两行，title 保留全文。调试台“内容组件 → SkillItem”提供默认、诊断、长描述示例，可编辑公开参数并调整宽度。

## PrimaryTabs 一级 Tab

从 `@plotloom/ui/primary-tabs` 导入 `PrimaryTabs` 和 `PrimaryTabPanel`。`label` 为标签列表的无障碍名称；`options` 接收 `value/label/disabled`，label 可组合文字与数量；`value` 和 `onValueChange` 由调用方管理，`disabled` 禁用整组。根组件支持 `className/style`；children 组合 `PrimaryTabPanel`，面板通过相同的 `value` 关联标签，并支持 `className`。

灰底、白色滑块和圆角比例参考 Uiverse 的 curly-shrimp-52，来源与 MIT 声明见 `src/primary-tabs/SOURCE.md`。选项最小宽度 130px、高度 28px，按最长内容等宽排列，窄容器横向滚动。滑块以 0.2 秒移动，系统减少动态效果时取消过渡；选中态不改变字重与尺寸。

组件使用 Tab/tabpanel 语义，方向键循环选择并跳过禁用项；只挂载当前面板。调用方管理数据、请求和页面内容。调试台“基础组件 → PrimaryTabs”提供默认、整体禁用、禁用单项示例，并能编辑选项文字与禁用状态。旧 SegmentedControl 已按确认移除，不保留兼容入口。

```tsx
<PrimaryTabs label="内容分类" value={value} onValueChange={setValue}
  options={[{ value: 'all', label: '全部' }, { value: 'recent', label: '最近' }]}>
  <PrimaryTabPanel value="all">全部内容</PrimaryTabPanel>
  <PrimaryTabPanel value="recent">最近内容</PrimaryTabPanel>
</PrimaryTabs>
```


## AgentActivityHeader 状态与过程展示区

从 `@plotloom/ui/agent-activity-header` 导入。组件通过 children 接收整个过程区域，组合 ExecutionTimeline；最终回答由外部作为相邻内容渲染。

`<AgentActivityHeader key={runId} activity="reading" phase={phase} elapsedSeconds={seconds}><ExecutionTimeline items={entries} phase={phase} streaming={receivingEvents} /></AgentActivityHeader>`

| 参数 | 说明 |
| --- | --- |
| activity | thinking（默认）、reading、writing、editing、searching、browsing、executing、processing；预设同时给出中文文案与形态 |
| phase | working（默认）、answering、completed、failed、stopped；answering 必须是明确的最终回答阶段，不能由第一个正文增量推断 |
| label / shape | 可覆盖工作阶段文案及粒子形态；shape 支持 cube、book、pencil、magnifier、folder、robot、bricks、gift、sphere |
| visualHeight | 左侧展示区及右侧默认最小高度，正数 px，默认 360；右侧 header 占 48px，内容主动展开可撑高右侧 |
| elapsedSeconds | 调用方提供的非负耗时，不传则不展示；组件不自动计时 |
| reducedMotion | 显式减少动态效果，默认 false；同时尊重系统设置 |
| children / className / style | 内容插槽与根元素样式；具体内容、滚动、结束后的内容折叠由调用方管理；运行时高度使用 visualHeight |

working 期间状态栏为九宫格动画图标、文字与耗时，没有收起操作。进入 answering 或 completed 后隐藏粒子与整个状态栏，保留同一个 children 插槽；内容展开不会重新显示 Header。Header 不维护任何展开状态，旧展开参数已移除。调试台通过 ExecutionTimeline 管理整个过程的折叠与滚动。失败/停止保留内容并静止粒子。运行时切换活动保持高度；窄容器上下排列。

通用组件不包含工具名或后端事件处理。调试台示例用 read/write/edit/grep/find/ls/powershell/bash/read_skill 演示映射，未知工具使用 processing；正式映射留给应用。原始来源与署名见 `src/agent-activity/SOURCE.md`。调试台提供十个样例，验收见 `docs/agent-activity-validation.md`。

未知工具的 processing 预设使用旋转聚散粒子球 sphere。各形态具有独立循环动作：书页翻动、笔书写、放大镜扫描、文件夹开合与纸张探出、机械臂抓取、魔方转层、礼物抬盖，以及积木分块浮动。支持左右拖动、方向键旋转和 Home 恢复视角；减少动态效果时关闭自动动画，仍可手动旋转。停止时静止，最终回答时卸载粒子。ASCII 试验已移除。

## ThinkingContent 单段思考内容（C04）

从 `@plotloom/ui/thinking-content` 导入。接收 `content`（累计后的 Markdown 字符串）、`streaming`（默认 false）、`className / style`。只展示一段由接口公开的思考文本或摘要，复用 MarkdownRenderer；空白不占位，无独立高度、滚动、阶段或整体折叠。不同位置的思考段分别作为过程节点，不合并到工具之前。

## ExecutionTimeline 统一过程列表（C05）

从 `@plotloom/ui/execution-timeline` 导入 `ExecutionTimeline`、`ExecutionEntry`、`ProcessStatus`。旧 ThinkingPanel 已按用户确认移除，不保留兼容入口；整体阅读控制由此组件维护。

| 参数 | 说明 |
| --- | --- |
| items | 必填，按实际发生顺序排列的记录数组；id 唯一且稳定，同一记录更新保留原 id 与位置；空数组不占位 |
| streaming | 默认 false；接收过程增量时传 true，只有 working 阶段启用底部跟随；思考/说明节点还需显式标记自身 streaming |
| phase | working（默认）、answering、completed、failed、stopped；调用方明确提供，不从正文内容推断 |
| height | 固定阅读模式的整体高度，默认 312px，包含 36px 工具栏；应大于工具栏高度；展开全部时释放限制 |
| className / style | 根元素样式；阅读高度使用 height 参数配置 |

记录类型是 `thinking`（content、可选 title/streaming）、`message`（content、可选 title/streaming）、`tool`（工具公开字段）和 `event`（title、可选 description/status/content）。每种记录均含 `id`、`type`。步骤、重试、上下文整理、失败、停止等用实际事件的标题和说明表达；组件不生成业务事件、不排序、不猜测模型阶段。空白思考和说明自动隐藏；无思考模型仍可展示其他节点。

默认内容可见、内部滚动。「展开全部」显示完整内容并撑开父级，「恢复定高」回到原阅读位置。流式开始时跟随最新；上翻或主动查看节点详情后暂停跟随，点击固定占位的「回到最新过程」恢复。静态长过程默认从头阅读。完整展开时由外层负责滚动，组件不操纵页面滚动。

每个组件实例首次进入 answering 或 completed 时自动折叠一次，并恢复定高模式；之后可手动展开或收起，后续增量、完成、停止与失败均不覆盖用户选择。失败/停止发生在最终回答之前时保持已有内容可见。新任务使用 `key={runId}` 重建，不根据文本变化猜测任务边界。折叠与完整展开都保留同一 Markdown DOM。

```tsx
<AgentActivityHeader key={runId} activity="reading" phase={phase} visualHeight={360}>
  <ExecutionTimeline items={entries} streaming={receivingEvents} phase={phase} height={312} />
</AgentActivityHeader>
{/* 最终回答独立显示在过程区域外。 */}
<MarkdownRenderer content={answer} streaming={receivingAnswer} />
```

组合时默认阅读高度为视觉区高度减去 48px 状态栏；完整展开只增加右侧高度，粒子保持原尺寸。节点状态和最终回答阶段均由调用方提供，进入停止/完成阶段时应用也应同步更新实际工具状态；列表不会把未结束的工具擅自标为成功。

## ToolCallItem 工具调用项（C06）

从 `@plotloom/ui/tool-call-item` 导入 `ToolCallItem`、`ToolCallData`、`ToolCallStatus`。

- `name / summary / status`：工具名称、可选操作摘要、running / completed / failed / stopped 状态。图标、状态文字固定占位，状态更新不自动展开。
- `input / output`：可选原文字符串，对象由调用方格式化。undefined 表示未提供，空字符串明确展示空输入/空结果；HTML、命令均作为文本，不执行。长行软换行、自然撑高，不设置独立纵向滚动框。
- `expanded / defaultExpanded / onExpandedChange`：支持受控或非受控展开，默认收起；同 id 更新保留用户选择。没有输入和结果时不显示空展开入口。
- `className / style`：根元素样式。

调试台「内容组件」分别提供 ThinkingContent 四个、ToolCallItem 七个、ExecutionTimeline 十个独立样例，公开参数可编辑，C03 插槽已组合统一过程。参考 Ant Design X ThoughtChain 的纵向节点与详情交互，未添加该库依赖。验收见 `docs/agent-process-validation.md`；真实聊天与接口契约接入仍待后续实施。

## UserMessageBubble 用户消息气泡

从 `@plotloom/ui/user-message-bubble` 导入。`text` 为原始字符串，保留空格和换行，不解析 Markdown/HTML；`attachments` 为附件 ReactNode 插槽，上传、打开和预览均由调用方实现。

```tsx
<UserMessageBubble text={messageText} attachments={attachmentElements} />
```

默认靠右、自适应内容宽度，最大为父级 85% 与 44rem 中较小者。长文本和无空格路径自动换行，正文自然撑高。仅附件时传 `text=""`；文本和附件均无内容时不占位。不增加时间、头像、发送状态或消息操作。`className`、`style` 作用于根元素。

调试台提供七个样例，可编辑用户原文、切换真实附件展示和调整尺寸。文件卡片与 TaskComposer 共用，图片直接展示缩略图并可预览；真实聊天页面接入另行实现。验收见 `docs/user-message-validation.md`。

## AttachmentCard 与附件缩略图

从 `@plotloom/ui/attachment-card` 导入 `AttachmentCard`、`AttachmentThumbnail`。

- 文件卡片接收 `name`、真实字节数 `size`、`status`（ready / processing / error）、`error`、`onOpen`、`onRemove`、`removeDisabled`、`className`、`style`。未提供大小显示“文件”；0 字节显示“0 B”。打开与移除为独立按钮，未传回调时不制造可点击入口。
- 文件类型复用现有 Font Awesome 图标；Excel 绿、Word 蓝、PDF 红、PPT 橙、压缩包黄、文本与 Markdown 灰。长文件名仅省略名称，保留扩展名。详情状态固定在 16px 行内。
- `AttachmentThumbnail` 接收 `src`、`name`，展示真实图片并固定为 68px。加载失败保留原尺寸并显示失败图标。预览由调用方组合 Dialog；TaskComposer 保留原有预览。
- TaskComposer 与发送后的消息复用同一实现和样式；组件内样式同时适用于普通 DOM 与 Shadow DOM。发送后不传 `onRemove`。

调试台 AttachmentCard 提供文件与图片、草稿移除、状态切换三个样例。这里只统一展示，不扩展后端支持的上传文件类型。详见 `docs/attachment-validation.md`。

## CitationMarker 引用标记

从 `@plotloom/ui/citation-marker` 导入。`index` 是从 1 开始的显示编号，`sourceTitle` 为完整来源名称；`onActivate` 由调用方打开或定位对应来源。组件不请求来源，也不自动解析 Markdown 中的数字。

```tsx
<p>这是一段有来源依据的内容。
  <CitationMarker index={1} sourceTitle="人物关系记录.md" onActivate={() => openSource(sourceId)} />
</p>
```

`active` 标识当前来源，`disabled` 禁用交互；`className`、`style` 作用于编号按钮。复用 Button 与 Tooltip，支持键盘、悬停提示及完整可访问名称。当前来源变化只改变颜色，来源提示不挤动正文。

调试台提供五个状态，可修改编号、来源名、选中和禁用。详情见 `docs/citation-marker-validation.md`；与 C11 的联动在 SourceReference 调试样例展示，真实聊天接入另行实施。

## SourceReference 来源列表与详情

从 `@plotloom/ui/source-reference` 导入 `SourceReference` 和 `ReferenceSource`。来源项包含唯一 `id`、与正文一致的 `index`、`title`、可选 `summary` 与 `excerpt`。网页使用 `kind: 'web'` 和 `url`；文件使用 `kind: 'file'` 和 `path`。

`selectedId` 与 `onSelectedChange` 控制详情，可直接与 C10 联动：

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);
// sources 是调用方提供的 ReferenceSource[]，编号与 ID 的对应关系由调用方维护。
<CitationMarker index={sources[0].index} sourceTitle={sources[0].title}
  onActivate={() => setSelectedId(sources[0].id)} />
<SourceReference sources={sources} selectedId={selectedId} onSelectedChange={setSelectedId}
  onOpenFile={source => openFile(source.id)} />
```

列表展示域名或路径与两行摘要，点击在现有 Dialog 中查看完整内容。网页仅支持绝对 HTTP(S) 导航；文件打开通过可选 `onOpenFile` 回调，路径不会直接访问本机。内容按纯文本显示，无自动抓取或 Markdown 解析。`className`、`style` 控制列表根元素。

调试台提供七个样例，支持 C10 联动、长内容、无效链接和空来源。验证见 `docs/source-reference-validation.md`。

## MessageActions 回答操作（C12）

从 `@plotloom/ui/message-actions` 导入 `MessageActions`、`MessageActionsProps`。`text` 为回答原文，直接传入浏览器剪贴板，保留 Markdown、空格和换行；空白内容禁用复制。不同消息使用各自的 React key。

```tsx
<MessageActions key={message.id} text={message.text}
  onRegenerate={() => regenerateMessage(message.id)} regenerating={isRegenerating}
  regenerateDisabled={!canRegenerate} onError={(action, error) => reportError(action, error)} />
```

`onRegenerate` 可返回 Promise；等待期间组件阻止重复触发，宿主以 `regenerating` 表达后续生成状态。未提供回调时隐藏此操作；`regenerateDisabled` 单独禁用重新生成，`disabled` 禁用全部操作。`onCopy` 在复制成功后通知，`onError(action, error)` 报告复制或重新生成失败。`className / style` 作用于根元素。

两个操作均为 32px 图标按钮，复用 Button 与 Tooltip。复制成功或失败在原按钮反馈，2.2 秒后恢复；重新生成失败原位提示并允许重试。反馈可供读屏读取，不占布局空间。组件不请求模型，不替换消息、不推断重生成业务规则。

调试台「AI 对话组件」提供七个样例和公开参数编辑。见 `docs/message-actions-validation.md`；真实聊天页面与业务接口接入留待页面组合阶段。

## MessageStatus 消息状态（C13）

从 `@plotloom/ui/message-status` 导入 `MessageStatus`、`MessageStatusProps`、`MessageStatusValue`。`status` 支持 `waiting / failed / stopped / null`；null 隐藏内容但保留默认 48px 行高，用于状态出现与消失时维持相邻内容位置。不同消息应使用各自的 React key。

```tsx
<MessageStatus key={message.id} status={messageStatus}
  errorMessage={displayError} onRetry={canRetry ? retryMessage : undefined}
  retrying={retryPending} retryDisabled={otherRequestPending}
  onRetryError={reportRetryError} />
```

错误说明仅在失败时展示，按纯文本处理；长文案在固定行内省略，通过悬停或键盘聚焦查看全文。调用方负责提供适合用户阅读的错误信息。等待与停止使用中性色，失败采用红色图标和标题；等待图标遵循减少动效偏好。

只有失败或停止且提供 `onRetry` 时显示重试。Promise 等待期间自动防重复，`retrying` 支持宿主控制忙碌，`retryDisabled` 禁用入口。回调拒绝在原按钮反馈，并通过 `onRetryError` 通知调用方。回调完成不自动改变消息状态；后续阶段由宿主更新 `status`。`className / style` 作用于根元素，保持默认高度可保证状态切换稳定。

调试台「AI 对话组件」提供九个样例和公开参数编辑。验收见 `docs/message-status-validation.md`；真实聊天页面与重试协议接入另行实施。

## WorkspaceTabs 内容工作区

从 `@plotloom/ui/workspace-tabs` 导入。`tabs` 每项包含唯一 `id`、`title`、可选 `icon`，内容可以使用独立 `toolbar` 和 `content`，也可以通过 `page` 提供完整自定义页面；提供 `page` 后不再包默认工具栏与滚动区。`closable: false` 禁止关闭。`activeId / onSelect / onClose / onAdd` 由调用方控制，关闭后的相邻页选择也属于调用方。`actions` 放框架操作，`empty` 提供空态，`className / style` 直接作用于根元素。

框架默认填满有界父容器。标签切换隐藏页面而不卸载，因此输入、滚动和组件状态保留；关闭标签才卸载。隐藏页的副作用不会自动暂停，接入宿主资源时由业务页按可见状态管理。刷新、离开聊天页后的持久化由应用决定，本阶段未实现。

方向键、Home/End 切换标签，Delete 关闭可关闭标签。工具栏固定 54px，正文独立滚动。通用框架不识别网页或文件类型，不访问业务接口。

`SplitPaneLayout.panelHeader` 为可选头部槽：省略沿用标题栏；传 null 让内容自带标签栏。自定义头部时调用方负责关闭入口，`panelTitle` 继续提供面板可访问名称。其余默认行为保持原样。

## MarkdownReaderFrame 与 BrowserFrame

从 `@plotloom/ui/markdown-reader-frame` 和 `@plotloom/ui/browser-frame` 导入。两者默认填满有界父容器，默认工具栏 54px、状态栏 32px；`className / style` 作用于根节点。`toolbar` 可替换整条工具栏，传 null 可移除；`actions` 扩展默认工具栏。可独立使用，也可作为 `WorkspaceTab.page`。

```tsx
const tabs = [
  { id: 'document', title: '说明.md', page: <MarkdownReaderFrame fileName="说明.md" content={markdownText} /> },
  { id: 'browser', title: '浏览器', page: <BrowserFrame connected={connected} url={url}
      onNavigate={navigate} onReload={reload} onStop={stop} loading={loading}>{browserSurface}</BrowserFrame> },
];
```

阅读器接收 `fileName / filePath / content / loading / error`。`content: undefined` 表示尚未打开，空字符串表示空文件；使用已有 MarkdownRenderer 渲染、ScrollBox 滚动。`onOpen / onRetry` 仅通知调用方，未提供打开回调时入口禁用。已存在正文时，加载和错误仅在固定状态栏反馈，不卸载正文。框架不读取本机文件，也不提供编辑能力。

浏览器的 `url` 是宿主确认地址；地址草稿属于该组件实例。回车通过 `onNavigate` 提交去除首尾空白的原始地址，URL 解释与访问策略属于宿主。宿主更新 url 后同步地址栏；未连接时仍可保留草稿，但不派发导航。`canGoBack / canGoForward` 与 `onBack / onForward` 管理历史操作；`loading` 令刷新按钮原位变为停止，分别调用 `onReload / onStop`。`error` 和可选 `status` 在固定状态栏显示。

`BrowserFrame.children` 是网页内容或原生视图的承载插槽，状态切换不重建它；不传 children 时按连接/错误状态展示空态。框架本身不访问网络、不创建 iframe、不管理原生浏览器会话。具体宿主连接与文件接口由应用后续接入。完整验收见 `docs/workspace-page-frames-validation.md`。

SkillItem 新增可选 `onClick` 与 `status`：前者提供覆盖条目的原生按钮，支持键盘和可见焦点；后者用于固定位置状态文案。调试台示例用点击次数演示回调，不依赖业务接口。技能详情及全局保存由应用组合 Dialog、Switch 实现。
