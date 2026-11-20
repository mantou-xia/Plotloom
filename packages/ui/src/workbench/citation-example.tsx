import { useState, type CSSProperties } from 'react';
import { CitationMarker } from '../citation/citation-marker.tsx';
import { Dialog } from '../dialog/dialog.tsx';
import type { PreviewControls } from './controls.ts';

/** 只演示行内入口和调用方回调；来源浮层组合现有 Dialog，不实现 C11 来源列表。 */
export function CitationExample({ state, controls, style, onAction }: {
  state: string; controls: PreviewControls; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [opened, setOpened] = useState<number | null>(null);
  const marker = (index: number) => <CitationMarker key={index} index={index} sourceTitle={controls.citationTitle}
    active={controls.citationActive} disabled={controls.disabled} style={style}
    onActivate={() => { setOpened(index); onAction(`onActivate：来源 ${index}`); }} />;
  return <>
    <p data-citation-paragraph style={{ margin: 0, fontSize: 14, lineHeight: 1.9, overflowWrap: 'anywhere' }}>
      故事的时间线可以从人物第一次相遇开始梳理。{marker(controls.citationIndex)}
      {state === 'multiple' ? <>{marker(controls.citationIndex + 1)}{marker(controls.citationIndex + 2)}</> : null}
      随后的信件和场景记录，为这一段叙事提供了进一步线索。
    </p>
    <Dialog open={opened !== null} onOpenChange={open => { if (!open) setOpened(null); }} title={`来源 ${opened ?? controls.citationIndex}`}>
      <p style={{ overflowWrap: 'anywhere' }}>{controls.citationTitle}</p>
      <p>人物首次相遇发生在第一章的雨夜。第二章的信件再次提及这一事件，可用于核对时间顺序。</p>
    </Dialog>
  </>;
}
