import { useId, useRef, useState, type ReactNode } from 'react';
import { BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { PrimaryTabPanel, PrimaryTabs } from '../primary-tabs/primary-tabs.tsx';
import './manuscript-frame.css';

/** 按容器宽度展示固定目录或悬浮目录，业务层提供目录与稿纸内容。 */
export function ManuscriptFrame({ label, directory, children }: {
  label: string; directory: (onSelect: () => void) => ReactNode; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  function close() {
    if (open) trigger.current?.focus();
    setOpen(false);
  }
  return <section className="plotloom-chapter-workspace" aria-label={label}>
    <div className="plotloom-chapter-directory" data-open={open}
      onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        event.preventDefault();
        close();
      }}>
      <Button ref={trigger} className="plotloom-chapter-ball" variant="subtle" size="sm" iconOnly
        aria-label="文稿目录" aria-expanded={open} aria-controls={id}
        onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true); }}
        onClick={() => setOpen(true)}><BookOpen /></Button>
      <nav id={id} className="plotloom-chapter-picker" aria-label="文稿目录">{directory(close)}</nav>
    </div>
    <div className="plotloom-chapter-paper">{children}</div>
  </section>;
}

const modes = [{ value: 'edit', label: '编辑' }, { value: 'preview', label: '预览' }];

/** 稿纸管理栏位与 Tab；编辑、预览、保存反馈由调用方提供。 */
export function ManuscriptPaper({ title, preview, onPreviewChange, onRefresh, actions, editor, reading, footer }: {
  title: string; preview?: boolean; onPreviewChange?: (preview: boolean) => void; onRefresh?: () => void;
  actions?: ReactNode; editor?: ReactNode; reading?: ReactNode; footer?: ReactNode;
}) {
  const toolbar = (tabs?: ReactNode) => <header className="plotloom-paper-toolbar">
    <h2 title={title}>{title.split('/').at(-1)?.replace(/\.md$/i, '')}</h2>
    <div className="pl-manuscript-actions">{tabs}
      {onRefresh && <Button variant="ghost" size="sm" iconOnly tooltip aria-label="刷新文稿" onClick={onRefresh}><RefreshCw /></Button>}
      {actions}
    </div>
  </header>;
  if (!onPreviewChange) return <div className="pl-manuscript-paper">{toolbar()}{editor}</div>;
  return <PrimaryTabs className="pl-manuscript-paper" label="文稿视图" options={modes} value={preview ? 'preview' : 'edit'}
    onValueChange={value => onPreviewChange(value === 'preview')} renderList={toolbar}>
    <PrimaryTabPanel value="edit" className="pl-manuscript-sheet" keepMounted>{editor}</PrimaryTabPanel>
    <PrimaryTabPanel value="preview" className="pl-manuscript-sheet">{reading}</PrimaryTabPanel>
    <footer className="plotloom-paper-footer">{footer}</footer>
  </PrimaryTabs>;
}
