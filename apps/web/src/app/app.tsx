import { GlobalLayout } from '@plotloom/ui/layouts/global-layout';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { ThemeRoot } from '@plotloom/ui/theme-root';
import { Button } from '@plotloom/ui/button';
import { Sidebar } from '@plotloom/ui/sidebar';
import { SidebarNavItem } from '@plotloom/ui/sidebar/nav-item';
import { SidebarSection } from '@plotloom/ui/sidebar/section';
import { SidebarGroup } from '@plotloom/ui/sidebar/group';
import { SidebarSessionItem } from '@plotloom/ui/sidebar/session-item';
import { SidebarSettingsItem } from '@plotloom/ui/sidebar/settings-item';
import { Book, BookOpen, LibraryBig, Plus, Settings, Sparkles } from 'lucide-react';
import type { SessionSummary } from '@plotloom/contracts';
import type { ChatSummary } from '@plotloom/contracts/skills';
import { ColorSwatches } from '@plotloom/ui/color-swatches';
import { THEME_PRESETS } from '@plotloom/ui/theme';
import { useCallback, useEffect, useState } from 'react';
import { useThemePreference } from '../features/settings/use-theme-preference';
import { requestJson } from '../utils/http';
import { ToastViewport } from '@plotloom/ui/toast';
import { notifyRequestError, runWithToast } from '../utils/feedback';
import { ChatPage } from '../features/agent/chat-page';
import { NewChatPage } from '../features/agent/new-chat-page';
import { SkillsPage } from '../features/skills/skills-page';
import './app.css';

/** 品牌、页面导航和保存反馈属于应用；布局、按钮及选色能力来自通用组件库。 */
export function App() {
  const [page, setPage] = useState<'chat' | 'skills' | 'novels' | 'settings'>('chat');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [projectPath, setProjectPath] = useState('');
  const [startRevision, setStartRevision] = useState(0);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [novelsExpanded, setNovelsExpanded] = useState(true);
  const theme = useThemePreference();
  // 普通聊天使用公开 /chats 列表，避免把小说绑定会话混进“最近”。
  const refreshChats = useCallback(async (manual = false) => {
    const load = async () => {
      try {
        const result = await requestJson<{ sessions: ChatSummary[] }>('/api/chats');
        setChats(result.sessions.filter(chat => chat.workspaceId === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        setListState('ready');
      } catch (cause) { setListState('error'); throw cause; }
    };
    if (manual) await runWithToast(load, { loading: '正在刷新聊天列表…', success: '聊天列表已刷新' });
    else try { await load(); } catch (cause) { notifyRequestError(cause, 'chat-list-error'); }
  }, []);
  useEffect(() => { void refreshChats(); }, [refreshChats]);
  // 离开聊天页后仍刷新运行状态，避免“最近”永久停留在生成中。
  useEffect(() => {
    if (!chats.some(chat => chat.status === 'running')) return;
    const timer = setTimeout(() => void refreshChats(), 1500);
    return () => clearTimeout(timer);
  }, [chats, refreshChats]);
  /** 项目独立于会话选择保存，新聊天只重置对话；服务端确认首条消息后进入记录。 */
  function openStartedChat(session: SessionSummary) {
    setSessionId(session.id);
    setProjectPath(session.projectPath ?? '');
    setPage('chat');
    setRecentExpanded(true);
    void refreshChats();
  }
  return (
    <ThemeRoot color={theme.color}>
      <ToastViewport />
      <GlobalLayout sidebar={<Sidebar style={{ height: '100%' }} label="应用导航"
        header={<div className="plotloom-app-brand">Plotloom</div>}
        fixNavItems={<SidebarNavItem label="新聊天" icon={<Plus />} onClick={() => { setSessionId(null); setStartRevision(value => value + 1); setPage('chat'); }} />}
        navItems={<>
          <SidebarNavItem label="技能" icon={<Sparkles />} active={page === 'skills'} onClick={() => setPage('skills')} />
          <SidebarNavItem label="小说管理" icon={<LibraryBig />} active={page === 'novels'} onClick={() => setPage('novels')} />
        </>}
        groups={<>
          <SidebarSection label="最近" expanded={recentExpanded} onExpandedChange={setRecentExpanded}
            contentState={listState === 'error' || chats.length ? 'ready' : 'empty'}
            emptyText={listState === 'loading' ? '正在加载…' : '暂无聊天'}>
            {chats.map(chat => <SidebarSessionItem key={chat.id} label={chat.name || '新聊天'}
              active={page === 'chat' && sessionId === chat.id} status={chat.status === 'running' ? 'running' : undefined}
              onClick={() => { setSessionId(chat.id); setProjectPath(chat.projectPath ?? ''); setPage('chat'); }} />)}
          </SidebarSection>
          {listState === 'error' ? <Button size="sm" variant="text" onClick={() => void refreshChats(true)}>重新加载</Button> : null}
          <SidebarGroup label="小说" collapsedIcon={<Book />} expandedIcon={<BookOpen />}
            expanded={novelsExpanded} onExpandedChange={setNovelsExpanded} contentState="empty" emptyText="暂无小说" />
        </>}
        footer={<SidebarSettingsItem label="设置" icon={<Settings />} active={page === 'settings'} onClick={() => setPage('settings')} />}
      />}>
        <div className="plotloom-app-content">
          {page === 'chat' ? sessionId ? <ChatPage key={sessionId} sessionId={sessionId} onSessionsChange={refreshChats} /> :
            <NewChatPage key={startRevision} projectPath={projectPath} onStarted={openStartedChat} /> : null}
          {page === 'skills' ? <SkillsPage /> : null}
          {page === 'novels' ? <PageLayout title="小说管理" style={{ height: '100%' }}><p>小说功能暂未接入。</p></PageLayout> : null}
          {page === 'settings' ? <PageLayout title="设置" padding={24} style={{ height: '100%' }}>
            <ColorSwatches color={theme.color} onChange={theme.setColor} presets={THEME_PRESETS} label="主题色" />
          </PageLayout> : null}
        </div>
      </GlobalLayout>
    </ThemeRoot>
  );
}
