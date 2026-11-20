/** 代码块独立样例只提供原始源码和语言，不借助 Markdown 包装。 */
export const codeBlockSamples: Record<string, { code: string; language: string }> = {
  default: { language: 'typescript', code: 'interface Chapter {\n  title: string;\n  words: number;\n}\n\nexport function summarize(chapter: Chapter) {\n  return `${chapter.title}：${chapter.words} 字`;\n}\n' },
  python: { language: 'python', code: '# 统计每个章节的字数\ndef total_words(chapters):\n    return sum(chapter["words"] for chapter in chapters)\n\nprint(total_words([{ "words": 1200 }, { "words": 900 }]))\n' },
  json: { language: 'json', code: '{\n  "title": "第一章",\n  "completed": false,\n  "tags": ["悬疑", "城市"],\n  "words": 1200\n}\n' },
  plain: { language: '', code: '  保留开头缩进\n\n\t保留制表符与空行\n末尾换行也会原样复制。\n' },
  unknown: { language: 'plotloom-script', code: 'chapter "未注册的语言" {\n  scene: "清晨的街道"\n  action: preserve_original_text\n}\n' },
  long: { language: 'javascript', code: `const passage = "${'这是一段用于验证代码横向滚动的长行。'.repeat(18)}";\n\n${Array.from({ length: 80 }, (_, i) => `console.log("第 ${i + 1} 行", passage);`).join('\n')}\n` },
  empty: { language: 'text', code: '' },
  streaming: { language: 'typescript', code: Array.from({ length: 16 }, (_, i) => `export const chapter${i + 1} = { title: "第 ${i + 1} 章", words: ${(i + 1) * 100} };`).join('\n') + '\n' },
};
