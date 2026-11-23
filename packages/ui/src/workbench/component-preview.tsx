import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { BoxModelOverlay } from './box-model-overlay.tsx';
import { ArrowRight, ChevronRight, Copy, Ellipsis, Minus, Plus, Square, Trash2, X } from 'lucide-react';
import { DocumentListItem } from '../document-list/document-list-item.tsx';
import { DocumentQuoteChip } from '../document-quote-chip/document-quote-chip.tsx';
import { ActionMenu, ActionMenuItem } from '../action-menu/action-menu.tsx';
import { ButtonGallery } from './button-gallery.tsx';
import { SidebarAtomExample } from './sidebar-atom-example.tsx';
import { SidebarExample } from './sidebar-example.tsx';
import { MorphingPopoverExample } from './morphing-popover-example.tsx';
import { ToastExample } from './toast-example.tsx';
import { PrimaryTabsExample } from './primary-tabs-example.tsx';
import { WorkspaceTabsExample } from './workspace-tabs-example.tsx';
import { WorkspacePanelExample } from './workspace-panel-example.tsx';
import { WorkspaceFrameworkExample } from './workspace-framework-example.tsx';
import { SkillItemExample } from './skill-item-example.tsx';
import { UserMessageExample } from './user-message-example.tsx';
import { AttachmentExample } from './attachment-example.tsx';
import { CitationExample } from './citation-example.tsx';
import { SourceReferenceExample } from './source-reference-example.tsx';
import { MessageActionsExample } from './message-actions-example.tsx';
import { MessageStatusExample } from './message-status-example.tsx';
import { DialogExample } from './dialog-example.tsx';
import { SettingsExample } from './settings-example.tsx';
import { FileChangeSummary } from '../file-change-summary/file-change-summary.tsx';
import { FileDiff, type FileDiffBlock } from '../file-diff/file-diff.tsx';
import { ToolApprovalExample } from './tool-approval-example.tsx';
import { QuestionCard } from '../question-card/question-card.tsx';
import { Disclosure } from '../disclosure/disclosure.tsx';
import { Drawer } from '../drawer/drawer.tsx';
import { Notice } from '../notice/notice.tsx';
import { Skeleton } from '../skeleton/skeleton.tsx';
import { Dialog } from '../dialog/dialog.tsx';
import { formCatalog } from './form-catalog.ts';
import { Tooltip } from '../tooltip/tooltip.tsx';
import { Button } from '../button/button.tsx';
import { Card } from '../card/card.tsx';
import { CoverCard } from '../card/cover-card.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { AsciiOcean } from '../ascii-ocean/ascii-ocean.tsx';
import { ColorPicker } from '../color-picker/color-picker.tsx';
import { ColorSwatches } from '../color-swatches/color-swatches.tsx';
import { GlobalLayout } from '../layouts/global-layout.tsx';
import { DesktopTitleBar } from '../layouts/desktop-title-bar.tsx';
import { PageLayout } from '../layouts/page-layout.tsx';
import { ThemeRoot } from '../theme/theme-root.tsx';
import { THEME_PRESETS } from '../theme/theme.ts';
import { componentSizeStyle, type PreviewControls } from './controls.ts';
import './preview.css';

// 原版含完整动效与图标依赖，仅在预览该组件时加载，避免拖慢其他组件的调试。
const AgentActivityExample = lazy(() => import('./agent-activity-example.tsx').then(module => ({ default: module.AgentActivityExample })));
const AgentProcessExample = lazy(() => import('./agent-process-example.tsx').then(module => ({ default: module.AgentProcessExample })));
const MarkdownExample = lazy(() => import('./markdown-example.tsx').then(module => ({ default: module.MarkdownExample })));
const CodeBlockExample = lazy(() => import('./code-block-example.tsx').then(module => ({ default: module.CodeBlockExample })));
const TaskComposerExample = lazy(() => import('./task-composer-example.tsx').then(module => ({ default: module.TaskComposerExample })));
const FormExample = lazy(() => import('./form-example.tsx').then(module => ({ default: module.FormExample })));
const SplitPaneExample = lazy(() => import('./split-pane-example.tsx').then(module => ({ default: module.SplitPaneExample })));
const ReaderFrameExample = lazy(() => import('./page-frame-example.tsx').then(module => ({ default: module.ReaderFrameExample })));
const BrowserFrameExample = lazy(() => import('./page-frame-example.tsx').then(module => ({ default: module.BrowserFrameExample })));

