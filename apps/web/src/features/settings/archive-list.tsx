import { useState } from 'react';
import type { Project } from '@plotloom/contracts';
import type { ChatSummary } from '@plotloom/contracts/skills';
import { ArchiveRestore, ChevronDown, Folder, Search, Trash2 } from 'lucide-react';
import { Checkbox } from '@plotloom/ui/checkbox';
import { Input } from '@plotloom/ui/input';
import { Select } from '@plotloom/ui/select';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';

const archiveTime = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

export interface ArchiveListProps {
  archived: ChatSummary[];
  projects: Project[];
  onRestore: (chat: ChatSummary) => void;
  onDelete: (chat: ChatSummary) => void;
  onBatch: (chats: ChatSummary[], action: 'restore' | 'delete') => Promise<string[]>;
}

/** 选择范围限定于筛选结果；删除确认保存聊天 ID 快照，列表刷新不会扩大删除范围。 */
export function ArchiveList({ archived, projects, onBatch, onRestore, onDelete }: ArchiveListProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [project, setProject] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ChatSummary[]>([]);
  const [busy, setBusy] = useState(false);
  // 折叠只控制分类显示，保留勾选状态以及“全选当前结果”的筛选范围。
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const paths = [...new Set(archived.flatMap(chat => chat.projectPath ? [chat.projectPath] : []))];
  const projectName = (path: string) => projects.find(item => item.path === path)?.name ?? path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  const visible = archived.filter(chat => chat.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    && (project === 'all' || project === chat.projectPath)
    && (kind === 'all' || kind === (chat.workspaceId ? 'novel' : 'project')));
  const groups = new Map<string, ChatSummary[]>();
  for (const chat of visible) {
    const key = chat.workspaceId ? '小说对话' : chat.projectPath!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(chat);
  }
  const targets = visible.filter(chat => selected.includes(chat.id));
  /** 完成后只保留失败项，用户可直接重试。 */
  async function submit(chats: ChatSummary[], action: 'restore' | 'delete') {
    if (busy || !chats.length) return;
    setBusy(true);
    try { setSelected(await onBatch(chats, action)); }
    finally { setBusy(false); setConfirm([]); }
  }
  return <div className="plotloom-archive-list">
    <p className="plotloom-archive-intro">查找已归档的对话，选择需要恢复或永久删除的记录。</p>
    <div className="plotloom-archive-filters">
      <Input aria-label="搜索已归档的对话" placeholder="搜索已归档的对话" startIcon={<Search size={16} />} value={query} disabled={busy}
        onValueChange={value => { setQuery(value); setSelected([]); }} />
      <Select aria-label="对话类型" clearable={false} searchable={false} value={kind} disabled={busy}
        options={[{ value: 'all', label: '全部对话' }, { value: 'project', label: '项目对话' }, { value: 'novel', label: '小说对话' }]}
        onValueChange={value => { setKind(value ?? 'all'); setSelected([]); }} />
      <Select aria-label="筛选项目" clearable={false} value={project} disabled={busy}
        options={[{ value: 'all', label: '所有项目' }, ...paths.map(path => ({ value: path, label: projectName(path) }))]}
        onValueChange={value => { setProject(value ?? 'all'); setSelected([]); }} />
    </div>
    <div className="plotloom-archive-toolbar">
      <Checkbox label="全选当前结果" disabled={busy || !visible.length} checked={!!targets.length && targets.length === visible.length}
        indeterminate={!!targets.length && targets.length < visible.length} onCheckedChange={checked => setSelected(checked ? visible.map(chat => chat.id) : [])} />
      <span>已选 {targets.length} 项</span>
      <Button size="sm" variant="ghost" disabled={busy || !targets.length} onClick={() => void submit(targets, 'restore')}>批量恢复</Button>
      <Button size="sm" variant="ghost" danger disabled={busy || !targets.length} onClick={() => setConfirm(targets)}>批量永久删除</Button>
    </div>
    {!visible.length && <p role="status">没有符合条件的归档对话</p>}
    {Array.from(groups, ([key, chats]) => <section key={key} className="plotloom-archive-group">
      <h3><Button variant="ghost" className="plotloom-archive-toggle" aria-expanded={!collapsed[key]}
        aria-controls={'archive-group-' + encodeURIComponent(key)} onClick={() => setCollapsed(current => ({ ...current, [key]: !current[key] }))}>
        <Folder size={16} aria-hidden="true" /><span className="plotloom-archive-group-name">{paths.includes(key) ? projectName(key) : key}</span>
        <span className="plotloom-archive-count">{chats.length} 个对话</span><ChevronDown size={16} aria-hidden="true" />
      </Button></h3>
      <div id={'archive-group-' + encodeURIComponent(key)} hidden={collapsed[key]}>{chats.map(chat => <div key={chat.id} className="plotloom-archive-entry" role="group" aria-label={chat.name}>
        <Checkbox aria-label={'选择 ' + chat.name} disabled={busy} checked={selected.includes(chat.id)}
          onCheckedChange={checked => setSelected(current => checked ? [...current, chat.id] : current.filter(id => id !== chat.id))} />
        <div className="plotloom-archive-title"><strong title={chat.name}>{chat.name}</strong>
          {chat.archivedAt && <time dateTime={chat.archivedAt}>归档于 {archiveTime.format(new Date(chat.archivedAt))}</time>}</div>
        <Button variant="ghost" size="sm" iconOnly tooltip disabled={busy} aria-label="恢复" onClick={() => onRestore(chat)}><ArchiveRestore size={16} /></Button>
        <Button variant="ghost" size="sm" iconOnly tooltip disabled={busy} aria-label="永久删除" onClick={() => onDelete(chat)}><Trash2 size={16} /></Button>
      </div>)}</div>
    </section>)}
    {!!confirm.length && <Dialog open title={'永久删除 ' + confirm.length + ' 个对话？'} onOpenChange={open => { if (!open && !busy) setConfirm([]); }}
      footer={<><Button variant="ghost" disabled={busy} onClick={() => setConfirm([])}>取消</Button>
        <Button danger loading={busy} disabled={busy} onClick={() => void submit(confirm, 'delete')}>确认永久删除</Button></>}>
      <p>所选对话的记录和附件将被永久删除，此操作无法撤销。</p>
    </Dialog>}
  </div>;
}
