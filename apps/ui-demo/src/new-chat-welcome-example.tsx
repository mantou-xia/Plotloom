import { useState } from 'react';
import type { ComponentExample } from '@plotloom/ui/workbench/catalog';
import { NewChatWelcome } from '../../web/src/features/agent/new-chat-welcome';
import { ProjectSwitcher } from '../../web/src/features/navigation/project-switcher';

const projects = [{ id: 'daily', name: '日常工作', path: 'D:/projects/daily', createdAt: '2026-11-26T00:00:00Z' }];

export const newChatWelcomeExample: ComponentExample = {
  id: 'new-chat-welcome', name: '新聊天欢迎区', category: '产品聊天',
  exportPath: 'apps/web/src/features/agent/new-chat-welcome.tsx',
  description: '根据会话归属显示普通聊天、项目或小说的入口提示。',
  interaction: 'workspaceSelected 和 projectSelected 表示归属。projectControl 展示真实的项目选择器，可选择示例项目或取消。',
  width: 720, height: 360,
  states: [
    { id: 'general', name: '普通聊天', description: '可直接发消息，也可打开项目选择。' },
    { id: 'project', name: '项目对话', description: '打开项目菜单，选择「取消项目选择」返回普通聊天。' },
    { id: 'novel', name: '小说对话', description: '显示当前小说。' },
  ],
};

export function NewChatWelcomeExample({ state, onAction }: { state: string; onAction: (action: string) => void }) {
  const [path, setPath] = useState(state === 'project' ? projects[0].path : '');
  const [open, setOpen] = useState(false);
  // 预览只更新示例归属，由真实菜单触发选择和取消。
  function select(next: string) {
    setPath(next); setOpen(false);
    onAction(next ? '选择示例项目' : '取消项目选择');
  }
  return <NewChatWelcome workspaceSelected={state === 'novel'} workspaceTitle="归潮" projectSelected={!!path}
    projectControl={<ProjectSwitcher projects={projects} currentPath={path} projectName={path ? projects[0].name : '选择项目'}
      state="ready" open={open} disabled={false} onOpenChange={setOpen} onRetry={() => {}}
      onSelect={project => select(project.path)} onClear={() => select('')}
      onCreate={() => { setOpen(false); onAction('新建项目'); }} />} />;
}
