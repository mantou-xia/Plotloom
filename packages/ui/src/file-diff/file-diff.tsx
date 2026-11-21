import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import './file-diff.css';

export interface FileDiffBlock {
  kind: 'context' | 'added' | 'removed';
  beforeStart: number | null;
  afterStart: number | null;
  lines: readonly string[];
}

const contextLines = 3;

/** 两栏行号只在对应版本存在该行时显示，新增与删除同时使用符号和底色区分。 */
function DiffRows({ block, start, end }: { block: FileDiffBlock; start: number; end: number }) {
  return block.lines.slice(start, end).map((line, index) => {
    const offset = start + index;
    return <div className="pl-file-diff__row" data-kind={block.kind} key={offset}>
      <span aria-label={block.beforeStart === null ? undefined : `修改前第 ${block.beforeStart + offset} 行`}>
        {block.beforeStart === null ? '' : block.beforeStart + offset}
      </span>
      <span aria-label={block.afterStart === null ? undefined : `修改后第 ${block.afterStart + offset} 行`}>
        {block.afterStart === null ? '' : block.afterStart + offset}
      </span>
      <span>{block.kind === 'added' ? '+' : block.kind === 'removed' ? '−' : ''}</span>
      <code>{line.replace(/\r?\n$/, '')}{block.kind !== 'context' && !line.endsWith('\n')
        ? <small className="pl-file-diff__ending">无行尾换行</small> : null}</code>
    </div>;
  });
}

/** 只预览差异两侧三行，长段按需展开，保留实际行号。 */
function DiffBlock({ block, first, last }: { block: FileDiffBlock; first: boolean; last: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const start = first ? 0 : contextLines;
  const end = block.lines.length - (last ? 0 : contextLines);
  if (block.kind !== 'context' || end <= start) return <DiffRows block={block} start={0} end={block.lines.length} />;
  return <>
    <DiffRows block={block} start={0} end={start} />
    <Button className="pl-file-diff__fold" variant="ghost" size="sm" aria-expanded={expanded}
      startIcon={expanded ? <ChevronUp /> : <ChevronDown />} onClick={() => setExpanded(value => !value)}>
      {expanded ? '折叠' : '展开'} {end - start} 行未变更内容
    </Button>
    {expanded ? <DiffRows block={block} start={start} end={end} /> : null}
    <DiffRows block={block} start={end} end={block.lines.length} />
  </>;
}

/** 通用文本对比只消费带行号的差异块，文件来源和读取由调用方负责。 */
export function FileDiff({ blocks, label = '文件行级对比' }: { blocks: readonly FileDiffBlock[]; label?: string }) {
  return <ScrollBox orientation="both" reserveScrollbarSpace={false} role="region" aria-label={label} className="pl-file-diff">
    <div className="pl-file-diff__lines">{blocks.map((block, index) =>
      <DiffBlock key={index} block={block} first={index === 0} last={index === blocks.length - 1} />)}</div>
  </ScrollBox>;
}
