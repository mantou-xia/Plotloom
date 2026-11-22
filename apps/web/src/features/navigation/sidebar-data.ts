import type { ChatSummary } from '@plotloom/contracts/skills';
import type { Workspace } from '@plotloom/contracts/workspaces';
import type { Project } from '@plotloom/contracts';

export interface ChatGroup { id: string; label: string; chats: ChatSummary[]; projectPath?: string; kind: 'project' | 'novel'; pinned: boolean }

/** 最近按更新时间汇总所有未归档会话，置顶、项目和小说是对同一批记录的独立入口。 */
export function groupSidebarChats(chats: ChatSummary[], workspaces: Workspace[], registeredProjects: Project[]) {
  const projects = new Map<string, ChatGroup>(registeredProjects.filter(project => !project.sidebarHidden).map(project => [project.path,
    { id: project.id, kind: 'project', pinned: !!project.pinned, label: project.name, projectPath: project.path, chats: [] }]));
  const novels = new Map<string, ChatGroup>(workspaces.filter(workspace => !workspace.sidebarHidden).map(workspace => [workspace.id,
    { id: workspace.id, kind: 'novel', pinned: !!workspace.pinned, label: workspace.title, chats: [] }]));
  const pinned: ChatSummary[] = [];
  const recent: ChatSummary[] = [];
  const sorted = [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const chat of sorted) {
    if (chat.archived) continue;
    recent.push(chat);
    if (chat.pinned) pinned.push(chat);
    if (chat.workspaceId !== null) {
      novels.get(chat.workspaceId)?.chats.push(chat);
    } else if (chat.projectPath && projects.has(chat.projectPath)) {
      projects.get(chat.projectPath)!.chats.push(chat);
    }
  }
  // 分类内稳定置顶，保留相同置顶状态的原顺序和“最近”中的独立入口。
  const pinnedFirst = (a: ChatGroup, b: ChatGroup) => Number(b.pinned) - Number(a.pinned);
  return { pinned, projects: [...projects.values()].sort(pinnedFirst), novels: [...novels.values()].sort(pinnedFirst), recent };
}

/** 时间由公开 updatedAt 计算；调用方每分钟刷新，不能让长时间停留的页面一直显示“刚刚”。 */
export function chatTimeLabel(updatedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(updatedAt)) / 60_000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}
