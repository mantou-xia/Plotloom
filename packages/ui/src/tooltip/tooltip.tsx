import { useId, useState, type CSSProperties, type ReactElement } from 'react';
import { Tooltip as Primitive } from 'deep-agent-base-ui/tooltip';
import './tooltip.css';

export interface TooltipProps {
  /** 提示仅承载说明文字，不放置按钮或链接。 */
  content: string;
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
  const [open, setOpen] = useState(false);
  // 保留触发器已有说明；只在气泡挂载期间建立辅助技术关联。
  const description = [children.props['aria-describedby'], open ? id : undefined].filter(Boolean).join(' ') || undefined;
  return <Primitive.Root disabled={disabled || !content.trim()} onOpenChange={setOpen}>
    <Primitive.Trigger render={children} delay={delay} aria-describedby={description} />
    <Primitive.Portal>
      <Primitive.Positioner side="top" sideOffset={12} collisionPadding={12} className="pl-tooltip-positioner">
        <Primitive.Popup id={id} role="tooltip" data-shake={shake} className={['pl-tooltip', className].filter(Boolean).join(' ')} style={style}>
          {content}
          <Primitive.Arrow className="pl-tooltip__arrow" />
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  </Primitive.Root>;
}
