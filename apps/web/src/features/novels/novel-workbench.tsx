import { useEffect, useState } from 'react';
import type { DocumentListEntry, NovelManuscriptStats, Workspace } from '@plotloom/contracts/workspaces';
import type { CharacterCardListResponse, CharacterCardStage } from '@plotloom/contracts/character-cards';
import { WORLDVIEW_PATH } from '@plotloom/contracts/writing';
import { ArrowLeft, ChevronRight, Globe2, RefreshCw } from 'lucide-react';
import { Button } from '@plotloom/ui/button';
import { useManuscriptDirectory } from './manuscript-directory';
import { PrimaryTabPanel, PrimaryTabs } from '@plotloom/ui/primary-tabs';
import { ManuscriptPaper } from '@plotloom/ui/manuscript-frame';
import { requestJson } from '../../utils/http';
import { notifyRequestError } from '../../utils/feedback';
import { ManuscriptEditor } from './manuscript-editor';
import { compareChapters } from './novel-api';

const sections = [
  { value: '正文章节/', label: '正文' },
  { value: '大纲/', label: '大纲' },
  { value: '角色卡/', label: '角色卡' },
] as const;
const characters = sections[2].value;
const number = new Intl.NumberFormat('zh-CN');
type Library = { entries: Map<string, DocumentListEntry>; cards: CharacterCardStage[] };

