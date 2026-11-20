const short = '先核对用户提供的资料。\n\n- 整理目标与约束。\n- 对照已知信息，标记需要核实的部分。\n\n**以下只是组件演示文本，不代表真实模型的推理。**';
const long = Array.from({ length: 20 }, (_, i) => `### 资料核对 ${i + 1}\n\n对照任务要求与已有信息，保留需要进一步核实的内容。阅读较早片段时，新文本不会把阅读位置拉回底部。`).join('\n\n');

/** 本地静态样例只用于组件验收，正式内容必须来自公开接口。 */
export const thinkingSamples: Record<string, string> = {
  default: short, long, streaming: long, empty: '',
};
