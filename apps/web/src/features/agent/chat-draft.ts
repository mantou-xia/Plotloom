/** 只保存当前标签页的未发送文字。会话和新聊天使用独立键，附件仍由上传流程管理。 */
export function chatDraft(key: string) {
  const storageKey = 'plotloom.chat-draft:' + key;
  return {
    readDraft: () => sessionStorage.getItem(storageKey) ?? '',
    onDraftChange: (text: string) => {
      if (text) sessionStorage.setItem(storageKey, text);
      else sessionStorage.removeItem(storageKey);
    },
  };
}
