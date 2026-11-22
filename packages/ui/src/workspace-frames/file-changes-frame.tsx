import type { ReactNode, Ref } from 'react';
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { FileDiff, type FileDiffBlock } from '../file-diff/file-diff.tsx';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './file-changes-frame.css';

/** 统一文件对比的工具栏、刷新反馈和滚动区，记录由调用方装配。 */
export function FileChangesFrame({ title, count, error, loading, onRefresh, contentRef, children }: {
  title: string; count?: number; error?: string; loading?: boolean; onRefresh?: () => void;
  contentRef?: Ref<HTMLDivElement>; children: ReactNode;
}) {
  return <div className="plotloom-file-changes">
    <header className="plotloom-file-changes__header">
      <h2>{title}</h2>
      <span role="status" className="plotloom-file-changes__meta" title={error || undefined}>
        {count === undefined ? null : error ? '刷新失败' : `${count} 次写入`}
      </span>
      <Button variant="ghost" size="sm" tooltip iconOnly aria-label="刷新文件修改"
        loading={loading} disabled={!onRefresh} onClick={onRefresh}><RefreshCw /></Button>
    </header>
    <ScrollBox ref={contentRef} reserveScrollbarSpace={false} className="plotloom-file-changes__content" aria-label="Agent 文件修改记录">
      {children}
    </ScrollBox>
  </div>;
}

const operationNames = { create: '新建', overwrite: '覆盖', edit: '编辑' } as const;

/** 写入行只显示展开状态、差异和重试入口，按需读取由宿主负责。 */
export function FileChangeRow({ change, diff, open, onToggle, rowRef, panelId, error, onRetry }: {
  change: { path: string; operation: keyof typeof operationNames };
  diff?: { blocks: FileDiffBlock[]; added: number; removed: number };
  open: boolean; onToggle: () => void; rowRef?: Ref<HTMLLIElement>; panelId: string; error?: string; onRetry: () => void;
}) {
  return <li className="plotloom-file-changes__item" ref={rowRef}>
    <Button variant="ghost" className="plotloom-file-changes__toggle" aria-expanded={open} aria-controls={panelId}
      startIcon={open ? <ChevronDown /> : <ChevronRight />} onClick={onToggle}>
      <span className="plotloom-file-changes__file">
        <FileText size={15} aria-hidden="true" />
        <span title={change.path}>{change.path}</span>
        <span className="plotloom-file-changes__meta">{operationNames[change.operation]}</span>
      </span>
      <span className="plotloom-file-changes__counts">{diff ? <>
        <span aria-label={`新增 ${diff.added} 行`}>+{diff.added}</span>
        <span aria-label={`删除 ${diff.removed} 行`}>−{diff.removed}</span>
      </> : null}</span>
    </Button>
    <div id={panelId} className="plotloom-file-changes__panel" hidden={!open}>
      {diff ? diff.blocks.length ? <FileDiff blocks={diff.blocks} label={`${change.path} 的修改前后对比`} />
        : <p className="plotloom-file-changes__detail" role="status">已创建空文件</p>
        : open ? <div className="plotloom-file-changes__detail">
          {error ? <><span role="alert">{error}</span> <Button size="sm" variant="text" onClick={() => onRetry()}>重试</Button></>
            : <span role="status">正在读取对比…</span>}
        </div> : null}
    </div>
  </li>;
}
