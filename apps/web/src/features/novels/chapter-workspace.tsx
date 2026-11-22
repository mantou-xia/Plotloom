import { useEffect, useState } from 'react';
import { ManuscriptFrame, ManuscriptPaper } from '@plotloom/ui/manuscript-frame';
import { Button } from '@plotloom/ui/button';
import { PrimaryTabPanel, PrimaryTabs } from '@plotloom/ui/primary-tabs';
import type { ManuscriptView } from '@plotloom/contracts/workspaces';
import { requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { draftKey, ManuscriptEditor } from './manuscript-editor';
import { ChapterCandidate } from './chapter-candidate';
import { compareChapters } from './novel-api';
import './novels.css';

const prefix = '正文章节/';
const outline = '大纲/';
const sections = [{ value: prefix, label: '正文' }, { value: outline, label: '大纲' }];

/** 切换目录只改变显示范围，文稿和草稿继续按书籍及路径区分。 */
export function ChapterWorkspace({ workspaceId, request }: { workspaceId: string; request?: ManuscriptView }) {
  const base = '/api/workspaces/' + encodeURIComponent(workspaceId);
  const pathKey = 'plotloom:chapter-path:' + workspaceId;
  const [path, setPath] = useState(() => request?.path ?? localStorage.getItem(pathKey) ?? '');
  const [section, setSection] = useState(() => path.startsWith(outline) ? outline : prefix);
  const [paths, setPaths] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);
  const [previousRequest, setPreviousRequest] = useState(request);
  const [candidate, setCandidate] = useState(request?.proposalId);
  if (request && request !== previousRequest) {
    setPreviousRequest(request);
    setCandidate(request.proposalId);
    if (request.path) {
      setSection(request.path.startsWith(outline) ? outline : prefix);
      setPath(request.path);
    }
    setReload(value => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ paths: string[] }>(base + '/documents', 'GET', undefined, controller.signal).then(files => {
      if (controller.signal.aborted) return;
      const chapters = files.paths.filter(file => file.startsWith(prefix) || file.startsWith(outline)).sort(compareChapters);
      const last = localStorage.getItem(pathKey);
      if (last && !chapters.includes(last) && localStorage.getItem(draftKey(workspaceId, last))) chapters.push(last);
      setPaths(chapters);
      setState('ready');
    }).catch(cause => {
      if (controller.signal.aborted) return;
      setState('error');
      notifyRequestError(cause, 'chapter-list');
    });
    return () => controller.abort();
  }, [base, pathKey, reload, workspaceId]);

  useEffect(() => { if (path) localStorage.setItem(pathKey, path); }, [path, pathKey]);
  const listed = paths.filter(file => file.startsWith(section));
  const selected = listed.includes(path) ? path : listed[0];
  const refresh = () => setReload(count => count + 1);
  return <ManuscriptFrame label="正文章节工作区" directory={close => (
    <PrimaryTabs className="plotloom-chapter-sections" label="文稿类型" options={sections} value={section} onValueChange={setSection}>
      {sections.map(({ value }) => <PrimaryTabPanel key={value} value={value}>
        {value === section && <ul>{listed.map(file => <li key={file}>
          <Button size="sm" variant="ghost" aria-current={selected === file ? 'true' : undefined} onClick={() => {
            setPath(file);
            close();
          }}>{file.slice(section.length)}</Button>
        </li>)}</ul>}
      </PrimaryTabPanel>)}
    </PrimaryTabs>
  )}>
    {selected ? <ManuscriptEditor key={selected} workspaceId={workspaceId} base={base} path={selected} reload={reload} onRefresh={refresh}
      viewRequest={request?.path === selected ? request : undefined}
      onReviewCandidate={request?.path === selected && request.proposalId ? () => setCandidate(request.proposalId) : undefined} /> :
      <ManuscriptPaper title={section === outline ? '大纲' : '正文'} onRefresh={refresh}
        editor={<p role="status" className="pl-manuscript-empty">{state === 'loading' ? '正在读取文稿…' : state === 'error' ? '无法读取文稿，请刷新重试。' :
          '此目录还没有 Markdown 文稿。'}</p>} />}
    {candidate && <ChapterCandidate key={candidate} base={base} id={candidate} onClose={() => setCandidate(undefined)} onAccepted={refresh} />}
  </ManuscriptFrame>;
}
