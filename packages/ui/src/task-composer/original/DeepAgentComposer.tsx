"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { mountDeepAgentComposer, type DeepAgentComposerOptions } from "./DeepAgentComposerEngine.js";
import type { MotionController } from "./motion-runtime";

export function DeepAgentComposer({ options, className, draftContext }: { options?: DeepAgentComposerOptions; className?: string; draftContext?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<MotionController | null>(null);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const instance = mountDeepAgentComposer(host.current!, options);
    controller.current = instance;
    setSurface(instance.element);
    return () => { instance.destroy(); controller.current = null; };
    // Options are updated below without remounting the state machine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { controller.current?.update(options ?? {}); }, [options]);
  // 通过原生插槽放进输入框，同时让宿主内容继续使用页面组件与样式。
  return <div ref={host} className={className} data-motion-component="deep-agent-composer">
    {surface && draftContext != null ? createPortal(<div slot="draft-context">{draftContext}</div>, surface) : null}
  </div>;
}