const exampleChangedFiles = [
  { path: 'docs/chapter.md', added: 12, removed: 4 }, { path: 'src/index.ts', added: 8, removed: 2 },
  { path: 'packages/ui/src/file-change-summary/file-change-summary.css', added: 5, removed: 0 },
  { path: 'packages/ui/src/file-change-summary/file-change-summary.tsx', added: 9, removed: 3 },
];

const exampleDiff: FileDiffBlock[] = [
  { kind: 'context', beforeStart: 1, afterStart: 1, lines: Array.from({ length: 9 }, (_, index) => `章节资料 ${index + 1}\n`) },
  { kind: 'removed', beforeStart: 10, afterStart: null, lines: ['旧稿：港口一片寂静。\n'] },
  { kind: 'added', beforeStart: null, afterStart: 10, lines: ['新稿：渡轮鸣笛，灯塔亮了起来。\n', '巡夜人停在码头尽头。\n'] },
];

export interface ComponentPreviewProps {
  children?: ReactNode;
  component: string;
  state: string;
  color: string;
  controls: PreviewControls;
  onColorChange: (color: string) => void;
  onAction: (action: string) => void;
}

/** 样例只组合通用组件与占位内容；尺寸和属性走公开 props，不通过外层盒子伪造组件尺寸。 */
export function ComponentPreview({ component, state, color, controls, onColorChange, onAction, children }: ComponentPreviewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [clicks, setClicks] = useState(0);
  const [disclosureDialogOpen, setDisclosureDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrollItems, setScrollItems] = useState(state === 'empty' ? 0 : state === 'short' || state === 'overflow-only' ? 1 : 24);
  const [pickerColor, setPickerColor] = useState<string | null>(state === 'black' ? '#000000' : state === 'white' ? '#ffffff' : null);
  const style = componentSizeStyle(controls);
  const click = () => { setClicks((count) => count + 1); onAction('onClick'); };
  const content = state === 'empty' ? null : Array.from({ length: state === 'overflow' ? 24 : 3 }, (_, index) => <div className="pl-example-block" key={index}>内容块 {index + 1}</div>);
  let target = children;
  if (component === 'document-quote-chip') target = <DocumentQuoteChip style={style}
    path={controls.quotePath} location={controls.quoteLocation} text={controls.quoteText} comment={controls.quoteComment}
    onRemove={controls.quoteRemovable ? () => onAction('onRemove()') : undefined} />;
  if (['document-editor', 'manuscript-frame', 'image-viewer-frame', 'citation-sources-frame', 'file-changes-frame'].includes(component))
    target = <WorkspaceFrameworkExample key={component} component={component} state={state} style={style} onAction={onAction} />;
  if (component === 'action-menu') target = <ActionMenu trigger={<Button variant="ghost" iconOnly tooltip aria-label="更多操作"><Ellipsis /></Button>}>
    <ActionMenuItem icon={<Copy />} onSelect={() => onAction('复制')}>复制</ActionMenuItem>
    <ActionMenuItem icon={<Trash2 />} danger onSelect={() => onAction('删除')}>删除</ActionMenuItem>
  </ActionMenu>;
  if (component === 'drawer') target = <><Button onClick={() => setDrawerOpen(true)}>打开抽屉</Button><Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="示例抽屉">{content}</Drawer></>;
  if (component === 'notice') target = <Notice tone={state === 'error' || state === 'success' ? state : 'info'}>{state === 'success' ? '连接成功' : state === 'error' ? '无法连接，请检查服务地址。' : '正在检查连接…'}</Notice>;
  if (component === 'skeleton') target = <Skeleton key={state}
    lineWidths={state === 'block' ? ['100%', '100%', '100%', '63%'] : undefined}
    style={{ ...style, width: style.width ?? 240 }} />;
  if (component === 'disclosure') {
    const disclosure = <Disclosure key={state} label="更多设置" defaultOpen={state === 'open'}>{content}</Disclosure>;
    if (state === 'card') target = <Card style={style}>{disclosure}</Card>;
    else if (state === 'dialog') target = <>
      <Button onClick={() => setDisclosureDialogOpen(true)}>打开弹窗</Button>
      <Dialog open={disclosureDialogOpen} onOpenChange={setDisclosureDialogOpen} title="折叠内容">
        {disclosureDialogOpen ? disclosure : null}
      </Dialog>
    </>;
    else target = <Disclosure key={state} style={style} label="更多设置" defaultOpen={state === 'open'}>{content}</Disclosure>;
  }
  if (component === 'settings-section' || component === 'settings-row') target = <SettingsExample key={`${component}-${state}`} component={component} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'markdown-reader-frame') target = <Suspense fallback={<p role="status">正在加载阅读器…</p>}><ReaderFrameExample key={state} state={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'browser-frame') target = <Suspense fallback={<p role="status">正在加载浏览器框架…</p>}><BrowserFrameExample key={`${state}-${controls.browserFrameUrl}`} state={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'workspace-tabs') target = <WorkspaceTabsExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'workspace-panel') target = <WorkspacePanelExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'message-status') target = <MessageStatusExample key={state} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'message-actions') target = <MessageActionsExample key={state} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'split-pane-layout') target = <Suspense fallback={<p role="status">正在加载布局…</p>}><SplitPaneExample key={state} state={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'source-reference') target = <SourceReferenceExample key={state} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'citation-marker') target = <CitationExample key={state} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'attachment-card') target = <AttachmentExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'user-message-bubble') target = <UserMessageExample controls={controls} style={style} onAction={onAction} />;
  if (component === 'skill-item') target = <SkillItemExample key={state} state={state} style={style} />;
  if (component === 'file-change-summary') target = <div style={style}><FileChangeSummary key={state}
    files={state === 'multiple' ? exampleChangedFiles : exampleChangedFiles.slice(0, 1)} onViewChanges={() => onAction('查看变更')} onOpenFile={path => onAction(`打开 ${path}`)} /></div>;
  if (component === 'file-diff') target = <div style={style}><FileDiff key={state}
    blocks={state === 'added' ? [exampleDiff[2]] : exampleDiff} label="场景文件对比" /></div>;
  if (component === 'document-list-item') target = state === 'navigation'
    ? <DocumentListItem title="第四章.md" category="正文章节" date="2026/11/23 13:14" selected={false}
      endContent={<>剩余 2 处<ChevronRight aria-hidden="true" /></>} onSelect={() => onAction('打开文稿')} />
    : <DocumentListItem title="第二章" extension=".md" category="正文" date="11月22日"
    excerpt="雨停后，码头上的灯依次亮起。" selected={state === 'selected'} onSelect={() => onAction('选中文稿')}
    actions={<ActionMenuItem onSelect={() => onAction('定位文稿')}>定位文稿</ActionMenuItem>} />;
  if (component === 'tool-approval-card') target = <ToolApprovalExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'question-card') target = <QuestionCard key={state} style={style} question="这篇故事想采用哪个叙事视角？"
    options={['第一人称', '第三人称限制视角', '第三人称全知视角']} submitting={state === 'submitting'} stopping={state === 'stopping'}
    onStop={() => onAction('停止任务')} onAnswer={reply => onAction(JSON.stringify(reply))} />;
  if (['thinking-content', 'execution-timeline', 'tool-call-item'].includes(component)) target = <Suspense fallback={<p role="status">正在加载过程组件…</p>}><AgentProcessExample key={`${component}-${state}`} component={component} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'agent-activity-header') target = <Suspense fallback={<p role="status">正在加载过程展示区…</p>}><AgentActivityExample key={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'primary-tabs') target = <PrimaryTabsExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'code-block') target = <Suspense fallback={<p role="status">正在加载代码块…</p>}><CodeBlockExample key={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'markdown') target = <Suspense fallback={<p role="status">正在加载渲染器…</p>}><MarkdownExample key={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (formCatalog.some(entry => entry.id === component)) target = <Suspense fallback={<p role="status">正在加载组件…</p>}><FormExample key={`${component}-${state}`} component={component} state={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component === 'tooltip') target = <Tooltip content={state === 'sections' ? <><strong>文件位置</strong><div>{controls.tooltipContent}</div></> : controls.tooltipContent}
    delay={controls.tooltipDelay} shake={controls.tooltipShake} disabled={controls.disabled}>
    <Button style={style} variant="secondary" onClick={() => onAction('Tooltip.children.onClick')}>悬停或聚焦查看提示</Button>
  </Tooltip>;
  if (component === 'morphing-popover') target = <MorphingPopoverExample key={state} state={state} controls={controls} onAction={onAction} />;
  if (component === 'toast') target = <ToastExample state={state} />;
  if (component === 'dialog') target = <DialogExample key={state} state={state} title={controls.text}
    description={controls.dialogDescription} style={style} onAction={onAction} />;
  if (component === 'cover-card') target = <CoverCard title={controls.text || '纸上风景'} style={style}
    background="linear-gradient(155deg, #778579, #31565b 55%, #182f38)" onOpen={() => onAction('onOpen')}
    actions={[{ id: 'copy', label: '复制', icon: <Copy />, onClick: () => onAction('复制') }]} />;
  if (component === 'card') target = <Card style={{ display: 'grid', alignContent: 'center', gap: 12, ...style }} borderRadius={controls.cardBorderRadius} material={controls.cardMaterial}
    padding={controls.padding} backgroundColor={controls.cardBackgroundColor} bordered={controls.cardBordered}>
    <strong>卡片标题</strong><div>卡片内容通过 children 传入，可在右侧切换材质与外观参数。</div>
    {state === 'liquid-glass' || controls.cardMaterial === 'liquid-glass' ? <Button variant="secondary" onClick={click}>移动背后内容 · {clicks}</Button> : null}
  </Card>;
  if (component === 'task-composer') target = <Suspense fallback={<p role="status">正在加载组件…</p>}><TaskComposerExample key={state} state={state} controls={controls} style={style} onAction={onAction} /></Suspense>;
  if (component.startsWith('sidebar-')) target = <SidebarAtomExample component={component} state={state} controls={controls} style={style} onAction={onAction} />;
  if (component === 'sidebar') target = <SidebarExample key={state} state={state} style={style} onAction={onAction} />;
  if (component === 'ascii-ocean') target = <AsciiOcean style={{ ...style, overflow: 'hidden' }}
    paused={controls.oceanPaused} speed={controls.oceanSpeed}
    onSplash={({ x, y }) => onAction(`onSplash(${Math.round(x)}, ${Math.round(y)})`)} />;
  if (component === 'scroll-box') target = <>
    <div className="pl-example-scroll-actions">
      <Button variant="subtle" onClick={() => setScrollItems((count) => count + 8)}>增加内容</Button>
      <Button variant="ghost" onClick={() => setScrollItems((count) => Math.max(0, count - 8))}>减少内容</Button>
      <span role="status">{scrollItems} 个内容块</span>
    </div>
    <ScrollBox style={style} orientation={controls.orientation} scrollbarVisibility={controls.scrollbarVisibility}
      reserveScrollbarSpace={state !== 'overflow-only'} aria-label="滚动内容示例" role="region">
      <div className={`pl-example-scroll-content pl-example-scroll-content--${controls.orientation}`}>
        {Array.from({ length: scrollItems }, (_, index) => <div className="pl-example-block" key={index}>内容块 {index + 1}</div>)}
      </div>
    </ScrollBox>
  </>;
  // 调试台复用实际标题栏，并模拟原生按钮的悬停反馈。
  if (component === 'desktop-title-bar') target = <>
    <div className="pl-example-desktop-titlebar">
      <DesktopTitleBar title="Plotloom" style={{ height: 36 }} />
      <div className="pl-example-desktop-titlebar__controls" aria-hidden="true">
        <span><Minus /></span><span><Square /></span><span><X /></span>
      </div>
    </div>
    {state === 'modal' ? <>
      <Button onClick={() => setDisclosureDialogOpen(true)}>打开弹窗</Button>
      <Dialog open={disclosureDialogOpen} onOpenChange={setDisclosureDialogOpen} title="模态遮罩">
        <p>关闭弹窗后恢复标题栏颜色。</p>
      </Dialog>
    </> : null}
  </>;
  if (component === 'global-layout') target = <GlobalLayout variant={state === 'flat' ? 'flat' : 'inset'} style={style} sidebarWidth={controls.sidebarWidth} gap={controls.gap} contentPadding={controls.padding}
    sidebar={state === 'empty' ? null : <SidebarExample key={state} state={state} style={{ height: '100%' }} onAction={onAction} />}>
    {state === 'empty' ? null : <div style={{ display: 'grid', gap: 16 }}><strong>内容区</strong><p>侧栏融入主题背景，右侧内容卡片独立滚动。</p>{content}</div>}
  </GlobalLayout>;
  // PageLayout 自己管理正文滚动；通用尺寸控制的 overflow 不应让页头参与滚动。
  if (component === 'page-layout') target = <PageLayout style={{ ...style, overflow: 'hidden' }}
    title={controls.pageTitle} maxWidth={controls.maxWidth} padding={controls.padding} gap={controls.gap}
    actions={controls.pageActions ? <>
      <Button variant="secondary" onClick={() => onAction('PageLayout.actions.secondary.onClick')}>次要操作</Button>
      <Button onClick={() => onAction('PageLayout.actions.primary.onClick')}>主要操作</Button>
    </> : undefined}>{content}</PageLayout>;
  if (component === 'color-swatches') target = <ColorSwatches style={style} color={color} onChange={onColorChange} presets={THEME_PRESETS} swatchSize={controls.swatchSize} gap={controls.gap} />;
  if (component === 'color-picker') target = <ColorPicker style={style} defaultFormat={state === 'rgb' ? 'RGB' : 'HEX'} color={pickerColor ?? color} onChange={(next) => { setPickerColor(null); onColorChange(next); }} />;
  if (component === 'theme-root') target = <ThemeRoot color={color} style={style}>
    <p>外层主题</p><Button onClick={click}>主要按钮</Button> <Button variant="subtle" onClick={click}>浅底按钮</Button>
    {state === 'nested' ? <ThemeRoot color="#0f766e" style={{ minHeight: 0, padding: 16 }}><p>内层固定青绿</p><Button onClick={click}>内层按钮</Button></ThemeRoot> : <p className="pl-example-theme-text">文字与选中状态跟随主题变量。</p>}
  </ThemeRoot>;
  if (component === 'button') target = <>
    <section className="pl-button-playground" aria-label="交互试用">
      <h2>交互试用</h2><p>右侧调整类型、尺寸和状态，在这里检查真实效果。</p>
      <Button style={style} variant={controls.variant} size={controls.buttonSize} danger={controls.danger}
        loading={controls.loading} disabled={controls.disabled} iconOnly={controls.buttonIcon === 'only'}
        aria-label={controls.buttonIcon === 'only' ? controls.text || '添加内容' : undefined}
        startIcon={controls.buttonIcon === 'start' || controls.buttonIcon === 'both' ? <Plus /> : undefined}
        endIcon={controls.buttonIcon === 'end' || controls.buttonIcon === 'both' ? <ArrowRight /> : undefined} onClick={click}>
        {controls.buttonIcon === 'only' ? <Plus /> : controls.text}
      </Button>
    </section>
    <ButtonGallery onAction={click} />
  </>;
  // 按钮总览内容较长，统一使用组件库的稳定占位滚动容器。
  const overlay = controls.showBoxModel ? <BoxModelOverlay stageRef={stageRef} /> : null;
  if (component === 'button') return <><ScrollBox ref={stageRef} className="pl-example-stage pl-example-stage--buttons" role="region" aria-label="按钮总览" tabIndex={-1}>
    {target}<p className="pl-example-feedback" role="status">已点击 {clicks} 次</p>
  </ScrollBox>{overlay}</>;
  const glassBackdrop = component === 'card' && (state === 'liquid-glass' || controls.cardMaterial === 'liquid-glass');
  return <><div ref={stageRef} className={`pl-example-stage${component === 'tooltip' ? ' pl-example-stage--tooltip' : ''}${glassBackdrop ? ' pl-example-stage--glass' : ''}`} style={component === 'card' ? { background: 'var(--pl-surface-muted)' } : undefined}>
    {/* 背景是真实 DOM，与 Card 并列；点击更新位置用于核查材质实时采样。 */}
    {glassBackdrop ? <div className="pl-card-backdrop" aria-hidden="true" style={{ transform: `translateX(${clicks % 2 * 48}px)` }}>
      <div className="pl-card-backdrop__shape" /><div className="pl-card-backdrop__shape pl-card-backdrop__shape--warm" />
      {Array.from({ length: 8 }, (_, index) => <div className="pl-card-backdrop__row" key={index}>页面内容 {index + 1} · Liquid glass · 0123456789</div>)}
    </div> : null}
    <div className="pl-example-target">{target}</div>
    {component === 'button' || component === 'theme-root' ? <p className="pl-example-feedback" role="status">已点击 {clicks} 次</p> : null}
  </div>{overlay}</>;
}
