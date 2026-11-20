import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CircleCheck, CircleStop, CircleX, Info, LoaderCircle } from 'lucide-react';
import { Button } from '../button/button.tsx';
import type { ProcessStatus } from './types.ts';
import './process-node.css';

const STATUS = {
  running: { label: '进行中', Icon: LoaderCircle }, completed: { label: '已完成', Icon: CircleCheck },
  failed: { label: '失败', Icon: CircleX }, stopped: { label: '已停止', Icon: CircleStop },
};

interface ProcessNodeProps {
  title: string;
  description?: string;
  status?: ProcessStatus;
  icon?: ReactNode;
  children?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

/** 工具项与过程列表共用节点布局；状态固定占位，结果更新不自动展开详情。 */
export function ProcessNode({ title, description, status, icon, children, expanded, defaultExpanded = false, onExpandedChange }: ProcessNodeProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const open = expanded ?? localExpanded;
  const detailsId = useId();
  const hasDetails = children !== undefined && children !== null;
  const state = status ? STATUS[status] : undefined;
  const heading = <>
    <span className="pl-process-node__title" title={title}>{title}</span>
    <span className="pl-process-node__status" data-status={status}>{state?.label}</span>
    <span className="pl-process-node__chevron" aria-hidden="true">{hasDetails ? open ? <ChevronDown /> : <ChevronRight /> : null}</span>
  </>;
  const toggle = () => {
    // 先通知过程区暂停跟随，用户展开历史记录时不能被内容尺寸变化拉到底部。
    onExpandedChange?.(!open);
    if (expanded === undefined) setLocalExpanded(!open);
  };
  return <div className="pl-process-node" data-status={status} data-expanded={hasDetails && open}>
    <span className="pl-process-node__icon" data-status={status} aria-hidden="true">
      {state ? <state.Icon /> : icon ?? <Info />}
    </span>
    <div className="pl-process-node__main">
      {hasDetails ? <Button variant="text" size="sm" className="pl-process-node__heading" aria-expanded={open}
        aria-controls={detailsId} aria-label={`${open ? '收起' : '展开'}${title}详情`} onClick={toggle}>{heading}</Button>
        : <div className="pl-process-node__heading">{heading}</div>}
      {description !== undefined ? <p className="pl-process-node__description" title={description}>{description || '\u00a0'}</p> : null}
      {hasDetails ? <div id={detailsId} className="pl-process-node__details" hidden={!open}>{children}</div> : null}
    </div>
  </div>;
}
