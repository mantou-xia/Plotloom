import { useRef, useState } from 'react';
import { Check, Image, Pin, PinOff } from 'lucide-react';
import { NOVEL_COVER_IDS, type NovelCoverId, type NovelShelfUpdate, type Workspace } from '@plotloom/contracts/workspaces';
import { Button } from '@plotloom/ui/button';
import { CoverCard } from '@plotloom/ui/cover-card';
import { Dialog } from '@plotloom/ui/dialog';
import { Select } from '@plotloom/ui/select';
import { requestJson } from '../../utils/http';
import { runWithToast } from '../../utils/feedback';
import { NOVEL_SHELF_SORT_KEY } from '../settings/preference-transfer';
import forest from './covers/forest.webp';
import dunes from './covers/dunes.webp';
import ocean from './covers/ocean.webp';
import stars from './covers/stars.webp';

const covers = {
  forest: { name: '雾山', src: forest, background: '#273936' },
  dunes: { name: '沙丘', src: dunes, background: '#70452d' },
  ocean: { name: '潮汐', src: ocean, background: '#1a364b' },
  stars: { name: '星河', src: stars, background: '#26263d' },
} satisfies Record<NovelCoverId, { name: string; src: string; background: string }>;
const sorts = [{ value: 'newest', label: '最近创建' }, { value: 'oldest', label: '最早创建' }, { value: 'title', label: '书名' }];
const collator = new Intl.Collator('zh-CN', { numeric: true });

/** 未选封面的小说按稳定 ID 分配预设，刷新或重排时保持同一本书的外观。 */
function coverFor(book: Workspace) {
  if (book.coverId) return book.coverId;
  const code = Array.from(book.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return NOVEL_COVER_IDS[code % NOVEL_COVER_IDS.length];
}

interface ShelfProps {
  books: Workspace[];
  onOpen: (id: string) => void;
  onUpdate: (book: Workspace) => void;
}

export function NovelShelf({ books, onOpen, onUpdate }: ShelfProps) {
  const [sort, setSort] = useState(() => localStorage.getItem(NOVEL_SHELF_SORT_KEY) ?? 'newest');
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const [editing, setEditing] = useState<{ id: string; cover: NovelCoverId }>();
  const editedBook = books.find(book => book.id === editing?.id);
  const sorted = [...books].sort((a, b) => {
    if (sort === 'title') return collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
    const byDate = a.createdAt.localeCompare(b.createdAt);
    return (sort === 'oldest' ? byDate : -byDate) || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
  });
  const pinned = sorted.filter(book => book.pinned);

  /** 两个书架区共用同一份保存状态。提交成功后用服务端结果更新两处卡片。 */
  async function save(book: Workspace, update: NovelShelfUpdate) {
    if (inFlight.current.has(book.id)) return false;
    inFlight.current.add(book.id);
    setPending(new Set(inFlight.current));
    try {
      const result = await runWithToast(
        () => requestJson<Workspace>('/api/workspaces/' + encodeURIComponent(book.id) + '/shelf', 'PUT', update),
        { loading: '正在保存书架设置…', success: update.coverId ? '封面已更新' : update.pinned ? '已置顶小说' : '已取消置顶' },
      );
      if (result.ok) onUpdate(result.value);
      return result.ok;
    } finally {
      inFlight.current.delete(book.id);
      setPending(new Set(inFlight.current));
    }
  }

  function bookGrid(items: Workspace[]) {
    return <ul className="plotloom-shelf-grid">{items.map(book => {
      const cover = coverFor(book);
      const busy = pending.has(book.id);
      const pinLabel = book.pinned ? '取消置顶' : '置顶';
      return <li key={book.id}>
        <CoverCard title={book.title} imageSrc={covers[cover].src} background={covers[cover].background}
          openLabel={'打开 ' + book.title} onOpen={() => onOpen(book.id)} actions={[
            { id: 'cover', label: '更换封面 ' + book.title, tooltip: '更换封面', icon: <Image />, disabled: busy,
              onClick: () => setEditing({ id: book.id, cover }) },
            { id: 'pin', label: pinLabel + ' ' + book.title, tooltip: pinLabel, icon: book.pinned ? <PinOff /> : <Pin />, disabled: busy,
              onClick: () => void save(book, { pinned: !book.pinned }) },
          ]} />
      </li>;
    })}</ul>;
  }

  const savingCover = !!editedBook && pending.has(editedBook.id);
  return <>
    <section className="plotloom-shelf-section" aria-labelledby="novels-pinned">
      <h2 id="novels-pinned">置顶小说</h2>
      {pinned.length ? bookGrid(pinned) : <p className="plotloom-novel-muted plotloom-shelf-empty">置顶的小说会显示在这里。</p>}
    </section>
    <section className="plotloom-shelf-section" aria-labelledby="novels-all">
      <div className="plotloom-shelf-heading">
        <h2 id="novels-all">全部小说</h2>
        <Select className="plotloom-shelf-sort" aria-label="小说排序" size="sm" options={sorts} value={sort}
          searchable={false} clearable={false} onValueChange={value => {
            if (!value) return;
            setSort(value);
            localStorage.setItem(NOVEL_SHELF_SORT_KEY, value);
          }} />
      </div>
      {bookGrid(sorted)}
    </section>
    {editing && editedBook && <Dialog open dismissOnBackdrop={false} title="更换封面" description={editedBook.title}
      onOpenChange={open => { if (!open && !savingCover) setEditing(undefined); }}
      footer={<>
        <Button variant="ghost" disabled={savingCover} onClick={() => setEditing(undefined)}>取消</Button>
        <Button loading={savingCover} disabled={editing.cover === coverFor(editedBook)}
          onClick={async () => { if (await save(editedBook, { coverId: editing.cover })) setEditing(undefined); }}>应用封面</Button>
      </>}>
      <div className="plotloom-shelf-covers" role="group" aria-label="内置封面">
        {NOVEL_COVER_IDS.map(id => <Button key={id} variant="ghost" aria-pressed={editing.cover === id}
          className="plotloom-shelf-cover-choice" disabled={savingCover} onClick={() => setEditing({ ...editing, cover: id })}>
          <img src={covers[id].src} alt="" />
          <span>{covers[id].name}</span>
          <Check className="plotloom-shelf-cover-check" aria-hidden="true" />
        </Button>)}
      </div>
    </Dialog>}
  </>;
}
