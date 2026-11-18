import type { WritingRequest, WritingSource } from '../packages/contracts/src/writing.ts';

export interface WritingSample {
  id: string; label: string; task: WritingRequest['task']; instructions: string;
  target?: { path: string; content?: string; selected?: string; last?: boolean };
  outline?: string; materials: { path: string; content: string; role: WritingSource['role'] }[];
  expected: 'proposal' | 'needs_input' | 'discussion'; criteria: string[];
}

/** 固定合成资料，不涉及用户作品；普通聊天与结构化请求使用同一组原文和要求。 */
export const WRITING_SAMPLES: WritingSample[] = [
  { id: 'scene', label: '详细大纲生成场景', task: 'chapter', expected: 'proposal',
    instructions: '按正式大纲写 150–250 字正文，第三人称限知，紧贴林舟。少解释情绪。',
    target: { path: '章节/一.md' }, outline: '林舟在雨夜码头归还铜钥匙。她把钥匙放在木箱上，不等守塔人回答便离开。结尾只留下船铃声。',
    materials: [{ path: '人物/林舟.md', role: 'character', content: '林舟：寡言克制，习惯先做后说；钥匙归还后不再取回。' }],
    criteria: ['归还铜钥匙且不取回', '林舟视角', '结尾船铃声', '无额外剧情结论'] },
  { id: 'dialogue', label: '人物对白差异', task: 'chapter', expected: 'proposal',
    instructions: '按大纲写 150–250 字，以对白和动作推进，不用旁白解释两人的性格。',
    target: { path: '章节/二.md' }, outline: '船因雾停航。寡言修船匠江石和健谈的学徒阿禾商量修船，最后决定先补船底。',
    materials: [{ path: '人物/师徒.md', role: 'character', content: '江石：说话短，先看实物再下判断，不说教。阿禾：话多，善用生活比喻，遇到不懂会发问。两人互相信任。' }],
    criteria: ['江石话短且实际', '阿禾有发问或生活比喻', '决定补船底', '没有直接解释人物性格'] },
  { id: 'continue', label: '带身体约束的续写', task: 'continue', expected: 'proposal',
    instructions: '只续写 100–180 字：她用右手拉响警铃，通知岸上的人。不要重写前文。',
    target: { path: '章节/续写.md', content: '她把湿斗篷挂在钉子上。左腕固定在夹板里，动一下就疼。\n' },
    materials: [{ path: '人物/伤势.md', role: 'character', content: '当前场景：左腕骨折并固定，不能负重或抓握；右手正常。' }],
    criteria: ['只新增尾部', '使用右手拉铃', '左腕不抓握负重'] },
  { id: 'emotion', label: '选区减少情绪解释', task: 'rewrite', expected: 'proposal',
    instructions: '把选区改成 60–100 字，通过动作体现难过，不直接说情绪名称。保持前后文。',
    target: { path: '章节/改写.md', content: '门外的雨停了。\n她非常难过，内心充满悲伤，因为那个人没有回来。\n炉火还亮着。', selected: '她非常难过，内心充满悲伤，因为那个人没有回来。' },
    materials: [], criteria: ['选区之外逐字不变', '不直接命名难过悲伤', '用动作表达'] },
  { id: 'setting', label: '人物硬设定冲突', task: 'chapter', expected: 'needs_input',
    instructions: '根据以下正式大纲写 150 字。如果有明确冲突先指出并等待我说明，不自行改变设定。',
    target: { path: '章节/冲突.md' }, outline: '林舟为了逃票，主动对船长谎称自己是失明的老人。没有其他前因。',
    materials: [{ path: '人物/原则.md', role: 'character', content: '硬设定：林舟从不说谎，也绝不冒充弱者谋取私利。当前剧情没有例外。' }],
    criteria: ['指出大纲与人物原则冲突', '引用原文证据', '提出具体澄清问题', '不生成正文候选'] },
  { id: 'viewpoint', label: '视角知情冲突', task: 'chapter', expected: 'needs_input',
    instructions: '按大纲写限知视角。如果知识范围有明确冲突，请先提问，不替我决定改成全知。',
    target: { path: '章节/视角.md' }, outline: '紧贴阿禾的第三人称限知。阿禾独坐船舱，直接确认江石此刻在岸上想背叛她。她没有收到任何消息。',
    materials: [{ path: '设定/视角.md', role: 'requirements', content: '当前阿禾不知道江石在岸上的行动或想法，也没有读心能力。叙述严格限制在阿禾所见所闻。' }],
    criteria: ['指出直接确认他人想法的冲突', '有对应资料原文证据', '等待用户而不自改视角', '不生成候选'] },
  { id: 'history', label: '指定章节原文取证', task: 'discuss', expected: 'discussion',
    instructions: '请用搜索工具在历史/第三章.md 中找到“铜扣”，读取对应原文，逐字引用包含它的完整句子，再说明后续如何用这个物件呼应。只讨论，不改稿。',
    materials: [{ path: '历史/第三章.md', role: 'history', content: '# 第三章\n她把外套搭在栏杆上。\n江石将那枚裂成两半的铜扣压进掌心，没有交给任何人。\n雾从水面上漫过来。\n' }],
    criteria: ['实际调用搜索或读取', '逐字引用铜扣原句', '不把物件写成已转交', '不生成候选'] },
  { id: 'style', label: '指定样文与风格', task: 'chapter', expected: 'proposal',
    instructions: '按大纲写 120–200 字，参考样文的短句、具体物件与留白，避免解释性情绪总结。不要复制样文情节。',
    target: { path: '章节/风格.md' }, outline: '守塔人收拾亡友留下的工具，把断齿木梳放进抽屉，继续修灯。',
    materials: [{ path: '样文/短句.md', role: 'sample', content: '桌上有一只缺口碗。她把碗转过来，缺口朝墙。粥凉了。她没有再添。' },
      { path: '要求/作品.md', role: 'requirements', content: '克制。优先具体动作和物件，不使用“命运的齿轮”“复杂的情绪”“他感到十分悲伤”。' }],
    criteria: ['短句物件留白', '木梳入抽屉后继续修灯', '未照搬缺口碗情节', '无禁止套话'] },
  { id: 'outline', label: '按需丰富大纲', task: 'enrich_outline', expected: 'proposal',
    instructions: '仅丰富这份大纲到 150 字以内，补两个动作衔接，保留原定的离开结局，不生成正文。',
    target: { path: '大纲/待丰富.md', content: '# 夜航\n林舟归还钥匙。与守塔人告别。独自乘船离开。\n' },
    materials: [], criteria: ['大纲体裁', '保留归还钥匙和独自离开', '补动作衔接', '未采纳前原大纲不变'] },
  { id: 'duplicate', label: '重复句与 emoji 精确改写', task: 'rewrite', expected: 'proposal',
    instructions: '只将选中的第二次“别等我。”改成 20–50 字克制对白和动作，其他文字不得改变。',
    target: { path: '章节/重复.md', content: '信封上画着一艘船😀。\n“别等我。”\n她没有拆信。\n“别等我。”\n潮水涨了。', selected: '“别等我。”', last: true },
    materials: [], criteria: ['仅第二处改变', '首处和 emoji 原样保留', '克制对白与动作'] },
];
