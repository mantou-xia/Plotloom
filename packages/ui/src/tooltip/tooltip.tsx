import { useCallback, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { Tooltip as Primitive } from 'deep-agent-base-ui/tooltip';
import './tooltip.css';

export interface TooltipProps {
  /** 提示可分段展示说明，不放置按钮或链接。 */
  content: ReactNode;
  /** 单个可聚焦元素；自定义组件需要透传事件、ARIA 属性和 ref。 */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  disabled?: boolean;
  delay?: number;
  /** 是否在出现时晃动；关闭后仍保留缩放和淡入淡出。默认 true。 */
  shake?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 只提供提示气泡。复用已有浮层基础设施处理聚焦、Esc、悬停保持和视口避让，不改变触发器外观。 */
export function Tooltip({ content, children, disabled = false, delay = 0, shake = true, className, style }: TooltipProps) {
  const id = useId();
  const trigger = useRef<HTMLElement>(null);
  const setTrigger = useCallback((node: HTMLElement | null) => { trigger.current = node; }, []);
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLDialogElement>();
  // 保留触发器已有说明；只在气泡挂载期间建立辅助技术关联。
  const description = [children.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined;
  return <Primitive.Root disabled={disabled || (typeof content === 'string' ? !content.trim() : content == null)} onOpenChange={next => {
    // 原生模态层会遮住页面根部的气泡，提示必须挂载在触发器所属的模态层内。
    if (next) setContainer(trigger.current?.closest<HTMLDialogElement>('dialog:modal') ?? undefined);
    setOpen(next);
  }}>
    <Primitive.Trigger ref={setTrigger} render={children} delay={delay} aria-describedby={description} />
    <Primitive.Portal container={container}>
      <Primitive.Positioner side="top" sideOffset={12} collisionPadding={12} className="pl-tooltip-positioner"
        positionMethod={container ? 'fixed' : 'absolute'}>
        <Primitive.Popup id={id} role="tooltip" data-shake={shake} className={['pl-tooltip', className].filter(Boolean).join(' ')} style={style}>
          {content}
          <Primitive.Arrow className="pl-tooltip__arrow" />
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  </Primitive.Root>;
}
