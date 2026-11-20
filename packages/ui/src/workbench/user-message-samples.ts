/** 样例保存用户原文；字面 Markdown/HTML 用于确认消息没有被二次解释。 */
export const userMessageSamples: Record<string, string> = {
  default: '帮我整理一下这一章的人物关系。',
  multiline: '请保留下面的排版：\n\n  第一幕：雨夜归来\n    林舟推开门，停在玄关。\n\n第二幕：未寄出的信',
  long: '请检查这段长文本是否完整显示，不要截断。\n\n' + '故事从一封没有署名的信开始，人物的行动需要前后一致。'.repeat(18)
    + '\n\nhttps://example.com/references/' + 'unbroken-path-'.repeat(24),
  literal: '**这里是用户输入的星号**\n# 这不是标题\n<script>alert("示例")</script>\n[不是自动链接](https://example.com)\n\n    保留四个空格缩进',
  attachments: '请结合这些附件，整理项目资料。',
  'attachment-only': '',
  empty: '',
};
