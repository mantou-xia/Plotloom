/** 只提供本机日历日期；不加入秒级时间，避免无意义的动态内容和过时的精确时间。 */
export function dateContext(now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
  }).format(now);
  return `<plotloom_date_context>\n后端系统时钟提供的本轮当前日期：${date}。时区：${timeZone}。\n“今天”等相对日期以本轮为准，不沿用历史消息中的旧日期；此信息不是用户正文，也不表示已联网搜索。\n</plotloom_date_context>`;
}
