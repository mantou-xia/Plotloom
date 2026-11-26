import type { ReactNode } from 'react';
import './new-chat-page.css';

/** 显示草稿归属，明确普通聊天可以直接发送，同时保留已有项目选择入口。 */
export function NewChatWelcome({ workspaceSelected, workspaceTitle, projectSelected, projectControl }: {
  workspaceSelected: boolean; workspaceTitle?: string; projectSelected: boolean; projectControl?: ReactNode;
}) {
  return <div className="plotloom-work-start__welcome">
    <p className="plotloom-work-start__eyebrow">{workspaceSelected ? '小说对话' : projectSelected ? '项目对话' : '普通聊天'}</p>
    <div className="plotloom-work-start__heading" role="heading" aria-level={1}>
      {workspaceSelected ? (workspaceTitle ? <>继续创作《{workspaceTitle}》</> : '小说对话')
        : projectSelected ? <>你想在 {projectControl} 中完成什么？</> : '今天想聊点什么？'}
    </div>
    <p>{workspaceSelected ? '把旧稿（TXT 或 Markdown）发给我，说「导入这些章节」。我也能从正文整理角色卡、提炼全书设定，或按大纲起草新章。'
      : projectSelected ? '从这里开始一段新的对话。' : '直接输入消息，或选择项目后开聊。'}</p>
    {!workspaceSelected && !projectSelected ? <div className="plotloom-work-start__heading">{projectControl}</div> : null}
  </div>;
}
