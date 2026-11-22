import { invalid } from '@plotloom/domain';

export interface WorldRule {
  subject: string;
  fact: string;
  effective: number;
  revealed: number | null;
  evidence?: { path?: string; quote: string };
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
