import { GlobalLayout } from '@plotloom/ui/layouts/global-layout';
import { Dialog } from '@plotloom/ui/dialog';
import { Button } from '@plotloom/ui/button';
import { ThemeRoot } from '@plotloom/ui/theme-root';
import type { Project, SessionSummary, SessionOrganization } from '@plotloom/contracts';
import type { Workspace } from '@plotloom/contracts/workspaces';
import type { ChatSummary } from '@plotloom/contracts/skills';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SettingsPage, SettingsSidebar } from '../features/settings/settings-page';
import { useThemePreference } from '../features/settings/use-theme-preference';
import { requestJson } from '../utils/http';
import { ToastViewport } from '@plotloom/ui/toast';
import { notifyRequestError, runWithToast } from '../utils/feedback';
import { chatDraft } from '../features/agent/chat-draft';
import { ChatPage } from '../features/agent/chat-page';
import { ChatWorkspace } from '../features/workspace/chat-workspace';
import { NewChatPage } from '../features/agent/new-chat-page';
import { SkillsPage } from '../features/skills/skills-page';
import { CreateNovelDialog, NovelsPage } from '../features/novels/novels-page';
import type { ChatGroup } from '../features/navigation/sidebar-data';
import { AppSidebar, type AppPage } from '../features/navigation/app-sidebar';
import { CreateProjectDialog } from '../features/navigation/create-project-dialog';
import { ProjectSwitcher } from '../features/navigation/project-switcher';
import { useAppRoute } from './app-route';
import './app.css';