/** 目录和编辑器分别滚动。选中文稿的草稿、版本与保存继续由共用编辑器管理。 */
export function NovelWorkbench({ workspace, onBack }: { workspace: Workspace; onBack: () => void }) {
  const base = '/api/workspaces/' + encodeURIComponent(workspace.id);
  const key = 'plotloom:novel-path:v1:' + workspace.id;
  const [path, setPath] = useState(() => localStorage.getItem(key) ?? '');
  const [section, setSection] = useState(() => sections.find(item => path.startsWith(item.value))?.value ?? sections[0].value);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [library, setLibrary] = useState<Library>();
  const [stats, setStats] = useState<NovelManuscriptStats>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editorRevision, setEditorRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // 正文编码异常会让统计不可用，但目录仍要可打开，便于定位和修正文稿。
    void requestJson<NovelManuscriptStats>(base + '/manuscript-stats', 'GET', undefined, signal)
      .then(value => { if (!signal.aborted) setStats(value); })
      .catch(cause => {
        if (signal.aborted) return;
        setStats(undefined);
        notifyRequestError(cause, 'novel-stats');
      });
    void Promise.all([
      requestJson<{ entries: DocumentListEntry[] }>(base + '/document-entries', 'GET', undefined, signal),
      requestJson<CharacterCardListResponse>(base + '/character-cards', 'GET', undefined, signal),
    ]).then(([files, stages]) => {
      if (signal.aborted) return;
      setLibrary({ entries: new Map(files.entries.map(entry => [entry.path, entry])), cards: stages.cards });
      setFailed(false);
    }).catch(cause => {
      if (signal.aborted) return;
      setFailed(true);
      notifyRequestError(cause, 'novel-library');
    });
    return () => controller.abort();
  }, [base, revision]);

  const paths = [...(library?.entries.keys() ?? [])];
  const listed = paths.filter(file => file.startsWith(section)).sort(compareChapters);
  const groups = Map.groupBy(library?.cards.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b.path.localeCompare(a.path)) ?? [],
    card => card.character);
  const selectedCard = library?.cards.find(card => card.path === path);
  const selected = path === WORLDVIEW_PATH ? path : section === characters ? selectedCard?.path : listed.includes(path) ? path : listed[0];
  const title = selectedCard && selected === selectedCard.path ? selectedCard.character + ' · 第 ' + selectedCard.chapter + ' 章起' : undefined;
  const refreshLibrary = () => setRevision(value => value + 1);
  const refresh = () => { refreshLibrary(); setEditorRevision(value => value + 1); };
  function open(file: string) {
    setPath(file);
    localStorage.setItem(key, file);
  }
  function changeSection(value: string) {
    const next = sections.find(item => item.value === value);
    if (!next) return;
    setSection(next.value);
    if (path === WORLDVIEW_PATH) setPath('');
  }
  function toggleGroup(name: string, openGroup: boolean) {
    setExpanded(current => ({ ...current, [name]: !openGroup }));
  }
  const directory = useManuscriptDirectory(base, removed => {
    if (path === removed) open('');
    refresh();
  });
  function row(file: string, label: string, category: string, note?: string) {
    return directory.row({ path: file, title: label, category, selected: selected === file, onSelect: () => open(file), entry: library?.entries.get(file), note });
  }
  return <section className="plotloom-novel-management" aria-label={workspace.title}>
    <aside className="plotloom-novel-directory" aria-label="小说文稿">
      <PrimaryTabs className="plotloom-novel-directory-tabs" label="小说资料" options={sections} value={section}
        onValueChange={changeSection} renderList={tabs => <header className="plotloom-novel-directory-header">
          <Button variant="ghost" size="sm" iconOnly tooltip aria-label="返回全部小说" onClick={onBack}><ArrowLeft /></Button>
          {tabs}
          <Button variant="ghost" size="sm" iconOnly tooltip aria-label="刷新小说资料" onClick={refresh}><RefreshCw /></Button>
        </header>}>
        {sections.map(item => <PrimaryTabPanel key={item.value} value={item.value} className="plotloom-novel-directory-main">
          {item.value === section && (section === characters ? (
            groups.size ? <ul>{[...groups].map(([name, cards]) => {
              const isOpen = expanded[name] ?? (selectedCard?.character === name);
              return <li key={name}>
                <Button size="sm" variant="ghost" className="plotloom-novel-character-toggle" aria-expanded={isOpen}
                  startIcon={<ChevronRight />} onClick={() => toggleGroup(name, isOpen)}>{name}</Button>
                {isOpen && <ul className="plotloom-novel-character-stages">{cards.map(card => <li key={card.path}>
                  {row(card.path, '第 ' + card.chapter + ' 章起', name, card.note)}
                </li>)}</ul>}
              </li>;
            })}</ul> : <p role="status">{failed ? '读取失败，请刷新重试。' : library ? '暂无角色卡' : '正在读取…'}</p>
          ) : listed.length ? <ul>{listed.map(file => <li key={file}>{row(file, file.slice(section.length).replace(/\.md$/i, ''), item.label)}</li>)}</ul>
            : <p role="status">{failed ? '读取失败，请刷新重试。' : library ? '暂无' + item.label : '正在读取…'}</p>)}
        </PrimaryTabPanel>)}
        <footer className="plotloom-novel-directory-footer">
          <span aria-label="正文统计" aria-live="polite" title="已保存正文，含 Markdown 标记，不含空白">
            {stats ? `${number.format(stats.chapters)} 章 · ${number.format(stats.characters)} 字` : '— 章 · — 字'}
          </span>
          <Button variant="ghost" size="sm" iconOnly tooltip aria-label="世界观" aria-pressed={selected === WORLDVIEW_PATH}
            onClick={() => open(WORLDVIEW_PATH)}><Globe2 /></Button>
        </footer>
      </PrimaryTabs>
    </aside>
    {directory.dialog}
    <div className="plotloom-novel-management-editor">
      {selected ? <ManuscriptEditor key={selected} workspaceId={workspace.id} base={base} path={selected}
        title={title} reload={editorRevision} onSaved={refreshLibrary} /> :
        <ManuscriptPaper title={workspace.title}
          editor={<p className="pl-manuscript-empty">{library ? '从左侧选择一份资料。' : failed ? '无法读取资料，请刷新重试。' : '正在读取资料…'}</p>} />}
    </div>
  </section>;
}
