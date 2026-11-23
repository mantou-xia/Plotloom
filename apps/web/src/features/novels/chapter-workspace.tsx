import { useEffect, useState } from 'react';
import { ManuscriptFrame, ManuscriptPaper } from '@plotloom/ui/manuscript-frame';
import { useManuscriptDirectory } from './manuscript-directory';
import { PrimaryTabPanel, PrimaryTabs } from '@plotloom/ui/primary-tabs';
import type { DocumentListEntry, ManuscriptView } from '@plotloom/contracts/workspaces';
import { requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { draftKey, ManuscriptEditor } from './manuscript-editor';
import { compareChapters } from './novel-api';
import type { ChapterQuote } from '../agent/chapter-quote';
import './novels.css';

const prefix = '正文章节/';
const outline = '大纲/';
const sections = [{ value: prefix, label: '正文' }, { value: outline, label: '大纲' }];

/** 切换目录只改变显示范围，文稿和草稿继续按书籍及路径区分。 */
export function ChapterWorkspace({ workspaceId, request, revision, reviewPath, onReviewCandidate, onQuote }: {
  workspaceId: string; request?: ManuscriptView; revision: number; reviewPath?: string;
  onReviewCandidate?: () => void; onQuote: (quote: ChapterQuote) => void;
}) {
  const base = '/api/workspaces/' + encodeURIComponent(workspaceId);
  const pathKey = 'plotloom:chapter-path:' + workspaceId;
  const [path, setPath] = useState(() => request?.path ?? localStorage.getItem(pathKey) ?? '');
  const [section, setSection] = useState(() => path.startsWith(outline) ? outline : prefix);
  const [entries, setEntries] = useState<DocumentListEntry[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [previousRequest, setPreviousRequest] = useState(request);
  if (request && request !== previousRequest) {
    setPreviousRequest(request);
    if (request.path) {
      setSection(request.path.startsWith(outline) ? outline : prefix);
      setPath(request.path);
    }
    setReload(value => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ entries: DocumentListEntry[] }>(base + '/document-entries', 'GET', undefined, controller.signal).then(files => {
      if (controller.signal.aborted) return;
      setEntries(files.entries.filter(file => file.path.startsWith(prefix) || file.path.startsWith(outline)).sort((a,b) => compareChapters(a.path, b.path)));
      setState('ready');
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setState('error');
      notifyRequestError(cause, 'chapter-list');
    });
    return () => controller.abort();
  }, [base, pathKey, reload, revision, workspaceId]);

  useEffect(() => { if (path) localStorage.setItem(pathKey, path); }, [path, pathKey]);
  const listed = entries.filter(file => file.path.startsWith(section)).map(entry => entry.path);
  const last = localStorage.getItem(pathKey);
  if (last?.startsWith(section) && !listed.includes(last) && localStorage.getItem(draftKey(workspaceId, last))) listed.push(last);
  const selected = listed.includes(path) ? path : listed[0];
  const refresh = () => setReload(count => count + 1);
  const directory = useManuscriptDirectory(base, removed => {
    if (path === removed) { setPath(''); localStorage.removeItem(pathKey); }
    refresh();
  });
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  return <><ManuscriptFrame label="正文章节工作区" directory={close => (
    <PrimaryTabs className="plotloom-chapter-sections" label="文稿类型" options={sections} value={section} onValueChange={setSection}>
      {sections.map(({ value }) => <PrimaryTabPanel key={value} value={value}>
        {value === section && <ul>{listed.map(file => <li key={file}>
          {directory.row({ path: file, title: file.slice(section.length, -3), category: section === outline ? '大纲' : '正文', selected: selected === file,
            onSelect: () => { setPath(file); close(); }, entry: byPath.get(file), label: file.slice(section.length) })}
        </li>)}</ul>}
      </PrimaryTabPanel>)}
    </PrimaryTabs>
  )}>
      {selected ? <ManuscriptEditor key={selected} workspaceId={workspaceId} base={base} path={selected} reload={reload + revision} onRefresh={refresh} onQuote={onQuote}
        viewRequest={request?.path === selected ? request : undefined}
        onReviewCandidate={reviewPath === selected ? onReviewCandidate : undefined} /> :
        <ManuscriptPaper title={section === outline ? '大纲' : '正文'} onRefresh={refresh}
          editor={<p role="status" className="pl-manuscript-empty">{state === 'loading' ? '正在读取文稿…' : state === 'error' ? '无法读取文稿，请刷新重试。' :
            '此目录还没有 Markdown 文稿。'}</p>} />}
  </ManuscriptFrame>{directory.dialog}</>;
}
