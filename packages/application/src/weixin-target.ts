import type { WeixinTarget } from '@plotloom/contracts/im';

const opening = /^(?:请\s*)?(?:(?:帮我|跟我|和我|我们)\s*)?(切换到|切到|切换|打开|讨论|聊聊|聊一下|聊)\s*/u;
const general = /^(?:回到|切到|切换到|切换至)?(?:普通聊天|闲聊)(?:[，,：:]\s*(.*))?[。]?$/u;
export const maySelectWeixinTarget = (text: string) => general.test(text) || opening.test(text) || text === '可聊什么';
type Selection = { target?: WeixinTarget; text: string } | { reply: string } | undefined;

/** 仅从已登记名称解析目标。完全同名时让用户指明类型，避免把内容送错会话。 */
export function selectWeixinTarget(text: string, targets: WeixinTarget[]): Selection {
  const display = (target: WeixinTarget) => `${target.kind === 'novel' ? '小说' : '项目'}《${target.name}》`;
  const ordinary = general.exec(text);
  if (ordinary) return { text: ordinary[1]?.trim() ?? '' };
  const command = opening.exec(text);
  if (command) {
    const remaining = text.slice(command[0].length);
    const matches = targets.flatMap(target => {
      const type = target.kind === 'novel' ? '小说' : '项目';
      const aliases = [`${type}《${target.name}》`, `${type} ${target.name}`, type + target.name, `《${target.name}》`, target.name];
      const alias = aliases.find(name => remaining.slice(0, name.length).toLowerCase() === name.toLowerCase() &&
        (remaining.length === name.length || /^[\s，,：:。！？?!的里中]/u.test(remaining.slice(name.length))));
      return alias ? [{ target, alias }] : [];
    }).sort((a, b) => b.alias.length - a.alias.length);
    const best = matches.filter(item => item.alias.length === matches[0]?.alias.length);
    if (best.length === 1) {
      const [{ target, alias }] = best;
      const question = remaining.slice(alias.length).replace(/^[\s，,：:。的]+/u, '');
      return { target, text: question && !command[1].startsWith('切') ? text : question };
    }
    if (best.length > 1) return { reply: `匹配到多个目标：${best.map(({ target }) => display(target)).join('、')}。请用“切到小说《名称》”或“切到项目《名称》”。同类型重名时，请先在平台区分名称。` };
    if (!command[1].startsWith('切') && !/^(?:《|小说|项目)/u.test(remaining)) return;
  } else if (text !== '可聊什么') return;
  const names = targets.slice(0, 15).map(display).join('、');
  return { reply: names ? `可以直接普通聊天，也可以切换到：${names}。例如“切到${display(targets[0])}”。`
    : '可以直接普通聊天。平台登记小说或项目后，也可以在微信按名称切换。' };
}
