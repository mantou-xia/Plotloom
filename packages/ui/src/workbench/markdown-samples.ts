const fence = (language: string, content: string) => `\`\`\`${language}\n${content}\n\`\`\``;

const bar = {
  title: { text: '每周创作字数', left: 'center' },
  tooltip: { trigger: 'axis' },
  grid: { left: 52, right: 20, top: 60, bottom: 36 },
  xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五'] },
  yAxis: { type: 'value' },
  series: [{ name: '字数', type: 'bar', data: [1200, 1800, 1500, 2600, 2100], itemStyle: { color: '#64748b' } }],
};
const line = { ...bar, title: { text: '阅读完成率', left: 'center' },
  series: [{ name: '完成率', type: 'line', smooth: true, data: [42, 56, 51, 72, 86] }] };
const pie = { title: { text: '内容构成', left: 'center' }, tooltip: { trigger: 'item' }, legend: { bottom: 0 },
  series: [{ name: '篇幅', type: 'pie', radius: ['35%', '65%'], data: [{ name: '情节', value: 55 }, { name: '人物', value: 30 }, { name: '环境', value: 15 }] }] };
const echarts = (option: unknown) => fence('echarts', JSON.stringify(option, null, 2));

/** 调试素材只说明公开渲染语法，不绑定聊天接口或真实业务数据。 */
export const markdownSamples: Record<string, string> = {
  default: `# 清晰地表达每一个想法\n\n这是一段 **Markdown 回答**，支持中文、*强调*、~~删除线~~和行内代码 \`const value = 1\`。\n\n## 组织信息\n\n- 先写出核心观点\n- 再补充证据与示例\n  - 保持层次清晰\n\n1. 收集资料\n2. 整理结论\n\n> 好的表达，让读者更容易理解。\n\n| 能力 | 状态 |\n| --- | --- |\n| 流式正文 | 支持 |\n| 数学公式 | 支持 |\n| 图示与数据图表 | 支持 |\n\n- [x] 明确范围\n- [ ] 完成验收\n\n[Markdown 语法参考](https://commonmark.org/)\n\n---\n\n接下来可以切换代码、公式、图表与流式样例。`,
  code: `## 代码高亮与复制\n\n${fence('typescript', 'interface Message {\n  role: "user" | "assistant";\n  content: string;\n}\n\nexport function greeting(name: string): Message {\n  return { role: "assistant", content: `你好，${name}` };\n}')}\n\n${fence('python', 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a')}\n\n未知语言保留原文：\n\n${fence('custom-language', '这里是未来自定义语法的原始内容。')}`,
  math: '# 数学公式\n\n行内公式：$E = mc^2$，勾股定理：$a^2 + b^2 = c^2$。\n\n## 积分与矩阵\n\n$$\n\\int_0^1 x^2\\,dx = \\frac{1}{3}\n$$\n\n$$\nA = \\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix},\\quad \\sum_{i=1}^{n}i = \\frac{n(n+1)}{2}\n$$',
  mermaid: `# 流程与时序\n\n${fence('mermaid', 'flowchart LR\n  A[接收问题] --> B[分析需求]\n  B --> C{需要工具吗}\n  C -->|是| D[执行工具]\n  C -->|否| E[生成回答]\n  D --> E')}\n\n${fence('mermaid', 'sequenceDiagram\n  participant U as 用户\n  participant A as Agent\n  participant T as 工具\n  U->>A: 提交问题\n  A->>T: 获取资料\n  T-->>A: 返回结果\n  A-->>U: 输出回答')}`,
  charts: `# 数据图表\n\n悬停查看数值，点击饼图图例可以隐藏或显示对应数据。\n\n${echarts(bar)}\n\n${echarts(line)}\n\n${echarts(pie)}`,
  errors: `# 内容错误不会中断正文\n\n${fence('echarts', '{ "series": [ ')}\n\n${fence('mermaid', 'flowchart LR\n A[未结束')}\n\n不执行 HTML 或脚本：\n\n<script>window.__markdownUnsafe = true</script>\n\n[无效链接](javascript:alert(1))\n\n后面的正文仍然可读。`,
  streaming: `## 正在整理回答\n\n这段回答逐步生成，**强调内容**和 $E = mc^2$ 会逐渐补全。\n\n${fence('typescript', 'const message = "流式代码";\nconsole.log(message);')}\n\n${fence('mermaid', 'flowchart LR\n A[输入] --> B[处理] --> C[结果]')}\n\n${echarts(bar)}\n\n生成结束。`,
};
