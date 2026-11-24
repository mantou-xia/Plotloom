import { chapterFromTitle } from '@plotloom/contracts/writing';
import { invalid } from '@plotloom/domain';

export interface WorldRule {
  subject: string;
  fact: string;
  effective: number;
  revealed: number | null;
  impact?: string;
  evidence?: { path?: string; quote: string };
}

/** 章稿只接受可直接摘录的通则句，避免把人物经历或判断扩写成规则。含蓄设定由作者补明。 */
export function checkChapterRule(rule: WorldRule, path: string, quote: string, content: string | undefined) {
  const chapter = chapterFromTitle(path.split('/').at(-1) ?? '');
  if (!path.startsWith('正文章节/') || !chapter) invalid('请引用带章号的正式正文章节。');
  if (rule.revealed !== null && rule.revealed !== chapter) invalid('从章稿提议时，揭示章只能填证据所在章；无法确定时填未揭示。');
  if (rule.fact.trim() !== quote.trim()) invalid('章稿规则须原样使用一条完整规则句，不拼接、改写或推导。');
  const statement = quote.trim();
  // 只接受正文里边界完整、以适用条件或普遍对象开头的句子。对白内的短句不能截出来当通则。
  if (!/^(?:凡|任何|无论|不论|每当|只要|所有|一切)[^。！？\r\n“”「」]+。$/u.test(statement)
    || !content?.split(/\r?\n/u).some(line => line.trim().startsWith(statement))) {
    invalid('正文须直接写出独立的全书通则句。单次经历、人物对白或判断请留在剧情资料中。');
  }
}

/** 同主题保留历次设定。正文用普通 Markdown，章节标记区分规则生效和主角得知的时间。 */
export function ruleSection(rule: WorldRule): string {
  if ([rule.subject, rule.fact].some(text => !text.trim() || /[\r\n]/.test(text))) invalid('主题和设定各占一行。');
  const evidence = rule.evidence ? '\n\n出处：' + (rule.evidence.path ?? '作者本轮原话') + ' · ' + rule.evidence.quote.replace(/\s+/g, ' ') : '';
  return '## ' + rule.subject.trim() + '\n生效章节：' + rule.effective + '\n揭示章节：' + (rule.revealed ?? '未揭示')
    + '\n\n' + rule.fact.trim() + evidence;
}

/** 作者讨论可查看全貌。按章写作只返回已成立且已揭示的规则，手改后无法识别的段落仅留给作者查看。 */
export function worldviewAt(content: string, chapter?: number): string {
  if (chapter === undefined) return content;
  const visible = new Map<string, { effective: number; revealed: number; section: string }>();
  for (const section of content.replace(/\r\n/g, '\n').split(/^## /m).slice(1)) {
    const match = /^([^\n]+)\n生效章节：(\d+)\n揭示章节：(\d+|未揭示)\n\n([\s\S]+)/.exec(section);
    if (!match) continue;
    const [, subject, start, reveal, fact] = match;
    if (+start > chapter || reveal === '未揭示' || +reveal > chapter) continue;
    const previous = visible.get(subject);
    if (previous && (previous.effective > +start || (previous.effective === +start && previous.revealed > +reveal))) continue;
    visible.set(subject, { effective: +start, revealed: +reveal, section: subject + '：' + fact.split('\n\n出处：')[0].trimEnd() });
  }
  return [...visible.values()].map(rule => rule.section).join('\n');
}
