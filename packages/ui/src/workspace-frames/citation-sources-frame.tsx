import { useLayoutEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import type { WebSource } from '../source-reference/source-reference.tsx';

export interface CitationSelection {
  sources: ReadonlyMap<string, WebSource>;
  selectedId: string;
}

import './citation-sources-frame.css';

/** 历史来源来自会话快照，只有 HTTP(S) 地址可以成为可点击链接。 */
function getWebsite(url: string) {
  try {
    const website = new URL(url);
    return website.protocol === 'https:' || website.protocol === 'http:' ? website : null;
  } catch {
    return null;
  }
}

/** 按正文编号列出本轮网站，在列表内部定位当前引用，避免滚动聊天记录。 */
export function CitationSourcesFrame({ selection }: { selection: CitationSelection }) {
  const viewport = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    // 等工作区显示对应标签后再测量，覆盖收起状态下首次点击和重复定位。
    const frame = requestAnimationFrame(() => {
      const list = viewport.current;
      const row = selected.current;
      if (!list || !row) return;
      const bounds = list.getBoundingClientRect();
      const position = row.getBoundingClientRect();
      if (position.top < bounds.top) list.scrollTop += position.top - bounds.top;
      else if (position.bottom > bounds.bottom) list.scrollTop += position.bottom - bounds.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [selection]);

  return <ScrollBox ref={viewport} className="plotloom-workspace__citations" role="region" aria-label="本轮引用来源">
    <ol className="plotloom-workspace__citation-list" role="list">
      {[...selection.sources.values()].map(source => {
        const website = getWebsite(source.url);
        const current = source.id === selection.selectedId;
        const content = <>
          <span className="plotloom-workspace__citation-number">{source.index}</span>
          <span className="plotloom-workspace__citation-text">
            <strong title={source.title}>{source.title}</strong>
            <span title={source.url}>{website?.hostname ?? source.url}</span>
          </span>
        </>;
        return <li key={source.id} ref={current ? selected : undefined} aria-current={current ? 'true' : undefined}>
          {website ? <a className="plotloom-workspace__citation-row" href={website.href} target="_blank" rel="noopener noreferrer">
            {content}<ExternalLink size={15} aria-hidden="true" />
          </a> : <div className="plotloom-workspace__citation-row">{content}</div>}
        </li>;
      })}
    </ol>
  </ScrollBox>;
}
