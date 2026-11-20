import { useState, type CSSProperties } from 'react';
import { ExternalLink, FileText, Globe } from 'lucide-react';
import { Button } from '../button/button.tsx';
import { Dialog } from '../dialog/dialog.tsx';
import './source-reference.css';

interface SourceBase {
  id: string;
  /** 与正文 C10 保持一致的显示编号；不按数组位置重编。 */
  index: number;
  title: string;
  summary?: string;
  excerpt?: string;
}
export interface WebSource extends SourceBase { kind: 'web'; url: string }
export interface FileSource extends SourceBase { kind: 'file'; path: string }
export type ReferenceSource = WebSource | FileSource;

export interface SourceReferenceProps {
  sources: readonly ReferenceSource[];
  /** 列表与正文引用共用同一个选中 ID；null 关闭详情。 */
  selectedId: string | null;
  onSelectedChange: (id: string | null) => void;
  /** 提供入口文案时，列表改为通过按钮打开，正文仍可直接打开某条详情。 */
  overviewLabel?: string;
  /** 宿主负责打开文件。路径仅展示，不作为 file:// 链接或直接访问本机。 */
  onOpenFile?: (source: FileSource) => void;
  className?: string;
  style?: CSSProperties;
}

/** 来源 URL 属于外部数据，只给绝对 HTTP(S) 地址提供导航，其他值保留为可读文本。 */
function website(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch { return null; }
}

/** 来源列表和详情只消费公开展示数据；选中由宿主控制，便于 C10 从正文直接打开同一来源。 */
export function SourceReference({ sources, selectedId, onSelectedChange, overviewLabel, onOpenFile, className = '', style }: SourceReferenceProps) {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const selected = sources.find(source => source.id === selectedId);
  const selectedWebsite = selected?.kind === 'web' ? website(selected.url) : null;
  const footer = selected?.kind === 'web'
    ? selectedWebsite
      ? <a className="pl-source-reference__link" href={selectedWebsite.href} target="_blank" rel="noopener noreferrer">打开网页<ExternalLink size={15} aria-hidden="true" /></a>
      : <span className="pl-source-reference__unavailable">链接不可用</span>
    : selected && onOpenFile
      ? <Button variant="secondary" size="sm" onClick={() => onOpenFile(selected)}>打开文件<ExternalLink size={15} aria-hidden="true" /></Button>
      : selected ? <span className="pl-source-reference__unavailable">暂无法打开此文件</span> : undefined;
  const list = sources.length ? <ol className="pl-source-reference__list">
      {sources.map(source => {
        const Icon = source.kind === 'web' ? Globe : FileText;
        const location = source.kind === 'web' ? website(source.url)?.hostname ?? source.url : source.path;
        return <li key={source.id}>
          <Button variant="ghost" className="pl-source-reference__item" aria-label={`查看来源 ${source.index}：${source.title}`}
            aria-haspopup="dialog" aria-current={source.id === selectedId ? 'true' : undefined}
            onClick={() => onSelectedChange(source.id)}>
            <span className="pl-source-reference__number" aria-hidden="true">{source.index}</span>
            <span className="pl-source-reference__content">
              <span className="pl-source-reference__title">{source.title}</span>
              <span className="pl-source-reference__location"><Icon size={13} aria-hidden="true" /><span title={location}>{location}</span></span>
              {source.summary ? <span className="pl-source-reference__summary">{source.summary}</span> : null}
            </span>
          </Button>
        </li>;
      })}
  </ol> : <p className="pl-source-reference__empty">暂无来源</p>;
  return <section className={`pl-source-reference ${className}`} style={style} aria-label="引用来源">
    {overviewLabel ? <Button variant="text" size="sm" aria-haspopup="dialog" onClick={() => setOverviewOpen(true)}>{overviewLabel}</Button> : list}
    <Dialog open={Boolean(selected) || overviewOpen} onOpenChange={open => {
      if (!open) { setOverviewOpen(false); onSelectedChange(null); }
    }} title={overviewOpen ? '引用来源' : '来源详情'} className="pl-source-reference__dialog" footer={footer}>
      {overviewOpen ? list : null}
      {selected ? <article key={selected.id} className="pl-source-reference__detail" aria-label={`来源 ${selected.index}`}>
        <p className="pl-source-reference__kind">来源 {selected.index} · {selected.kind === 'web' ? '网页' : '文件'}</p>
        <h3>{selected.title}</h3>
        <dl>
          <dt>{selected.kind === 'web' ? '链接' : '路径'}</dt>
          <dd>{selected.kind === 'web' ? selected.url : selected.path}</dd>
        </dl>
        {selected.summary ? <div><h4>摘要</h4><p>{selected.summary}</p></div> : null}
        {selected.excerpt ? <div><h4>引用片段</h4><blockquote>{selected.excerpt}</blockquote></div> : null}
      </article> : null}
    </Dialog>
  </section>;
}
