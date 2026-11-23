import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../button/button.tsx';
import { Textarea } from '../form/textarea.tsx';
import { DocumentEditor } from '../document-editor/document-editor.tsx';
import { MarkdownRenderer } from '../markdown/markdown-renderer.tsx';
import { CitationSourcesFrame, type CitationSelection } from '../workspace-frames/citation-sources-frame.tsx';
import { FileChangesFrame, FileChangeRow } from '../workspace-frames/file-changes-frame.tsx';
import { ImageViewerFrame } from '../workspace-frames/image-viewer-frame.tsx';
import { ManuscriptFrame, ManuscriptPaper } from '../workspace-frames/manuscript-frame.tsx';

const citation: CitationSelection = { selectedId: '2', sources: new Map([
  ['1', { id: '1', index: 1, kind: 'web', title: 'Markdown 语法', url: 'https://commonmark.org/help/' }],
  ['2', { id: '2', index: 2, kind: 'web', title: '网页技术文档', url: 'https://developer.mozilla.org/' }],
]) };

/** 样例独立驱动公开参数及回调，便于在调试台单独检查框架。 */
export function WorkspaceFrameworkExample({ component, state, style, onAction }: {
  component: string; state: string; style: CSSProperties; onAction: (action: string) => void;
}) {
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(component === 'document-editor' ? '潮声从窗外传来。\n\n她停下笔，听了一会儿。'
    : '# 第一章\n\n潮声从窗外传来。');
  const [title, setTitle] = useState('第一章.md');
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string>();
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  return <div style={style}>
    {component === 'document-editor' && <DocumentEditor label="文稿正文" value={draft}
      readOnly={state === 'read-only'} onValueChange={setDraft}
      onSelectionAnchorChange={anchor => onAction('onSelectionAnchorChange(' + JSON.stringify(anchor) + ')')} />}
    {component === 'manuscript-frame' && <ManuscriptFrame label="文稿框架" directory={close => (
      ['第一章.md', '第二章.md'].map(file => <Button key={file} variant="ghost" size="sm" onClick={() => {
        setTitle(file);
        close();
      }}>{file}</Button>)
    )}>
      <ManuscriptPaper title={title} preview={preview} onPreviewChange={setPreview} onRefresh={() => onAction('刷新文稿')}
        editor={<Textarea aria-label="文稿内容" value={draft} onValueChange={setDraft} />}
        reading={<MarkdownRenderer content={draft} />} footer={<span>字数 {draft.length}</span>} />
    </ManuscriptFrame>}
    {component === 'citation-sources-frame' && <CitationSourcesFrame selection={citation} />}
    {component === 'file-changes-frame' && <FileChangesFrame title="文件对比" count={1} onRefresh={() => onAction('刷新文件修改')}>
      <ul><FileChangeRow change={{ path: '第一章.md', operation: 'edit' }} panelId="framework-diff-example"
        diff={{ added: 1, removed: 1, blocks: [
          { kind: 'removed', beforeStart: 1, afterStart: null, lines: ['潮声很远。'] },
          { kind: 'added', beforeStart: null, afterStart: 1, lines: ['潮声从窗外传来。'] },
        ] }} open={open} onToggle={() => setOpen(value => !value)} onRetry={() => onAction('重试读取')} /></ul>
    </FileChangesFrame>}
    {component === 'image-viewer-frame' && <>
      {state === 'image' && <input type="file" aria-label="选择预览图片" accept="image/*" onChange={event => {
        const file = event.currentTarget.files?.[0];
        if (file) setImage(URL.createObjectURL(file));
      }} />}
      <ImageViewerFrame src={state === 'image' ? image : undefined} alt="用户选中的图片" />
    </>}
  </div>;
}
