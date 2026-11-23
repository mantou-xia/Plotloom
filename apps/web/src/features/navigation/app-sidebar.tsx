import { useEffect, useState } from 'react';
import type { ChatSummary } from '@plotloom/contracts/skills';
import type { Workspace } from '@plotloom/contracts/workspaces';
import type { Project, SessionOrganization } from '@plotloom/contracts';
import { Sidebar } from '@plotloom/ui/sidebar';
import { SidebarNavItem } from '@plotloom/ui/sidebar/nav-item';
import { SidebarSection } from '@plotloom/ui/sidebar/section';
import { SidebarGroup } from '@plotloom/ui/sidebar/group';
import { SidebarSessionItem } from '@plotloom/ui/sidebar/session-item';
import { SidebarSettingsItem } from '@plotloom/ui/sidebar/settings-item';
import { SidebarActionButton } from '@plotloom/ui/sidebar/action-button';
import { ActionMenuItem } from '@plotloom/ui/action-menu';
import { Button } from '@plotloom/ui/button';
import { Dialog } from '@plotloom/ui/dialog';
import { Input } from '@plotloom/ui/input';
import { runWithToast } from '../../utils/feedback';
import { requestJson } from '../../utils/http';
import { Archive, FolderOpen, Pencil, Pin, PinOff, X, Book, BookOpen, LibraryBig, Plus, SquarePen, RefreshCw, Settings, Sparkles } from 'lucide-react';
import { chatTimeLabel, groupSidebarChats, type ChatGroup } from './sidebar-data';

export type AppPage = 'chat' | 'skills' | 'novels' | 'settings';
interface ChatActions {
  onOrganize: (chat: ChatSummary, changes: Partial<SessionOrganization>) => void;
}
interface GroupActions {
  onGroupUpdate: (group: ChatGroup, changes: { name?: string; pinned?: boolean; sidebarHidden?: boolean }) => Promise<void>;
  onArchiveGroup: (chats: ChatSummary[]) => Promise<void>;
}
interface AppSidebarProps extends ChatActions, GroupActions {
  page: AppPage;
  sessionId: string | null;
  chats: ChatSummary[];
  listState: 'loading' | 'ready' | 'error';
  projects: Project[];
  projectState: 'loading' | 'ready' | 'error';
  currentProjectPath: string;
  onPageChange: (page: AppPage) => void;
  onOpenChat: (chat: ChatSummary) => void;
  onNewChat: (projectPath?: string) => void;
  onChooseProject: () => void;
  workspaces: Workspace[];
  workspaceState: 'loading' | 'ready' | 'error';
  onRefreshWorkspaces: () => Promise<void>;
  onCreateNovel: () => void;
  onNewNovelChat: (id: string) => void;
  onRefresh: () => Promise<void>;
}

