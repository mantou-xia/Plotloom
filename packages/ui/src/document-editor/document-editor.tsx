import { useLayoutEffect, useRef, type RefObject } from 'react';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import './document-editor.css';

export interface DocumentSelectionAnchor {
  start: number;
  end: number;
  left: number;
  top: number;
  bottom: number;
}

export interface DocumentEditorProps {
  label: string;
  value: string;
  readOnly?: boolean;
  scrollRef?: RefObject<HTMLElement | null>;
  onValueChange: (value: string) => void;
  onSelectionChange?: (selection: { start: number; end: number } | null) => void;
  /** 选区在编辑器内的可见锚点，供宿主定位选区操作。 */
  onSelectionAnchorChange?: (anchor: DocumentSelectionAnchor | null) => void;
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
    let measure = 0;
    let selecting = false;
    // 等拖选结束再报告锚点，避免出现的浮层截住鼠标或打断跨行选择。
    function reportAnchor() {
      if (selecting || !latest.current.onSelectionAnchorChange) return;
      cancelAnimationFrame(measure);
      measure = requestAnimationFrame(() => {
        const { from, to, empty } = editor.state.selection.main;
        const bounds = editor.scrollDOM.getBoundingClientRect();
        const visible = empty ? undefined : [editor.coordsAtPos(from, 1), editor.coordsAtPos(to, -1)]
          .find(rect => rect && rect.bottom > bounds.top && rect.top < bounds.bottom);
        latest.current.onSelectionAnchorChange?.(visible ? {
          start: from, end: to, left: visible.left - bounds.left,
          top: visible.top - bounds.top, bottom: visible.bottom - bounds.top,
        } : null);
      });
    }
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
            reportAnchor();
          }
        }),
      ],
    });
    view.current = editor;
    if (options.scrollRef) options.scrollRef.current = editor.scrollDOM;
    const startSelection = (event: PointerEvent) => {
      if (event.button !== 0 || !latest.current.onSelectionAnchorChange) return;
      selecting = true;
      cancelAnimationFrame(measure);
    };
    const endSelection = () => {
      if (!selecting) return;
      selecting = false;
      reportAnchor();
    };
    const onScroll = () => latest.current.onScroll?.(editor.scrollDOM.scrollTop);
    editor.contentDOM.addEventListener('pointerdown', startSelection, true);
    window.addEventListener('pointerup', endSelection);
    window.addEventListener('pointercancel', endSelection);
    editor.scrollDOM.addEventListener('scroll', onScroll);
    return () => {
      cancelAnimationFrame(measure);
      editor.contentDOM.removeEventListener('pointerdown', startSelection, true);
      window.removeEventListener('pointerup', endSelection);
      window.removeEventListener('pointercancel', endSelection);
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
