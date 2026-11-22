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
import { Book, BookOpen, LibraryBig, Plus, SquarePen, RefreshCw, Settings, Sparkles } from 'lucide-react';
import { chatTimeLabel, groupSidebarChats, type ChatGroup } from './sidebar-data';

export type AppPage = 'chat' | 'skills' | 'novels' | 'settings';
interface ChatActions {
  onOrganize: (chat: ChatSummary, changes: Partial<SessionOrganization>) => void;
}
interface AppSidebarProps extends ChatActions {
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
  workspaces, workspaceState, onRefreshWorkspaces, onCreateNovel, onNewNovelChat }: AppSidebarProps) {
  const [sections, setSections] = useState({ pinned: true, projects: true, novels: true, recent: true });
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const { pinned, projects, novels, recent } = groupSidebarChats(chats, workspaces, registeredProjects);
  const activeChatId = page === 'chat' ? sessionId : null;
  const selected = chats.find(chat => chat.id === activeChatId);
  const selectedSection = selected ? selected.pinned ? 'pinned' : selected.workspaceId !== null ? 'novels'
    : projects.some(group => group.projectPath === selected.projectPath) ? 'projects' : 'recent' : null;
  // 新会话或从别处打开会话时展开所属分类；轮询不会反复强制展开用户刚收起的分类。
  useEffect(() => {
    if (selectedSection) setSections(current => ({ ...current, [selectedSection]: true }));
  }, [activeChatId, selectedSection]);
  useEffect(() => { if (currentProjectPath) setSections(current => ({ ...current, projects: true })); }, [currentProjectPath]);
  const toggle = (key: keyof typeof sections, expanded: boolean) => setSections(current => ({ ...current, [key]: expanded }));
  const contentState = (count: number) => listState === 'error' ? 'error' : count ? 'ready' : 'empty';
  const shared = { activeChatId, now, onOpenChat, onOrganize };
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
        contentState={projectState === 'error' ? 'error' : projects.length ? 'ready' : 'empty'} emptyText={projectState === 'loading' ? '正在加载…' : '暂无项目'}
        errorText="项目加载失败，请刷新重试" actions={<>{projectState === 'error' || listState === 'error' ? refresh : null}
          <SidebarActionButton label="新增项目" icon={<Plus />} onClick={onChooseProject} /></>}>
        {projects.map(group => <ChatGroupView key={group.id} group={group} {...shared} chatState={listState} onNewChat={() => onNewChat(group.projectPath)} />)}
      </SidebarSection>
      <SidebarSection label="小说" expanded={sections.novels} onExpandedChange={next => toggle('novels', next)}
        contentState={workspaceState === 'error' ? 'error' : contentState(novels.length)}
        emptyText={workspaceState === 'loading' || listState === 'loading' ? '正在加载…' : '暂无小说'}
        errorText="小说列表加载失败，请刷新重试"
        actions={<><SidebarActionButton label="新建小说" icon={<Plus />} onClick={onCreateNovel} />
          <SidebarActionButton label="刷新小说列表" icon={<RefreshCw />} onClick={() => { void onRefreshWorkspaces(); void onRefresh(); }} /></>}>
        {novels.map(group => <ChatGroupView key={group.id} group={group} {...shared} novel chatState={listState} onNewChat={() => onNewNovelChat(group.id)} />)}
      </SidebarSection>
      <SidebarSection label="最近" expanded={sections.recent} onExpandedChange={next => toggle('recent', next)}
        contentState={contentState(recent.length)} emptyText={listState === 'loading' ? '正在加载…' : '暂无聊天'}
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
function ChatGroupView({ group, novel = false, onNewChat, chatState = 'ready', ...shared }: ChatRowsProps & {
  group: ChatGroup; novel?: boolean; chatState?: 'loading' | 'ready' | 'error'; onNewChat?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const containsActive = group.chats.some(chat => chat.id === shared.activeChatId);
  useEffect(() => { if (containsActive) setExpanded(true); }, [containsActive, shared.activeChatId]);
  return <SidebarGroup label={group.label} expanded={expanded} onExpandedChange={setExpanded}
    collapsedIcon={novel ? <Book /> : undefined} expandedIcon={novel ? <BookOpen /> : undefined}
    contentState={chatState === 'error' ? 'error' : group.chats.length ? 'ready' : 'empty'} emptyText={chatState === 'loading' ? '正在加载…' : '暂无聊天'}
    actions={onNewChat ? <SidebarActionButton label={`在 ${group.label} 中新建聊天`} icon={<SquarePen />} onClick={onNewChat} /> : undefined}>
    {group.chats.map(chat => <ChatRow key={chat.id} chat={chat} {...shared} />)}
  </SidebarGroup>;
}