/** 项目来自独立登记，小说来自工作区；空项目仍可展开或新建聊天。 */
export function AppSidebar({ page, sessionId, chats, listState, projects: registeredProjects, projectState, currentProjectPath,
  onPageChange, onOpenChat, onOrganize, onNewChat, onChooseProject, onRefresh,
  workspaces, workspaceState, onRefreshWorkspaces, onCreateNovel, onNewNovelChat, onGroupUpdate, onArchiveGroup }: AppSidebarProps) {
  const [sections, setSections] = useState({ pinned: true, projects: true, novels: true, recent: true });
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const { pinned, projects, novels, recent } = groupSidebarChats(chats, workspaces, registeredProjects);
  const activeChatId = page === 'chat' ? sessionId : null;
  const selected = chats.find(chat => chat.id === activeChatId);
  const selectedSection = selected ? selected.pinned ? 'pinned' : novels.some(group => group.id === selected.workspaceId) ? 'novels'
    : projects.some(group => group.projectPath === selected.projectPath) ? 'projects' : 'recent' : null;
  // 新会话或从别处打开会话时展开所属分类；轮询不会反复强制展开用户刚收起的分类。
  useEffect(() => {
    if (selectedSection) setSections(current => ({ ...current, [selectedSection]: true }));
  }, [activeChatId, selectedSection]);
  useEffect(() => { if (currentProjectPath) setSections(current => ({ ...current, projects: true })); }, [currentProjectPath]);
  const toggle = (key: keyof typeof sections, expanded: boolean) => setSections(current => ({ ...current, [key]: expanded }));
  const shared = { activeChatId, now, onOpenChat, onOrganize };
  const groupActions = { onGroupUpdate, onArchiveGroup };
  const refresh = <SidebarActionButton label="刷新聊天列表" icon={<RefreshCw />} onClick={() => void onRefresh()} />;
  return <Sidebar style={{ height: '100%' }} label="应用导航"
    header={<div className="plotloom-app-brand">Plotloom</div>}
    fixNavItems={<SidebarNavItem label="新聊天" icon={<SquarePen />} onClick={() => onNewChat()} />}
    navItems={<>
      <SidebarNavItem label="技能" icon={<Sparkles />} active={page === 'skills'} onClick={() => onPageChange('skills')} />
      <SidebarNavItem label="小说管理" icon={<LibraryBig />} active={page === 'novels'} onClick={() => onPageChange('novels')} />
    </>}
    groups={<>
      {pinned.length > 0 && <SidebarSection label="置顶" expanded={sections.pinned} onExpandedChange={next => toggle('pinned', next)}>
        {pinned.map(chat => <ChatRow key={chat.id} chat={chat} {...shared} />)}
      </SidebarSection>}
      <SidebarSection label="项目" expanded={sections.projects} onExpandedChange={next => toggle('projects', next)}
        contentState={projectState === 'error' ? 'error' : projects.length ? 'ready' : projectState === 'loading' ? 'loading' : 'empty'} emptyText="暂无项目"
        errorText="项目加载失败，请刷新重试" actions={<>{projectState === 'error' || listState === 'error' ? refresh : null}
          <SidebarActionButton label="新增项目" icon={<Plus />} onClick={onChooseProject} /></>}>
        {projects.map(group => <ChatGroupView key={group.id} group={group} {...shared} {...groupActions} chatState={listState} onNewChat={() => onNewChat(group.projectPath)} />)}
      </SidebarSection>
      <SidebarSection label="小说" expanded={sections.novels} onExpandedChange={next => toggle('novels', next)}
        contentState={workspaceState === 'error' || listState === 'error' ? 'error' : novels.length ? 'ready' : workspaceState === 'loading' || listState === 'loading' ? 'loading' : 'empty'}
        emptyText="暂无小说"
        errorText="小说列表加载失败，请刷新重试"
        actions={<><SidebarActionButton label="新建小说" icon={<Plus />} onClick={onCreateNovel} />
          <SidebarActionButton label="刷新小说列表" icon={<RefreshCw />} onClick={() => { void onRefreshWorkspaces(); void onRefresh(); }} /></>}>
        {novels.map(group => <ChatGroupView key={group.id} group={group} {...shared} {...groupActions} chatState={listState} onNewChat={() => onNewNovelChat(group.id)} />)}
      </SidebarSection>
      <SidebarSection label="最近" expanded={sections.recent} onExpandedChange={next => toggle('recent', next)}
        contentState={listState === 'ready' && !recent.length ? 'empty' : listState}
        errorText="聊天列表加载失败，请刷新重试"
        actions={listState === 'error' ? refresh : undefined}>
        {recent.map(chat => <ChatRow key={chat.id} chat={chat} {...shared} />)}
      </SidebarSection>
    </>}
    footer={<SidebarSettingsItem label="设置" icon={<Settings />} active={page === 'settings'} onClick={() => onPageChange('settings')} />} />;
}

interface ChatRowsProps extends ChatActions { activeChatId: string | null; now: number; onOpenChat: (chat: ChatSummary) => void }

/** 各分组共用操作入口，置顶图标由服务端持久状态驱动。 */
function ChatRow({ chat, activeChatId, now, onOpenChat, onOrganize }: ChatRowsProps & { chat: ChatSummary }) {
  return <SidebarSessionItem label={chat.name || '新聊天'} active={activeChatId === chat.id}
    timeLabel={chatTimeLabel(chat.updatedAt, now)}
    status={chat.activity === 'awaiting_approval' || chat.activity === 'awaiting_answer'
      ? chat.activity : chat.status === 'running' ? 'running' : undefined}
    pinned={chat.pinned} onPinnedChange={pinned => onOrganize(chat, { pinned })}
    onArchive={() => onOrganize(chat, { archived: true })} onClick={() => onOpenChat(chat)} />;
}

