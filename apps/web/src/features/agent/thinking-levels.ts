import type { ThinkingLevel } from '@plotloom/contracts';

export const thinkingLabels: Record<ThinkingLevel, string> = {
  off: '关闭', minimal: '最低', low: '低', medium: '中', high: '高', xhigh: '极高', max: '最高',
};

/** 切换模型时保留共同支持的档位，否则选用目标模型的第一个可用档位。 */
export function selectThinkingLevel(levels: ThinkingLevel[] | undefined, current: ThinkingLevel): ThinkingLevel {
  return levels?.includes(current) ? current : levels?.[0] ?? 'off';
}
