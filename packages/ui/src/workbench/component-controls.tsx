import { AgentActivityControls } from './agent-activity-controls.tsx';
import { AgentProcessControls } from './agent-process-controls.tsx';
import { Textarea } from '../form/textarea.tsx';
import { FormField } from '../form/form-field.tsx';
import type { ComponentDimension, PreviewControls } from './controls.ts';
import { SidebarControls } from './sidebar-controls.tsx';
import { buttonVariants } from './button-gallery.tsx';
import { formCatalog } from './form-catalog.ts';
import { FormControls } from './form-controls.tsx';

interface Props {
  component: string;
  controls: PreviewControls;
  onChange: (patch: Partial<PreviewControls>) => void;
}

/** 只暴露当前组件实际使用的参数；数字在确认后提交，空值恢复当前值而不是意外变成零。 */
export function ComponentControls({ component, controls, onChange }: Props) {
  function commit(input: HTMLInputElement, current: number, min: number, max: number, apply: (value: number) => void) {
    const value = Number.isFinite(input.valueAsNumber) ? Math.round(input.valueAsNumber) : current;
    const next = Math.max(min, Math.min(max, value));
    apply(next);
    input.value = String(next);
  }
  const layout = component === 'page-layout' || component === 'global-layout';
  const numbers: { key: 'padding' | 'gap' | 'sidebarWidth' | 'swatchSize' | 'maxWidth' | 'cardBorderRadius'; label: string; min: number; max: number }[] = [];
  if (layout || component === 'card') numbers.push({ key: 'padding', label: '内容内边距（px）', min: 0, max: 160 });
  if (component === 'card') numbers.push({ key: 'cardBorderRadius', label: '圆角（px）', min: 0, max: 160 });
  if (layout || component === 'color-swatches') numbers.push({ key: 'gap', label: '间距（px）', min: component === 'global-layout' ? 16 : 0, max: 120 });
  if (component === 'global-layout') numbers.push({ key: 'sidebarWidth', label: '侧栏初始宽度（px）', min: 180, max: 440 });
  if (component === 'page-layout') numbers.push({ key: 'maxWidth', label: '正文最大宽度（px）', min: 1, max: 2400 });
  if (component === 'color-swatches') numbers.push({ key: 'swatchSize', label: '圆点直径（px）', min: 24, max: 80 });
  return <>
    {component === 'document-quote-chip' ? <fieldset><legend>文稿引用参数</legend>
      <label>文稿路径<input value={controls.quotePath} onChange={event => onChange({ quotePath: event.target.value })} /></label>
      <label>引用位置<input value={controls.quoteLocation} onChange={event => onChange({ quoteLocation: event.target.value })} /></label>
      <FormField label="选中原文"><Textarea rows={4} value={controls.quoteText} onValueChange={value => onChange({ quoteText: value })} /></FormField>
      <FormField label="修改要求"><Textarea rows={3} value={controls.quoteComment} onValueChange={value => onChange({ quoteComment: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.quoteRemovable} onChange={event => onChange({ quoteRemovable: event.target.checked })} />提供移除回调</label>
    </fieldset> : null}
    {component === 'settings-section' || component === 'settings-row' ? <fieldset><legend>设置组件参数</legend>
      <label>标题<input value={controls.settingsTitle} onChange={event => onChange({ settingsTitle: event.target.value })} /></label>
      <FormField label="说明"><Textarea rows={3} value={controls.settingsDescription} onValueChange={value => onChange({ settingsDescription: value })} /></FormField>
      <p className="pl-workbench__hint">title / description 控制文案，children 注入设置行或控件；清空说明可检查无说明布局。</p>
    </fieldset> : null}
    {component === 'markdown-reader-frame' || component === 'browser-frame' ? <fieldset><legend>页面框架参数</legend>
      {component === 'markdown-reader-frame' ? <>
        <label>文件名<input value={controls.readerFrameName} onChange={event => onChange({ readerFrameName: event.target.value })} /></label>
        <label>文件路径<input value={controls.readerFramePath} onChange={event => onChange({ readerFramePath: event.target.value })} /></label>
        <FormField label="Markdown 文本"><Textarea rows={10} value={controls.readerFrameContent} onValueChange={value => onChange({ readerFrameContent: value })} /></FormField>
      </> : <label>初始网址<input value={controls.browserFrameUrl} onChange={event => onChange({ browserFrameUrl: event.target.value })} /></label>}
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.frameCustomToolbar} onChange={event => onChange({ frameCustomToolbar: event.target.checked })} />自定义工具栏插槽</label>
      <p className="pl-workbench__hint">状态由样例切换。操作通过公开回调驱动；示例不读取文件或访问网络。</p>
    </fieldset> : null}
    {component === 'message-status' ? <fieldset><legend>消息状态参数</legend>
      <label>消息状态<select value={controls.messageStatus} onChange={event => onChange({ messageStatus: event.target.value as PreviewControls['messageStatus'] })}>
        <option value="waiting">等待响应</option><option value="failed">生成失败</option><option value="stopped">已停止</option><option value="hidden">隐藏并保留占位</option>
      </select></label>
      <FormField label="错误说明"><Textarea rows={4} value={controls.messageStatusError} onValueChange={value => onChange({ messageStatusError: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.messageStatusCanRetry} onChange={event => onChange({ messageStatusCanRetry: event.target.checked })} />提供重试回调</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.messageStatusRetrying} onChange={event => onChange({ messageStatusRetrying: event.target.checked })} />重试处理中</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={event => onChange({ disabled: event.target.checked })} />禁用重试</label>
      <p className="pl-workbench__hint">状态完全由调用方提供；重试回调完成不自动改变消息状态。</p>
    </fieldset> : null}
    {component === 'message-actions' ? <fieldset><legend>回答操作参数</legend>
      <FormField label="回答原文"><Textarea rows={8} value={controls.messageActionsText} onValueChange={value => onChange({ messageActionsText: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.messageActionsShowRegenerate} onChange={event => onChange({ messageActionsShowRegenerate: event.target.checked })} />提供重新生成回调</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.messageActionsRegenerating} onChange={event => onChange({ messageActionsRegenerating: event.target.checked })} />正在重新生成</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.messageActionsRegenerateDisabled} onChange={event => onChange({ messageActionsRegenerateDisabled: event.target.checked })} />禁用重新生成</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={event => onChange({ disabled: event.target.checked })} />禁用全部操作</label>
      <p className="pl-workbench__hint">复制使用浏览器剪贴板；重新生成只演示异步回调，不请求模型。</p>
    </fieldset> : null}
    {component === 'split-pane-layout' ? <fieldset><legend>分屏参数</legend>
      <label>面板标题<input value={controls.splitPanelTitle} onChange={event => onChange({ splitPanelTitle: event.target.value })} /></label>
      {([
        ['splitMinWidth', '面板最小宽度（px）', 200, controls.splitMaxWidth],
        ['splitMaxWidth', '面板最大宽度（px）', controls.splitMinWidth, 1200],
        ['splitBreakpoint', '覆盖模式阈值（px）', 600, 1600],
      ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} key={controls[key]} defaultValue={controls[key]}
        onBlur={event => commit(event.target, controls[key], min, max, value => onChange({ [key]: value }))}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
      <p className="pl-workbench__hint">打开/关闭由样例按钮控制；拖拽后的像素宽度通过回调交给应用，布局不读写存储。默认占满父容器。</p>
    </fieldset> : null}
    {component === 'source-reference' ? <fieldset><legend>来源展示参数</legend>
      <label>来源标题<input type="text" value={controls.sourceTitle} onChange={event => onChange({ sourceTitle: event.target.value })} /></label>
      <label>网页链接<input type="text" value={controls.sourceUrl} onChange={event => onChange({ sourceUrl: event.target.value })} /></label>
      <label>文件路径<input type="text" value={controls.sourcePath} onChange={event => onChange({ sourcePath: event.target.value })} /></label>
      <FormField label="来源摘要"><Textarea rows={3} value={controls.sourceSummary} onValueChange={value => onChange({ sourceSummary: value })} /></FormField>
      <FormField label="引用片段"><Textarea rows={6} value={controls.sourceExcerpt} onValueChange={value => onChange({ sourceExcerpt: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.sourceOpenFile} onChange={event => onChange({ sourceOpenFile: event.target.checked })} />提供文件打开操作</label>
      <p className="pl-workbench__hint">数据仅用于组件演示；网页不会自动抓取，文件路径不会直接访问本机。</p>
    </fieldset> : null}
    {component === 'citation-marker' ? <fieldset><legend>引用标记参数</legend>
      <label>引用编号<input key={controls.citationIndex} type="number" min="1" max="9999" defaultValue={controls.citationIndex}
        onBlur={event => commit(event.target, controls.citationIndex, 1, 9999, value => onChange({ citationIndex: value }))}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      <label>来源名称<input type="text" value={controls.citationTitle} onChange={event => onChange({ citationTitle: event.target.value })} /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.citationActive} onChange={event => onChange({ citationActive: event.target.checked })} />当前来源</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={event => onChange({ disabled: event.target.checked })} />禁用引用</label>
      <p className="pl-workbench__hint">编号与来源由调用方关联。点击记录回调并展示来源样例，不自动解析 Markdown 或请求接口。</p>
    </fieldset> : null}
    {component === 'user-message-bubble' ? <fieldset><legend>用户消息参数</legend>
      <FormField label="用户原文"><Textarea rows={10} value={controls.userMessageText} onValueChange={value => onChange({ userMessageText: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.userMessageAttachments} onChange={event => onChange({ userMessageAttachments: event.target.checked })} />显示附件插槽</label>
      <p className="pl-workbench__hint">正文按纯文本展示。附件按钮只是占位，具体文件卡片和图片组由 C08/C09 后续提供。</p>
    </fieldset> : null}
    {['thinking-content', 'execution-timeline', 'tool-call-item'].includes(component) ? <AgentProcessControls component={component} controls={controls} onChange={onChange} /> : null}
    {component === 'agent-activity-header' ? <AgentActivityControls controls={controls} onChange={onChange} /> : null}
    {component === 'code-block' ? <fieldset><legend>代码块参数</legend>
      <FormField label="代码内容"><Textarea rows={12} value={controls.codeBlockContent} onValueChange={value => onChange({ codeBlockContent: value })} /></FormField>
      <label>代码语言<input type="text" value={controls.codeBlockLanguage} onChange={event => onChange({ codeBlockLanguage: event.target.value })} placeholder="如 typescript、python、json" /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.codeBlockStreaming} onChange={event => onChange({ codeBlockStreaming: event.target.checked })} />模拟流式代码</label>
      <p className="pl-workbench__hint">语言留空或未支持时显示纯文本。复制保留原始缩进和换行；长行可横向滚动，长代码区域最高 480px。</p>
    </fieldset> : null}
    {component === 'markdown' ? <fieldset><legend>Markdown 参数</legend>
      <FormField label="内容"><Textarea aria-label="Markdown 内容" rows={12} value={controls.markdownContent} onValueChange={value => onChange({ markdownContent: value })} /></FormField>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.markdownStreaming} onChange={event => onChange({ markdownStreaming: event.target.checked })} />模拟流式输入</label>
      <label>文字渐现效果<select value={controls.markdownTextEffect} onChange={event => onChange({ markdownTextEffect: event.target.value as PreviewControls['markdownTextEffect'] })}>
        <option value="ink">水墨晕开</option><option value="mist">雾中凝字</option><option value="light">柔光显影</option>
      </select></label>
      <p className="pl-workbench__hint">默认水墨晕开。开启模拟流式输入后可预览；切换效果会重播，系统减少动态效果时直接显示文字。</p>
      <p className="pl-workbench__hint">公式使用 $ 或 $$；图示使用 mermaid 围栏；数据图表使用 echarts JSON 围栏。A2UI 暂未启用。</p>
    </fieldset> : null}
    {formCatalog.some(entry => entry.id === component) ? <FormControls component={component} controls={controls} onChange={onChange} /> : null}
    <fieldset><legend>组件尺寸</legend><div className="pl-workbench__dimensions">
      {(['morphing-popover', 'agent-activity-header', 'thinking-content', 'execution-timeline', 'tool-call-item'].includes(component) ? ['width'] as const : ['width', 'height'] as const).map((axis) => {
        const label = component === 'morphing-popover' ? '面板宽度' : axis === 'width' ? '组件宽度' : '组件高度';
        const dimension = controls[axis];
        return <div key={axis}>
          <label>{label}<select aria-label={`${label}模式`} value={dimension.mode} onChange={(event) => onChange({ [axis]: { ...dimension, mode: event.target.value as ComponentDimension['mode'] } })}>
            <option value="auto">自动</option><option value="fixed">固定 px</option>{component !== 'morphing-popover' ? <option value="fill">填满</option> : null}
          </select></label>
          {dimension.mode === 'fixed' ? <label>像素<input aria-label={`${label}（px）`} key={`${axis}-${dimension.value}`} type="number" min="1" max="2400" defaultValue={dimension.value}
            onBlur={(event) => commit(event.target, dimension.value, 1, 2400, (value) => onChange({ [axis]: { ...dimension, value } }))}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label> : null}
        </div>;
      })}
    </div><p className="pl-workbench__hint">{component === 'agent-activity-header' ? '运行时高度由视觉区决定；结束后 Header 隐藏，仅保留调用方提供的内容。' : component === 'morphing-popover' ? '自动采用示例面板的 264px 宽度；高度随内容变化。展开方向与对齐方式通过上方样例切换。' : '填满画布内的可用空间；自动使用组件自身尺寸。固定高度下内容可滚动。'}</p></fieldset>
    {component.startsWith('sidebar-') ? <SidebarControls component={component} controls={controls} onChange={onChange} /> : null}
    {component === 'dialog' ? <fieldset><legend>弹窗属性</legend>
      <label>标题<input type="text" value={controls.text} onChange={event => onChange({ text: event.target.value })} /></label>
      <label>说明<input type="text" value={controls.dialogDescription} onChange={event => onChange({ dialogDescription: event.target.value })} /></label>
    </fieldset> : null}
    {component === 'tooltip' ? <fieldset><legend>提示气泡参数</legend>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.tooltipShake} onChange={(event) => onChange({ tooltipShake: event.target.checked })} />出现时晃动</label>
      <label>提示内容<input type="text" value={controls.tooltipContent} onChange={(event) => onChange({ tooltipContent: event.target.value })} /></label>
      <label>悬停延迟（ms）<input type="number" min="0" max="2000" key={controls.tooltipDelay} defaultValue={controls.tooltipDelay}
        onBlur={(event) => commit(event.target, controls.tooltipDelay, 0, 2000, (value) => onChange({ tooltipDelay: value }))}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={(event) => onChange({ disabled: event.target.checked })} />禁用提示</label>
      <p className="pl-workbench__hint">尺寸控制作用于示例触发按钮；气泡随文字自适应。系统减少动态效果设置会关闭缩放和摇摆。</p>
    </fieldset> : null}
    {component === 'card' ? <fieldset><legend>卡片外观</legend>
      <label>材质<select value={controls.cardMaterial} onChange={(event) => onChange({ cardMaterial: event.target.value as PreviewControls['cardMaterial'] })}>
        <option value="normal">普通</option><option value="liquid-glass">液态玻璃</option>
      </select></label>
      <label>背景颜色<input type="text" value={controls.cardBackgroundColor} onChange={(event) => onChange({ cardBackgroundColor: event.target.value })} /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.cardBordered} onChange={(event) => onChange({ cardBordered: event.target.checked })} />显示边框线</label>
      <p className="pl-workbench__hint">背景支持 CSS 颜色值；边框固定为中性灰实线。嵌套时用背景和间距区分层级，不嵌套完整边框。</p>
      {controls.cardMaterial === 'liquid-glass' ? <p className="pl-workbench__hint">背景色用作轻微染色；开启边框会关闭材质阴影。Chrome / Edge 提供实时折射，其他引擎使用透明模糊。纯色背景看不出折射，可切换到液态玻璃样例观察。</p> : null}
    </fieldset> : null}
    {component === 'task-composer' ? <fieldset><legend>原版输入框参数</legend>
      {([
        ['composerBusy', '生成中'], ['composerStop', '提供停止回调'],
        ['composerStopping', '停止处理中'], ['disabled', '禁用组件'], ['composerReducedMotion', '减少动态效果'],
      ] as const).map(([key, label]) => <label className="pl-workbench__check" key={key}><input type="checkbox" checked={controls[key]} onChange={(event) => onChange({ [key]: event.target.checked })} />{label}</label>)}
      <p className="pl-workbench__hint">使用 LeiBox 原版样式与动效。模型、思考强度、权限及发送操作记录回调；附件为原版本地处理，未接入后端。</p>
    </fieldset> : null}
    {component === 'ascii-ocean' ? <fieldset><legend>海洋背景属性</legend>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.oceanPaused} onChange={(event) => onChange({ oceanPaused: event.target.checked })} />暂停游动</label>
      <label>游动速度<select value={controls.oceanSpeed} onChange={(event) => onChange({ oceanSpeed: Number(event.target.value) })}>
        <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select></label>
      <p className="pl-workbench__hint">移动指针触发避让，点击或聚焦后按 Enter 制造水波。系统开启减少动态效果时自动保持静态。</p>
    </fieldset> : null}
    {component === 'page-layout' ? <fieldset><legend>一级页面属性</legend>
      <label>页面标题<input type="text" value={controls.pageTitle} onChange={(event) => onChange({ pageTitle: event.target.value })} /></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.pageActions} onChange={(event) => onChange({ pageActions: event.target.checked })} />显示操作按钮</label>
      <p className="pl-workbench__hint">页头固定，正文独立滚动；按钮通过 actions 插槽传入，点击后可查看回调记录。</p>
    </fieldset> : null}
    {component === 'scroll-box' ? <fieldset><legend>滚动属性</legend>
      <label>滚动方向<select value={controls.orientation} onChange={(event) => onChange({ orientation: event.target.value as PreviewControls['orientation'] })}>
        <option value="vertical">纵向</option><option value="horizontal">横向</option><option value="both">双向</option>
      </select></label>
      <label>滚动条显示<select value={controls.scrollbarVisibility} onChange={(event) => onChange({ scrollbarVisibility: event.target.value as PreviewControls['scrollbarVisibility'] })}>
          <option value="auto">悬停或聚焦显示</option><option value="always">始终显示</option><option value="hidden">隐藏轨道（仍可滚动）</option>
      </select></label>
    </fieldset> : null}
    {component === 'button' ? <fieldset><legend>按钮属性</legend>
      <label>按钮文字<input type="text" value={controls.text} onChange={(event) => onChange({ text: event.target.value })} /></label>
      <label>按钮变体<select value={controls.variant} onChange={(event) => onChange({ variant: event.target.value as PreviewControls['variant'] })}>
        {buttonVariants.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>按钮尺寸<select value={controls.buttonSize} onChange={(event) => onChange({ buttonSize: event.target.value as PreviewControls['buttonSize'] })}>
        <option value="sm">小 · 32px</option><option value="md">中 · 40px</option><option value="lg">大 · 48px</option>
      </select></label>
      <label>图标位置<select value={controls.buttonIcon} onChange={(event) => onChange({ buttonIcon: event.target.value as PreviewControls['buttonIcon'] })}>
        <option value="none">无图标</option><option value="start">前置</option><option value="end">后置</option><option value="both">双侧</option><option value="only">纯图标</option>
      </select></label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.danger} onChange={(event) => onChange({ danger: event.target.checked })} />危险操作</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.loading} onChange={(event) => onChange({ loading: event.target.checked })} />加载中</label>
      <label className="pl-workbench__check"><input type="checkbox" checked={controls.disabled} onChange={(event) => onChange({ disabled: event.target.checked })} />禁用按钮</label>
      <p className="pl-workbench__hint">参数作用于「交互试用」按钮；总览保留全部类型，便于对照。纯图标模式使用按钮文字作为可访问名称。</p>
    </fieldset> : null}
    {numbers.length ? <fieldset><legend>{layout ? '布局参数' : component === 'card' ? '卡片尺寸参数' : '色点参数'}</legend><div className="pl-workbench__dimensions">
      {numbers.map(({ key, label, min, max }) => <label key={key}>{label}<input key={controls[key]} type="number" min={min} max={max} defaultValue={controls[key]}
        onBlur={(event) => commit(event.target, controls[key], min, max, (value) => onChange({ [key]: value }))}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>)}
    </div></fieldset> : null}
  </>;
}