/** 品牌、页面导航和保存反馈属于应用；布局、按钮及选色能力来自通用组件库。 */
export function App() {
  const { route, updateRoute, closeSettings, clearSession } = useAppRoute();
  const { page, sessionId, workspaceId, settings: settingsSection } = route;
  const settingsOpen = settingsSection !== null;
  const [acceptedRevision, setAcceptedRevision] = useState(0);
  const [modelRevision, setModelRevision] = useState(0);
  const [skillRevision, setSkillRevision] = useState(0);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  /** 设置属于二级导航，不覆盖原页面；返回恢复入口焦点和原来的页面状态。 */
  function navigate(next: AppPage) {
    if (next === 'settings') {
      settingsTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      updateRoute({ settings: 'appearance' }, 'open-settings');
    } else if (next === 'novels') updateRoute({ page: next, sessionId: null, workspaceId: null });
    else updateRoute({ page: next });
  }
  useEffect(() => {
    if (settingsOpen || !settingsTrigger.current) return;
    settingsTrigger.current.focus({ preventScroll: true });
    settingsTrigger.current = null;
  }, [settingsOpen]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const activeChat = chats.find(chat => chat.id === sessionId);
  const projectPath = activeChat?.projectPath ?? route.projectPath;
  const [startRevision, setStartRevision] = useState(0);
  // 默认专注聊天；每次新建时收起工作区，已有标签保留，用户仍可主动展开。
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const bookId = sessionId ? activeChat?.workspaceId ?? null : workspaceId;
  const [bookPanels, setBookPanels] = useState<Record<string, boolean>>({});
  const panelKey = 'plotloom:chapter-panel:' + bookId;
  // 同一本书的草稿聊天、已保存聊天和刷新后的深链接共用面板开合偏好。
  const panelOpen = bookId ? bookPanels[bookId] ?? sessionStorage.getItem(panelKey) === 'open' : workspaceOpen;
  function changePanelOpen(open: boolean) {
    if (!bookId) { setWorkspaceOpen(open); return; }
    sessionStorage.setItem(panelKey, open ? 'open' : 'closed');
    setBookPanels(current => ({ ...current, [bookId]: open }));
  }
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceState, setWorkspaceState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectState, setProjectState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [creatingNovel, setCreatingNovel] = useState(false);
  const [projectDialog, setProjectDialog] = useState<'create' | 'switch' | 'create-from-switch' | null>(null);
  const [chatToDelete, setChatToDelete] = useState<ChatSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const listRequest = useRef(0);
  const theme = useThemePreference();
  // 取回全部会话，由应用侧栏按工作区和项目目录分组，避免提前过滤掉小说会话。
  const refreshChats = useCallback(async (manual = false) => {
    const revision = ++listRequest.current;
    const load = async () => {
      try {
        const result = await requestJson<{ sessions: ChatSummary[] }>('/api/chats');
        if (revision !== listRequest.current) return;
        setChats(result.sessions);
        setListState('ready');
      } catch (cause) { if (revision !== listRequest.current) return; setListState('error'); throw cause; }
    };
    if (manual) await runWithToast(load, { loading: '正在刷新聊天列表…', success: '聊天列表已刷新' });
    else try { await load(); } catch (cause) { notifyRequestError(cause, 'chat-list-error'); }
  }, []);
  useEffect(() => { void refreshChats(); }, [refreshChats]);
  // 项目与聊天独立加载；列表没有会话时也能展示已保存的项目。
  const refreshProjects = useCallback(async () => {
    try {
      const result = await requestJson<{ projects: Project[] }>('/api/projects');
      setProjects(result.projects); setProjectState('ready');
    } catch (cause) { setProjectState('error'); notifyRequestError(cause, 'project-list-error'); }
  }, []);
  useEffect(() => { void refreshProjects(); }, [refreshProjects]);
  // 起始页与侧栏共用小说列表，刷新深链接时可恢复草稿的小说归属。
  const refreshWorkspaces = useCallback(async () => {
    try {
      const result = await requestJson<{ workspaces: Workspace[] }>('/api/workspaces');
      setWorkspaces(result.workspaces);
      setWorkspaceState('ready');
    } catch (cause) { setWorkspaceState('error'); notifyRequestError(cause, 'sidebar-workspaces'); }
  }, []);
  useEffect(() => { void refreshWorkspaces(); }, [refreshWorkspaces]);
  // 离开聊天页后仍刷新三个分类的运行状态，避免条目永久停留在生成中。
  useEffect(() => {
    if (!chats.some(chat => chat.status === 'running')) return;
    const timer = setTimeout(() => void refreshChats(), 1500);
    return () => clearTimeout(timer);
  }, [chats, refreshChats]);
  /** 项目独立于会话选择保存，新聊天只重置对话；服务端确认首条消息后进入记录。 */
  function openStartedChat(session: SessionSummary) {
    updateRoute({ page: 'chat', sessionId: session.id });
    void refreshChats();
  }
  /** 目录只绑定新会话；递增草稿版本重置编辑器，页面与模型状态继续复用。 */
  function startChat(path = projectPath, novelId: string | null = null) {
    // 主动重开当前草稿才清空。每个项目目录和小说各自保存输入。
    if (page === 'chat' && !sessionId && novelId === workspaceId && path === projectPath) {
      chatDraft(novelId ? 'new-novel:' + novelId : 'new:' + path.trim()).onDraftChange('');
    }
    updateRoute({ page: 'chat', sessionId: null, projectPath: path, workspaceId: novelId });
    setStartRevision(value => value + 1);
    setWorkspaceOpen(false);
  }
  /** 服务端确认后刷新分组；归档当前会话时解除选中，不影响期间切换到的其他会话。 */
  async function organize(chat: ChatSummary, changes: Partial<SessionOrganization>) {
    try {
      await requestJson('/api/sessions/' + encodeURIComponent(chat.id) + '/organization', 'PUT', changes);
      if (changes.archived) clearSession(chat.id, chat.projectPath ?? '', chat.workspaceId);
      await refreshChats();
    } catch (error) { notifyRequestError(error, 'chat-organization'); }
  }

  /** 等待接口确认永久删除，失败时保留弹窗供重试。 */
  async function deleteChat() {
    if (!chatToDelete || saving) return;
    setSaving(true);
    try {
      await requestJson('/api/sessions/' + encodeURIComponent(chatToDelete.id), 'DELETE');
      clearSession(chatToDelete.id, chatToDelete.projectPath ?? '', chatToDelete.workspaceId);
      setChatToDelete(null);
      await refreshChats();
    } catch (error) { notifyRequestError(error, 'chat-management'); }
    finally { setSaving(false); }
  }
  /** 逐条复用公开接口，避免大批量请求占满连接；最后只刷新一次，失败项可单独重试。 */
  async function applyArchiveBatch(targets: ChatSummary[], action: 'restore' | 'delete' | 'archive') {
    const failed: string[] = [];
    let reason = '';
    for (const chat of targets) {
      const path = '/api/sessions/' + encodeURIComponent(chat.id);
      try {
        if (action !== 'delete') {
          await requestJson(path + '/organization', 'PUT', { archived: action === 'archive' });
          if (action === 'archive') clearSession(chat.id, chat.projectPath ?? '', chat.workspaceId);
        } else {
          await requestJson(path, 'DELETE');
          clearSession(chat.id, chat.projectPath ?? '', chat.workspaceId);
        }
      } catch (error) {
        failed.push(chat.id);
        reason = error instanceof Error ? error.message : '请重试';
      }
    }
    await refreshChats();
    if (failed.length) {
      const error = new Error(`已完成 ${targets.length - failed.length} 项，${failed.length} 项失败。${reason}`);
      if (action === 'archive') throw error;
      notifyRequestError(error, 'archive-batch');
    }
    return failed;
  }
  /** 标题保存后按会话 ID 同步侧栏名称，切换对话不会串名。 */
  async function renameChat(id: string, name: string) {
    const saved = await requestJson<SessionSummary>('/api/sessions/' + encodeURIComponent(id) + '/name', 'PUT', { name });
    setChats(current => current.map(chat => chat.id === id ? { ...chat, name: saved.name } : chat));
    return saved.name;
  }
  /** 只修改登记属性，书架和切换器共用服务端返回的名称，隐藏仅在侧栏分组时过滤。 */
  async function updateGroup(group: ChatGroup, { name, ...flags }: { name?: string; pinned?: boolean; sidebarHidden?: boolean }) {
    const id = encodeURIComponent(group.id);
    if (group.kind === 'project') {
      const saved = await requestJson<Project>('/api/projects/' + id, 'PUT', { ...flags, name });
      setProjects(current => current.map(item => item.id === saved.id ? saved : item));
    } else {
      const saved = await requestJson<Workspace>('/api/workspaces/' + id + '/shelf', 'PUT', { ...flags, title: name });
      setWorkspaces(current => current.map(item => item.id === saved.id ? saved : item));
    }
  }
  const currentBook = workspaces.find(workspace => workspace.id === bookId);
  const projectName = projects.find(project => project.path === projectPath)?.name
    ?? (projectPath.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || projectPath);
  return (
    <ThemeRoot color={theme.color}>
      <ToastViewport />
      {/* 两级页面共用外壳和侧栏宽度；保留主导航节点，返回时可恢复展开状态与焦点。 */}
      <GlobalLayout sidebar={<>
        <div hidden={settingsOpen} style={{ height: '100%' }}>
        <AppSidebar page={page} sessionId={sessionId} chats={chats} listState={listState}
        onOrganize={organize} onGroupUpdate={updateGroup} onArchiveGroup={async targets => { await applyArchiveBatch(targets, 'archive'); }}
        projects={projects} projectState={projectState} currentProjectPath={projectPath}
        onPageChange={navigate} onRefresh={async () => { await Promise.all([refreshChats(), refreshProjects()]); }} onChooseProject={() => setProjectDialog('create')}
        onOpenChat={chat => updateRoute({ page: 'chat', sessionId: chat.id })}
        onNewChat={path => path === undefined && (activeChat?.workspaceId ?? workspaceId)
          ? startChat('', activeChat?.workspaceId ?? workspaceId) : startChat(path)} workspaces={workspaces} workspaceState={workspaceState}
        onCreateNovel={() => setCreatingNovel(true)} onRefreshWorkspaces={refreshWorkspaces} onNewNovelChat={id => startChat('', id)} />
        </div>
        {settingsSection ? <SettingsSidebar onBack={closeSettings} section={settingsSection}
          onSelect={settings => updateRoute({ settings }, 'replace')} /> : null}
      </>}>
        <div className="plotloom-app-content" data-hidden={settingsOpen} inert={settingsOpen} aria-hidden={settingsOpen || undefined}>
          {page === 'chat' ? <ChatWorkspace open={panelOpen} onOpenChange={changePanelOpen} sessionId={sessionId} workspaceId={bookId} draftRevision={startRevision}
            updatedAt={activeChat?.updatedAt} onAccepted={() => setAcceptedRevision(value => value + 1)}>{(openCitations, openTurnChanges, openManuscript, openDeliverable, quoteDraft) => sessionId ?
            <ChatPage acceptedRevision={acceptedRevision} novelRoot={currentBook?.root} title={activeChat?.name} key={sessionId} sessionId={sessionId} onRename={renameChat} settingsRevision={modelRevision + skillRevision}
              onSessionsChange={refreshChats} onOpenCitations={openCitations} onOpenTurnChanges={openTurnChanges}
              onOpenManuscript={openManuscript} onOpenDeliverable={openDeliverable} quoteDraft={quoteDraft} /> :
            <NewChatPage modelRevision={modelRevision} skillRevision={skillRevision} draftRevision={startRevision} projectPath={projectPath} onStarted={openStartedChat}
              workspaceId={workspaceId} workspaceTitle={currentBook?.title} novelRoot={currentBook?.root} quoteDraft={quoteDraft}
              renderProjectControl={disabled => <ProjectSwitcher projects={projects} currentPath={projectPath} projectName={projectName || '选择项目'}
                state={projectState} disabled={disabled} open={projectDialog === 'switch'}
                onOpenChange={open => setProjectDialog(open ? 'switch' : null)} onRetry={() => void refreshProjects()}
                onCreate={() => setProjectDialog('create-from-switch')} onSelect={project => {
                  // 选择当前项目只收起浮窗；换项目仅重置草稿，复用页面和模型配置。
                  if (project.path !== projectPath) startChat(project.path);
                  setProjectDialog(null);
                }} />} />}</ChatWorkspace> : null}
          {page === 'skills' ? <SkillsPage skillRevision={skillRevision} /> : null}
          {page === 'novels' ? <NovelsPage workspaces={workspaces} state={workspaceState} workspaceId={workspaceId}
            onOpen={id => updateRoute({ sessionId: null, workspaceId: id })} onRefresh={refreshWorkspaces}
            onUpdate={updated => setWorkspaces(current => current.map(book => book.id === updated.id ? updated : book))}
            onCreate={() => setCreatingNovel(true)} /> : null}
        </div>
        {settingsSection ? <SettingsPage section={settingsSection} color={theme.color} onColorChange={theme.setColor}
          archived={chats.filter(chat => chat.archived)} archiveStatus={listState} projects={projects} onBatch={applyArchiveBatch}
          onRestore={chat => void organize(chat, { archived: false })} onDelete={setChatToDelete}
          onModelsChange={() => setModelRevision(v => v + 1)} onSkillsChange={() => setSkillRevision(v => v + 1)} /> : null}
      </GlobalLayout>
      {creatingNovel && <CreateNovelDialog onClose={() => setCreatingNovel(false)} onCreated={book => {
        setWorkspaces(current => [...current.filter(item => item.id !== book.id), book]);
        setCreatingNovel(false);
        startChat('', book.id);
      }} />}
      {chatToDelete && <Dialog open title="永久删除对话"
        onOpenChange={open => { if (!open && !saving) setChatToDelete(null); }}
        footer={<><Button variant="ghost" disabled={saving} onClick={() => setChatToDelete(null)}>取消</Button>
          <Button loading={saving} onClick={() => void deleteChat()}>确认永久删除</Button></>}>
        <p>永久删除“{chatToDelete.name}”及其附件？删除后无法恢复。</p>
      </Dialog>}
      {projectDialog === 'create' || projectDialog === 'create-from-switch' ? <CreateProjectDialog
        onCancel={() => setProjectDialog(projectDialog === 'create-from-switch' ? 'switch' : null)}
        onCreated={project => {
          setProjects(current => [project, ...current]); setProjectState('ready');
          startChat(project.path); setProjectDialog(null);
          void refreshProjects();
        }} /> : null}
    </ThemeRoot>
  );
}
