import { GlobalLayout } from '@plotloom/ui/layouts/global-layout';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Dialog } from '@plotloom/ui/dialog';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { ThemeRoot } from '@plotloom/ui/theme-root';
import type { Project, SessionSummary, SessionOrganization } from '@plotloom/contracts';
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
import { AppSidebar, type AppPage } from '../features/navigation/app-sidebar';
import { CreateProjectDialog } from '../features/navigation/create-project-dialog';
import { ProjectSwitcher } from '../features/navigation/project-switcher';
import { useAppRoute } from './app-route';
import './app.css';

/** 品牌、页面导航和保存反馈属于应用；布局、按钮及选色能力来自通用组件库。 */
export function App() {
  const { route, updateRoute, closeSettings, clearSession } = useAppRoute();
  const { page, sessionId, settings: settingsSection } = route;
  const settingsOpen = settingsSection !== null;
  const [modelRevision, setModelRevision] = useState(0);
  const [skillRevision, setSkillRevision] = useState(0);
  const settingsTrigger = useRef<HTMLElement | null>(null);
  /** 设置属于二级导航，不覆盖原页面；返回恢复入口焦点和原来的页面状态。 */
  function navigate(next: AppPage) {
    if (next === 'settings') {
      settingsTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      updateRoute({ settings: 'appearance' }, 'open-settings');
    } else updateRoute({ page: next });
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectState, setProjectState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [projectDialog, setProjectDialog] = useState<'create' | 'switch' | 'create-from-switch' | null>(null);
  const [chatDialog, setChatDialog] = useState<{ chat: ChatSummary; action: 'rename' | 'delete' } | null>(null);
  const [name, setName] = useState('');
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
  function startChat(path?: string) {
    // 在当前新聊天页主动重开才清空；从其他页面返回时恢复对应项目的文字。
    if (page === 'chat' && !sessionId && (path ?? projectPath) === projectPath) chatDraft('new:' + projectPath.trim()).onDraftChange('');
    updateRoute({ page: 'chat', sessionId: null, projectPath: path ?? projectPath });
    setStartRevision(value => value + 1);
    setWorkspaceOpen(false);
  }
  /** 服务端确认后刷新分组；归档当前会话时解除选中，不影响期间切换到的其他会话。 */
  async function organize(chat: ChatSummary, changes: Partial<SessionOrganization>) {
    try {
      await requestJson('/api/sessions/' + encodeURIComponent(chat.id) + '/organization', 'PUT', changes);
      if (changes.archived) clearSession(chat.id, chat.projectPath ?? '');
      await refreshChats();
    } catch (error) { notifyRequestError(error, 'chat-organization'); }
  }

  /** 删除和改名都等待接口确认，失败时保留弹窗供重试。 */
  async function saveChatDialog() {
    if (!chatDialog || saving) return;
    setSaving(true);
    try {
      const path = '/api/sessions/' + encodeURIComponent(chatDialog.chat.id);
      if (chatDialog.action === 'rename') await requestJson(path + '/name', 'PUT', { name: name.trim() });
      else {
        await requestJson(path, 'DELETE');
        clearSession(chatDialog.chat.id, chatDialog.chat.projectPath ?? '');
      }
      setChatDialog(null);
      await refreshChats();
    } catch (error) { notifyRequestError(error, 'chat-management'); }
    finally { setSaving(false); }
  }
  const projectName = projects.find(project => project.path === projectPath)?.name
    ?? (projectPath.replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) || projectPath);
  return (
    <ThemeRoot color={theme.color}>
      <ToastViewport />
      {/* 两级页面共用外壳和侧栏宽度；保留主导航节点，返回时可恢复展开状态与焦点。 */}
      <GlobalLayout sidebar={<>
        <div hidden={settingsOpen} style={{ height: '100%' }}>
        <AppSidebar page={page} sessionId={sessionId} chats={chats} listState={listState}
        onOrganize={organize} onRename={chat => { setName(chat.name); setChatDialog({ chat, action: 'rename' }); }}
        projects={projects} projectState={projectState} currentProjectPath={projectPath}
        onPageChange={navigate} onRefresh={async () => { await Promise.all([refreshChats(), refreshProjects()]); }} onChooseProject={() => setProjectDialog('create')}
        onOpenChat={chat => updateRoute({ page: 'chat', sessionId: chat.id })}
        onNewChat={startChat} />
        </div>
        {settingsSection ? <SettingsSidebar onBack={closeSettings} section={settingsSection}
          onSelect={settings => updateRoute({ settings }, 'replace')} /> : null}
      </>}>
        <div className="plotloom-app-content" data-hidden={settingsOpen} inert={settingsOpen} aria-hidden={settingsOpen || undefined}>
          {page === 'chat' ? <ChatWorkspace open={workspaceOpen} onOpenChange={setWorkspaceOpen}>{sessionId ? <ChatPage title={activeChat?.name} key={sessionId} sessionId={sessionId} settingsRevision={modelRevision + skillRevision} onSessionsChange={refreshChats} /> :
            <NewChatPage modelRevision={modelRevision} draftRevision={startRevision} projectPath={projectPath} onStarted={openStartedChat}
              renderProjectControl={disabled => <ProjectSwitcher projects={projects} currentPath={projectPath} projectName={projectName}
                state={projectState} disabled={disabled} open={projectDialog === 'switch'}
                onOpenChange={open => setProjectDialog(open ? 'switch' : null)} onRetry={() => void refreshProjects()}
                onCreate={() => setProjectDialog('create-from-switch')} onSelect={project => {
                  // 选择当前项目只收起浮窗；换项目仅重置草稿，复用页面和模型配置。
                  if (project.path !== projectPath) startChat(project.path);
                  setProjectDialog(null);
                }} />} />}</ChatWorkspace> : null}
          {page === 'skills' ? <SkillsPage skillRevision={skillRevision} /> : null}
          {page === 'novels' ? <PageLayout title="小说管理" style={{ height: '100%' }}><p>小说管理暂未开放，已有小说会话可从侧边栏打开。</p></PageLayout> : null}
        </div>
        {settingsSection ? <SettingsPage section={settingsSection} color={theme.color} onColorChange={theme.setColor}
          archived={chats.filter(chat => chat.archived)} archiveStatus={listState}
          onRestore={chat => void organize(chat, { archived: false })} onDelete={chat => setChatDialog({ chat, action: 'delete' })}
          onModelsChange={() => setModelRevision(v => v + 1)} onSkillsChange={() => setSkillRevision(v => v + 1)} /> : null}
      </GlobalLayout>
      {chatDialog && <Dialog open title={chatDialog.action === 'rename' ? '重命名对话' : '永久删除对话'}
        onOpenChange={open => { if (!open && !saving) setChatDialog(null); }}
        footer={<><Button variant="ghost" disabled={saving} onClick={() => setChatDialog(null)}>取消</Button>
          <Button loading={saving} disabled={saving || (chatDialog.action === 'rename' && !name.trim())}
            onClick={() => void saveChatDialog()}>{chatDialog.action === 'rename' ? '保存' : '确认永久删除'}</Button></>}>
        {chatDialog.action === 'rename' ? <Input autoFocus aria-label="对话名称" maxLength={120} value={name}
          onChange={event => setName(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim()) void saveChatDialog();
          }} /> : <p>永久删除“{chatDialog.chat.name}”及其附件？删除后无法恢复。</p>}
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
