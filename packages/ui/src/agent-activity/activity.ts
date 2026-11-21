export type AgentActivity = 'thinking' | 'reading' | 'writing' | 'editing' | 'searching' | 'browsing' | 'executing' | 'processing' | 'awaiting_approval' | 'awaiting_answer';
export type ParticleShape = 'cube' | 'book' | 'pencil' | 'magnifier' | 'folder' | 'robot' | 'bricks' | 'gift' | 'sphere';
export type AgentPhase = 'working' | 'answering' | 'completed' | 'failed' | 'stopped';

/** 语义预设仅负责展示；工具名到活动的业务映射由调用方维护。 */
export const AGENT_ACTIVITIES: Record<AgentActivity, { label: string; shape: ParticleShape }> = {
  thinking: { label: '思考中', shape: 'cube' },
  reading: { label: '阅读中', shape: 'book' },
  writing: { label: '编写中', shape: 'pencil' },
  editing: { label: '修改中', shape: 'pencil' },
  searching: { label: '搜索中', shape: 'magnifier' },
  browsing: { label: '浏览中', shape: 'folder' },
  executing: { label: '执行中', shape: 'robot' },
  processing: { label: '处理中', shape: 'sphere' },
  awaiting_approval: { label: '待审批', shape: 'pencil' },
  awaiting_answer: { label: '等待用户回答', shape: 'sphere' },
};
