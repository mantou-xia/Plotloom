import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatSummary } from '../../packages/contracts/src/skills.ts';
import { chatTimeLabel, groupSidebarChats } from '../../apps/web/src/features/navigation/sidebar-data.ts';

/** 使用跨平台目录和混合归属验证实际分类规则，不依赖组件的 DOM 实现。 */
function chat(id: string, updatedAt: string, extra: Partial<ChatSummary> = {}): ChatSummary {
  return { id, name: id, updatedAt, archived: false, pinned: false, workspaceId: null, status: 'idle', activity: 'idle', provider: 'test', model: 'test', thinkingLevel: 'off', ...extra };
}

test('最近汇总所有未归档记录并按更新时间倒序，保留各归属和置顶入口', () => {
  const older = '2026-11-18T00:00:00Z';
  const newer = '2026-11-19T00:00:00Z';
  const chats = [chat('p1', older, { projectPath: 'D:\\projects\\Plotloom' }),
    chat('n1', newer, { workspaceId: 'novel', projectPath: 'D:\\novels\\灯塔' }),
    chat('p2', newer, { projectPath: 'D:\\projects\\Plotloom' }),
    chat('hidden', newer, { archived: true, pinned: true }), chat('pinned-novel', newer, { pinned: true, workspaceId: 'novel' }),
    chat('linux', older, { projectPath: '/home/projects/story/' })];
  const result = groupSidebarChats(chats, [
    { id: 'novel', title: '灯塔', root: 'D:\\novels\\灯塔', createdAt: older },
    { id: 'empty', title: '新小说', root: 'D:\\novels\\新小说', createdAt: newer },
  ], [
    { id: 'p', name: '自定义项目名', path: 'D:\\projects\\Plotloom', createdAt: older },
    { id: 'empty-project', name: '没有聊天的项目', path: '/home/new', createdAt: newer },
  ]);
  assert.deepEqual(result.pinned.map(item => item.id), ['pinned-novel']);
  assert.deepEqual(result.projects.map(group => [group.label, group.chats.map(item => item.id)]), [
    ['自定义项目名', ['p2', 'p1']], ['没有聊天的项目', []],
  ]);
  assert.deepEqual(result.novels.map(group => [group.label, group.chats.map(item => item.id)]), [['灯塔', ['n1', 'pinned-novel']], ['新小说', []]]);
  assert.deepEqual(result.recent.map(item => item.id), ['n1', 'p2', 'pinned-novel', 'p1', 'linux']);
  assert.equal(chats[0].id, 'p1', '分组不能原地重排调用方数据');
});

test('会话相对时间覆盖分钟、小时、天及服务端轻微时钟超前', () => {
  const now = Date.parse('2026-11-19T10:00:00Z');
  for (const [minutes, expected] of [[-1, '刚刚'], [0, '刚刚'], [1, '1 分钟前'], [59, '59 分钟前'], [60, '1 小时前'], [1439, '23 小时前'], [1440, '1 天前']] as const) {
    assert.equal(chatTimeLabel(new Date(now - minutes * 60_000).toISOString(), now), expected);
  }
});
