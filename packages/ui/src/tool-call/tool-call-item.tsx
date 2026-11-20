import { memo, type CSSProperties } from 'react';
import { Terminal } from 'lucide-react';
import { ProcessNode } from '../agent-process/process-node.tsx';
import type { ProcessStatus } from '../agent-process/types.ts';
import './tool-call-item.css';

export type { ProcessStatus as ToolCallStatus } from '../agent-process/types.ts';
export interface ToolCallData {
  name: string;
  summary?: string;
  status: ProcessStatus;
  /** 调用方提供的原始文本（对象可由调用方格式化为 JSON）；组件不执行或解析命令。 */
  input?: string;
  /** undefined 表示尚未提供，空字符串表示已提供空结果。 */
  output?: string;
  /** 该次调用访问的网页；随详情展开，避免结果返回时挤动过程列表。 */
  source?: { title: string; url: string };
}
export interface ToolCallItemProps extends ToolCallData {
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

/** 单次工具调用：状态原位更新，输入和输出按原文展示，不因完成而自动展开。 */
export const ToolCallItem = memo(function ToolCallItem({ name, summary, status, input, output, source, expanded,
  defaultExpanded = false, onExpandedChange, className = '', style }: ToolCallItemProps) {
  const hasDetails = input !== undefined || output !== undefined || source !== undefined;
  // 只允许网页协议；异常地址仍可从工具原始结果检查。
  const sourceUrl = source && /^https?:\/\//i.test(source.url) ? source.url : undefined;
  return <div className={`pl-tool-call ${className}`} style={style}>
    <ProcessNode title={name} description={summary} status={status} icon={<Terminal />}
      expanded={expanded} defaultExpanded={defaultExpanded} onExpandedChange={onExpandedChange}>
      {hasDetails ? <div className="pl-tool-call__details">
        {input !== undefined ? <div><p className="pl-tool-call__label">输入</p><pre aria-label="工具输入">{input || '（空输入）'}</pre></div> : null}
        {source ? <div><p className="pl-tool-call__label">访问页面</p>
          {sourceUrl ? <a className="pl-tool-call__source" href={sourceUrl} target="_blank" rel="noopener noreferrer">{source.title}</a>
            : <span>{source.title}</span>}
        </div> : null}
        {output !== undefined ? <div><p className="pl-tool-call__label">结果</p><pre aria-label="工具结果">{output || '（空结果）'}</pre></div> : null}
      </div> : null}
    </ProcessNode>
  </div>;
});