/** 分组状态由各实例保留；收起外层分类不会重置内层状态，新选中的会话会展开自己的分组。 */
function ChatGroupView({ group, onNewChat, onGroupUpdate, onArchiveGroup, chatState = 'ready', ...shared }: ChatRowsProps & GroupActions & {
  group: ChatGroup; chatState?: 'loading' | 'ready' | 'error'; onNewChat?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const novel = group.kind === 'novel';
  const noun = novel ? '小说' : '项目';
  const [dialog, setDialog] = useState<'rename' | 'remove' | 'archive' | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  /** 每次只提交一项操作，失败保留输入或剩余聊天，便于重试。 */
  async function perform(operation: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await runWithToast(operation, { loading: '正在处理…', success });
      if (result.ok) setDialog(null);
    } finally { setBusy(false); }
  }
  function confirm() {
    if (dialog === 'rename') return perform(() => onGroupUpdate(group, { name: name.trim() }), '名称已更新');
    if (dialog === 'remove') return perform(() => onGroupUpdate(group, { sidebarHidden: true }), '已从侧栏移除');
    if (dialog === 'archive') return perform(async () => {
      await onArchiveGroup(group.chats);
    }, '已归档组内所有聊天');
  }
  const menu = <>
    <ActionMenuItem icon={group.pinned ? <PinOff /> : <Pin />} disabled={busy}
      onSelect={() => void perform(() => onGroupUpdate(group, { pinned: !group.pinned }), group.pinned ? '已取消置顶' : '分组已置顶')}>{group.pinned ? '取消置顶' : '置顶'}</ActionMenuItem>
    <ActionMenuItem icon={<Pencil />} disabled={busy} onSelect={() => { setName(group.label); setDialog('rename'); }}>重命名</ActionMenuItem>
    <div role="separator" />
    <ActionMenuItem icon={<FolderOpen />} disabled={busy} onSelect={() => void perform(() =>
      requestJson('/api/' + (novel ? 'workspaces/' : 'projects/') + encodeURIComponent(group.id) + '/open-folder', 'POST', {}), '已打开资源管理器')}>在资源管理器中打开</ActionMenuItem>
    <div role="separator" />
    <ActionMenuItem icon={<Archive />} disabled={busy || chatState !== 'ready' || !group.chats.length} onSelect={() => setDialog('archive')}>归档所有聊天</ActionMenuItem>
    <div role="separator" />
    <ActionMenuItem icon={<X />} disabled={busy} onSelect={() => setDialog('remove')}>{'移除' + noun}</ActionMenuItem>
  </>;
  const containsActive = group.chats.some(chat => chat.id === shared.activeChatId);
  useEffect(() => { if (containsActive) setExpanded(true); }, [containsActive, shared.activeChatId]);
  return <><SidebarGroup contextMenu={menu} label={group.label} expanded={expanded} onExpandedChange={setExpanded}
    collapsedIcon={novel ? <Book /> : undefined} expandedIcon={novel ? <BookOpen /> : undefined}
    contentState={chatState === 'ready' && !group.chats.length ? 'empty' : chatState}
    actions={onNewChat ? <SidebarActionButton label={`在 ${group.label} 中新建聊天`} icon={<SquarePen />} onClick={onNewChat} /> : undefined}>
    {group.chats.map(chat => <ChatRow key={chat.id} chat={chat} {...shared} />)}
  </SidebarGroup>
    {dialog && <Dialog open dismissOnBackdrop={dialog !== 'rename'} title={(dialog === 'rename' ? '重命名' + noun : dialog === 'remove' ? '移除' + noun : '归档所有聊天')}
      onOpenChange={open => { if (!open && !busy) setDialog(null); }}
      footer={<><Button variant="ghost" disabled={busy} onClick={() => setDialog(null)}>取消</Button>
        <Button loading={busy} disabled={dialog === 'rename' ? !name.trim() : dialog === 'archive' && !group.chats.length}
          onClick={() => void confirm()}>{dialog === 'rename' ? '保存' : dialog === 'remove' ? '确认移除' : '确认归档'}</Button></>}>
      {dialog === 'rename' ? <form onSubmit={event => { event.preventDefault(); if (!busy && name.trim()) void confirm(); }}>
        <Input autoFocus aria-label={noun + '名称'} value={name} maxLength={novel ? 200 : 120} disabled={busy} onValueChange={setName} />
      </form> : <p>{dialog === 'remove' ? '从侧栏移除“' + group.label + '”？文件和聊天会保留。'
        : '归档“' + group.label + '”中的 ' + group.chats.length + ' 个聊天？可在设置中恢复。'}</p>}
    </Dialog>}
  </>;
}
