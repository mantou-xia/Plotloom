import { AgentError, publicError, type AgentService, type WeixinWriteTurn } from '@plotloom/agent-pi';
import { ImError, type ImAgent } from '@plotloom/application/weixin';
import type { PublicError } from '@plotloom/contracts';
import type { CreateSessionRequest, Project } from '@plotloom/contracts';
import type { Workspace } from '@plotloom/contracts/workspaces';

/** 只在装配层接触 SDK 服务；微信复用现有会话、工具审批与提问，不创建第二套 Agent 循环。 */
export function imAgent(agent: AgentService, targets: {
  novels(): Promise<Workspace[]>;
  projects(): Promise<Project[]>;
  createNovel(id: string, request: CreateSessionRequest): Promise<{ id: string }>;
  project(id: string): Promise<Project>;
  personaName(): Promise<string>;
}): ImAgent {
  const wrap = async <T>(task: () => Promise<T>): Promise<T> => {
    try { return await task(); }
    catch (error) {
      if (error instanceof AgentError) throw new ImError(error.code, error.message, error.statusCode);
      throw error;
    }
  };
  return {
    personaName: () => targets.personaName(),
    async listTargets() {
      const [novels, projects] = await Promise.all([targets.novels(), targets.projects()]);
      return [
        ...novels.map(novel => ({ kind: 'novel' as const, id: novel.id, name: novel.title })),
        ...projects.map(project => ({ kind: 'project' as const, id: project.id, name: project.name })),
      ];
    },
    // 通过现有项目、小说入口创建会话，目标选择不能扩大本机工具可访问的目录。
    createTargetSession: target => wrap(async () => {
      const request = { name: `微信 · ${target.name}`.slice(0, 120) };
      if (target.kind === 'novel') return (await targets.createNovel(target.id, request)).id;
      const project = await targets.project(target.id);
      return (await agent.createSession({ ...request, projectPath: project.path })).id;
    }),
    inspect: id => wrap(async () => {
      const session = await agent.getSession(id);
      return { activity: session.activity, question: session.pendingQuestion };
    }),
    // 复制会话配置和归属，生成历史从空白开始，文件操作继续使用新会话的默认审批。
    createFreshSession: id => wrap(async () => {
      const [session, profile] = await Promise.all([agent.getSession(id), agent.getSkillProfile(id)]);
      const { provider, model, thinkingLevel, projectPath } = session;
      const input = { provider, model, thinkingLevel, name: '微信对话' };
      if (profile.workspaceId) return (await agent.createSession(input, { ...profile, workspaceId: profile.workspaceId })).id;
      const fresh = projectPath ? await agent.createSession({ ...input, projectPath }) : await agent.createGeneralSession(input);
      if (profile.skillIds !== null) await agent.setSkills(fresh.id, profile.skillIds);
      return fresh.id;
    }),
    answer: (id, questionId, text) => wrap(async () => {
      const option = /^选项\s*(\d+)$/.exec(text);
      await agent.answerQuestion(id, questionId, text === '跳过' ? { kind: 'skip' }
        : option ? { kind: 'option', index: Number(option[1]) } : { kind: 'custom', text });
    }),
    stop: id => wrap(async () => { await agent.stop(id); }),
    createGeneralSession: () => wrap(async () => (await agent.createGeneralSession({ name: '微信 · 普通聊天' })).id),
    run: (id, text, notice, signal) => wrap(async () => {
      signal.throwIfAborted();
      const deferred: WeixinWriteTurn = {};
      const execute = await agent.prepareMessage(id, text, [], undefined, undefined, undefined, 'weixin', deferred);
      let stopped = false;
      let stopTask: Promise<unknown> | undefined;
      const stop = () => { stopped = true; stopTask = agent.stop(id).catch(() => {}); };
      signal.addEventListener('abort', stop, { once: true });
      let error: PublicError | undefined;
      let acceptedId: string | undefined;
      try {
        // prepareMessage 已占用会话；即使刚好取消，也须启动执行入口让 SDK 释放锁。
        const running = execute(event => {
          if (event.type === 'accepted') acceptedId = event.messageId;
          else if (event.type === 'failed') error = event.error;
          else if (event.type === 'aborted') error = { code: 'GENERATION_ABORTED', message: '本轮生成已停止。' };
          else if (event.type === 'user_answer_required') {
            const question = event.question;
            notice(`${question.question}\n${question.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}\n回复“选项 1”、直接输入答案或“跳过”。`);
          }
        });
        if (signal.aborted) stop();
        await running; await stopTask;
        if (stopped) return { text: '', error: { code: 'IM_PROCESS_INTERRUPTED', message: '微信连接已停止。' } };
        if (error) return { text: error.message, error };
        if (deferred.write) {
          const { operation, path, preview, decide } = deferred.write;
          const label = { create: '新建', overwrite: '覆盖', edit: '修改' }[operation];
          return { text: '', write: { preview: `待确认文件变更\n${label}：${path}\n\n${preview}`, decide: approve => wrap(() => decide(approve)) } };
        }
        if (deferred.requiresWeb) return { text: '', error: {
          code: 'IM_APPROVAL_WEB_REQUIRED', message: '这项操作需要在平台网页确认，请在网页重新发起。',
        } };
        const session = await agent.getSession(id);
        const turnId = session.messages.find(message => message.id === acceptedId)?.turnId;
        const last = turnId ? session.messages.findLast(message => message.turnId === turnId && message.role === 'assistant' && message.phase === 'answer') : undefined;
        return { text: last?.content.filter(block => block.type === 'text').map(block => block.text).join('') ?? '' };
      } catch (cause) { return { text: '', error: publicError(cause) }; }
      finally { signal.removeEventListener('abort', stop); }
    }),
  };
}
