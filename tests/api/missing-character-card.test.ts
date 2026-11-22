import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, events, assertFinal } from './client.ts';
import { createModelFixture, TEST_KEY } from './fixture.ts';

test('交稿后提醒缺卡，跳过按情节记住，起草和写入分别确认', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plotloom-missing-card-'));
  const model = await createModelFixture();
  const models = join(root, 'models.json');
  await writeFile(models, JSON.stringify({ providers: { test: { api: 'openai-completions', baseUrl: model.baseUrl,
    models: [{ id: 'fixture', name: 'fixture', reasoning: false, input: ['text'], contextWindow: 128000, maxTokens: 4096 }] } } }));
  const env = { PLOTLOOM_DATA_DIR: join(root, 'data'), PLOTLOOM_MODELS_PATH: models, PLOTLOOM_PROVIDER: 'test', PLOTLOOM_MODEL: 'fixture', PLOTLOOM_API_KEY: TEST_KEY };
  let api = await startServer(env);
  try {
    const book = join(root, 'book');
    await mkdir(book);
    const ws = await api.json('/api/workspaces', 'POST', { title: '码头', root: book }, 201);
    const base = '/api/workspaces/' + ws.id;
    const chat = await api.json(base + '/sessions', 'POST', {}, 201);
    const session = '/api/sessions/' + chat.id;
    const cards = async (name: string) => (await api.json(base + '/character-cards?character=' + encodeURIComponent(name))).cards;
    for (const [name, chapter] of [['周伯安', 1], ['阿青', 9]]) {
      await api.json(base + '/character-cards', 'POST', { character: name, chapter, content: '原有资料' }, 201);
    }
    const path = '正文章节/第四章.md';
    const key = '周掌柜接过钥匙，答应守门。';
    const letter = '阿青接下送信的差事。';
    const later = '周掌柜把账簿托付给林舟。';
    const draft = '## 性格特点\n待补充\n\n## 愿景\n待补充\n\n## 社会背景\n负责守门。\n\n## 外表特点\n待补充\n\n## 特殊性\n待补充';
    const offer = (character: string, quote: string, content?: string) => ({ name: 'suggest_character_card',
      args: { character, chapter: 4, evidence: { path, quote }, reason: '后文要沿用人物的承诺。', content } });
    async function run(steps: unknown[], answers: ('yes' | 'no' | 'stop')[], prefix = '') {
      const questions: string[] = [];
      const received = [];
      const text = prefix + 'WRITE:' + JSON.stringify({ steps });
      for await (const event of events(await api.request(session + '/messages', 'POST', { text }))) {
        received.push(event);
        if (event.type !== 'user_answer_required' && event.type !== 'tool_approval_required') continue;
        const answer = answers[questions.length];
        questions.push(event.type === 'user_answer_required' ? event.question.question : event.approval.preview ?? '');
        assert(answer, '意外重复询问：' + questions.at(-1));
        if (answer === 'stop') await api.json(session + '/stop', 'POST');
        else if (event.type === 'user_answer_required') await api.json(session + '/questions/' + event.question.id + '/answer', 'POST',
          { kind: 'option', index: answer === 'yes' ? 1 : 2 });
        else await api.json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: answer === 'yes' ? 'approve' : 'deny' });
      }
      assertFinal(received, answers.includes('stop') ? 'aborted' : 'completed');
      assert.equal(questions.length, answers.length);
      return { questions, received };
    }
    const first = await run([{ name: 'write_chapter_part', args: { part: 1, content: [key, letter, later].join('\n\n') } },
      { name: 'review_writing', args: { status: 'clear', issues: [] } }, { name: 'deliver_chapter', args: { partCount: 1, reason: '交稿' } },
      offer('周掌柜', key), offer('周伯安', key)], ['yes', 'no'], '写第四章：托付。\n');
    assert.match(first.questions[1], /周伯安/);
    assert.equal((await cards('周掌柜')).length, 0);
    await api.close(); api = await startServer(env);
    await run([offer('周掌柜', '答应守门。')], []);
    const early = await run([offer('阿青', letter)], ['yes']);
    assert.match(early.questions[0], /已有第 9 章角色卡/);
    assert.equal((await cards('阿青')).length, 1);
    await run([offer('阿青', letter, draft)], ['yes']);
    assert.deepEqual((await cards('阿青')).map((card: any) => card.chapter), [4, 9]);
    const bypass = await run([offer('周掌柜', later, draft)], []);
    assert(bypass.received.some(e => e.type === 'tool_end' && e.outcome === 'failed'));
    await run([offer('周掌柜', later)], ['stop']);
    await run([offer('周掌柜', later), offer('周掌柜', later, draft)], ['yes', 'yes']);
    assert.deepEqual((await cards('周掌柜')).map((card: any) => card.evidence.quote), [later]);
    await run([offer('周掌柜', later)], []);
    // 候选送出后由独立接口完成审阅，聊天仍在同一轮等待，作者不需要再发一次复核消息。
    for (const action of ['reject', 'accept']) {
      const scene = '哑仆收起了出城的令牌。';
      const steps = [{ name: 'write_chapter_part', args: { part: 1, content: scene } },
        { name: 'review_writing', args: { status: 'clear', issues: [] } }, { name: 'deliver_chapter', args: { partCount: 1, reason: '重写' } },
        offer('哑仆', scene)];
      const received = [];
      let proposalId = '';
      for await (const event of events(await api.request(session + '/messages', 'POST', { text: '重写第四章：令牌。\nWRITE:' + JSON.stringify({ steps }) }))) {
        received.push(event);
        if (event.type === 'tool_approval_required') await api.json(session + '/tool-approvals/' + event.approval.id, 'POST', { decision: 'approve' });
        if (event.type === 'tool_end' && event.name === 'deliver_chapter') proposalId = event.manuscriptView!.proposalId!;
        if (event.type === 'tool_start' && event.name === 'suggest_character_card') {
          const proposal = await api.json(base + '/proposals/' + proposalId);
          assert.equal(proposal.status, 'pending');
          assert.equal((await api.json(session)).pendingQuestion, undefined);
          for (const change of proposal.changes)
            await api.json(base + '/proposals/' + proposalId + '/changes/' + change.id, 'POST', { action });
        }
        if (event.type === 'user_answer_required') {
          const isOffer = event.question.question.includes('值得记录的原因');
          if (isOffer) assert.equal(action, 'accept');
          await api.json(session + '/questions/' + event.question.id + '/answer', 'POST', { kind: 'option', index: isOffer ? 2 : 1 });
        }
      }
      assertFinal(received, 'completed');
      assert.equal(received.filter(e => e.type === 'user_answer_required' && e.question.question.includes('值得记录的原因')).length, action === 'accept' ? 1 : 0);
    }
    assert.deepEqual(model.errors, []);
  } finally { await api.close(); await model.close(); await rm(root, { recursive: true, force: true }); }
});
