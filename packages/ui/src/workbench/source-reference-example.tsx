import { useState, type CSSProperties } from 'react';
import { SourceReference, type ReferenceSource } from '../source-reference/source-reference.tsx';
import { CitationMarker } from '../citation/citation-marker.tsx';
import type { PreviewControls } from './controls.ts';

/** 使用固定来源 ID 连接正文编号与列表；示例不读取网址或本机文件，打开文件仅记录回调。 */
export function SourceReferenceExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const web: ReferenceSource = { id: 'web-1', index: 1, kind: 'web', title: controls.sourceTitle, url: controls.sourceUrl,
    summary: controls.sourceSummary, excerpt: controls.sourceExcerpt };
  const file: ReferenceSource = { id: 'file-2', index: 2, kind: 'file', title: state === 'file' || state === 'long' ? controls.sourceTitle : '人物关系记录.md',
    path: controls.sourcePath, summary: controls.sourceSummary, excerpt: controls.sourceExcerpt };
  const sources = state === 'empty' ? [] : state === 'web' || state === 'invalid-link' ? [web] : state === 'file' || state === 'long' ? [file] : [web, file];
  const select = (id: string | null) => { setSelectedId(id); onAction(`onSelectedChange(${id ?? 'null'})`); };
  return <>
    {state === 'citations' ? <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.9 }}>
      结合公开资料<CitationMarker index={1} sourceTitle={web.title} onActivate={() => select(web.id)} active={selectedId === web.id} />
      与本地记录<CitationMarker index={2} sourceTitle={file.title} onActivate={() => select(file.id)} active={selectedId === file.id} />核对人物关系。
    </p> : null}
    <SourceReference sources={sources} selectedId={selectedId} onSelectedChange={select} style={style}
      overviewLabel={state === 'overview' ? `引用来源 · ${sources.length}` : undefined}
      onOpenFile={controls.sourceOpenFile ? source => onAction(`onOpenFile(${source.id})：${source.path}`) : undefined} />
  </>;
}
