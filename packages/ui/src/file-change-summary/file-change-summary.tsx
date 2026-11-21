import { useId, useState } from 'react';
import { Atom, Braces, ChevronDown, ChevronUp, FileCode, FileDiff, FileText } from 'lucide-react';
import { Button } from '../button/button.tsx';
import './file-change-summary.css';

export interface FileChangeSummaryItem {
  path: string;
  added: number | null;
  removed: number | null;
}

const previewCount = 3;

function LineCounts({ added, removed }: Pick<FileChangeSummaryItem, 'added' | 'removed'>) {
  return added === null || removed === null ? <span className="pl-file-summary__unknown">行数无法统计</span>
    : <span className="pl-file-summary__counts" aria-label={`新增 ${added} 行，删除 ${removed} 行`}>
      <span>+{added}</span><span>−{removed}</span>
    </span>;
}

const fileNameStart = (path: string) => Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1;

/** 长路径保留文件名，优先截断目录；完整路径仍可通过悬停或辅助技术查看。 */
function SummaryFile({ file, onOpenFile }: { file: FileChangeSummaryItem; onOpenFile: (path: string) => void }) {
  const nameStart = fileNameStart(file.path);
  const name = file.path.slice(nameStart);
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const Icon = ['jsx', 'tsx'].includes(extension) ? Atom
    : ['css', 'scss', 'json'].includes(extension) ? Braces
    : ['js', 'ts', 'mjs', 'html', 'py'].includes(extension) ? FileCode : FileText;
  return <li>
    <Button variant="ghost" className="pl-file-summary__row" onClick={() => onOpenFile(file.path)}>
      <Icon className="pl-file-summary__file-icon" size={16} aria-hidden="true" />
      <span className="pl-file-summary__path" title={file.path}>
        {nameStart > 0 ? <span className="pl-file-summary__directory" dir="rtl"><bdi dir="ltr">{file.path.slice(0, nameStart)}</bdi></span> : null}
        <strong>{name}</strong>
      </span>
      <LineCounts added={file.added} removed={file.removed} />
    </Button>
  </li>;
}

/** 单文件在标题中展示；多文件默认列前三项，整体与逐行的动作交由宿主。 */
export function FileChangeSummary({ files, onViewChanges, onOpenFile }: {
  files: readonly FileChangeSummaryItem[]; onViewChanges: () => void; onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const extraId = useId();
  if (!files.length) return null;
  const total = files.reduce<Pick<FileChangeSummaryItem, 'added' | 'removed'>>((sum, file) => ({
    added: sum.added === null || file.added === null ? null : sum.added + file.added,
    removed: sum.removed === null || file.removed === null ? null : sum.removed + file.removed,
  }), { added: 0, removed: 0 });
  const single = files.length === 1 ? files[0] : undefined;
  const renderFile = (file: FileChangeSummaryItem) => <SummaryFile key={file.path} file={file} onOpenFile={onOpenFile} />;
  const extraCount = files.length - previewCount;
  return <section className="pl-file-summary" aria-label="本轮文件变更">
    <header className="pl-file-summary__header">
      <span className="pl-file-summary__icon" aria-hidden="true"><FileDiff size={19} /></span>
      <div className="pl-file-summary__headline">
        <strong title={single?.path}>{single ? `已修改 ${single.path.slice(fileNameStart(single.path))}` : `已修改 ${files.length} 个文件`}</strong>
        <LineCounts {...total} />
      </div>
      <Button size="sm" variant="subtle" onClick={() => onViewChanges()}>查看变更</Button>
    </header>
    {single ? null : <ul className="pl-file-summary__list">{files.slice(0, previewCount).map(renderFile)}</ul>}
    {extraCount > 0 ? <>
      <ul className="pl-file-summary__list" id={extraId} hidden={!expanded}>{expanded ? files.slice(previewCount).map(renderFile) : null}</ul>
      <Button className="pl-file-summary__expand" size="sm" variant="ghost" aria-expanded={expanded} aria-controls={extraId}
        endIcon={expanded ? <ChevronUp /> : <ChevronDown />} onClick={() => setExpanded(value => !value)}>
        {expanded ? '收起更多文件' : `再显示 ${extraCount} 个文件`}
      </Button>
    </> : null}
  </section>;
}
