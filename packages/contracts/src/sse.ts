/** 从响应字节流提取完整事件，跨块保留 UTF-8 和 CRLF 边界；调用方决定如何处理事件和残帧。 */
export async function readSseFrames(
  body: ReadableStream<Uint8Array>,
  receive: (type: string, data: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const lines = buffer.slice(0, separator.index).split(/\r?\n/);
        buffer = buffer.slice(separator.index + separator[0].length);
        const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (type && data) receive(type, data);
      }
      if (done) return buffer;
    }
  } finally {
    // 回调拒绝异常事件时也释放读取器，避免调用方继续持有网络连接。
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
