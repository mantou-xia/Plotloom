import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import './document-editor.css';

export interface DocumentEditorProps {
  label: string;
  value: string;
  readOnly?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  onValueChange: (value: string) => void;
  onSelectionChange?: (selection: { start: number; end: number } | null) => void;
  onBlur?: () => void;
  onCompositionChange?: (active: boolean) => void;
  onScroll?: (top: number) => void;
}

/** 宿主负责存储与版本，编辑器只管理连续文本、选区和撤销历史。 */
export function DocumentEditor(props: DocumentEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const latest = useRef(props);
  const config = useRef(new Compartment());
  useLayoutEffect(() => { latest.current = props; }, [props]);

  useLayoutEffect(() => {
    const options = latest.current;
    const editor = new EditorView({
      parent: host.current!,
      doc: options.value,
      extensions: [
        history(), keymap.of([...defaultKeymap, ...historyKeymap]), drawSelection(), EditorView.lineWrapping,
        config.current.of(editorConfig(options)),
        EditorView.domEventHandlers({
          blur: () => latest.current.onBlur?.(),
          compositionstart: () => latest.current.onCompositionChange?.(true),
          compositionend: () => latest.current.onCompositionChange?.(false),
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(Transaction.remote))) {
            latest.current.onValueChange(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) {
            const { from, to, empty } = update.state.selection.main;
            latest.current.onSelectionChange?.(empty ? null : { start: from, end: to });
          }
        }),
      ],
    });
    view.current = editor;
    if (options.scrollRef) options.scrollRef.current = editor.scrollDOM;
    const onScroll = () => latest.current.onScroll?.(editor.scrollDOM.scrollTop);
    editor.scrollDOM.addEventListener('scroll', onScroll);
    return () => {
      editor.scrollDOM.removeEventListener('scroll', onScroll);
      if (options.scrollRef) options.scrollRef.current = null;
      view.current = null;
      editor.destroy();
    };
  }, []);

  useLayoutEffect(() => {
    view.current?.dispatch({ effects: config.current.reconfigure(editorConfig(props)) });
  }, [props.label, props.readOnly]);

  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === props.value) return;
    // 宿主读回的稿件更新不进入撤销栈，也不触发自动保存。
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: props.value },
      annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)] });
  }, [props.value]);

  return <div className="pl-document-editor" ref={host} />;
}

function editorConfig({ label, readOnly = false }: Pick<DocumentEditorProps, 'label' | 'readOnly'>) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', 'aria-readonly': String(readOnly),
      spellcheck: 'false', tabindex: '0' })];
}
