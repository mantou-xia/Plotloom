import { useState, type CSSProperties } from 'react';
import { AttachmentCard, AttachmentThumbnail, type AttachmentCardProps } from '../attachment/attachment-card.tsx';
import { Dialog } from '../dialog/dialog.tsx';
import { Button } from '../button/button.tsx';

// 使用仓库现有的真实 PNG；不依赖外部图床，离线也能验证图片展示与预览。
const imageSrc = new URL('../../../../docs/plotloom-agent-architecture.diagram.visual-check.1440x900.light.png', import.meta.url).href;
const names = ['项目数据.xlsx', '需求说明.docx', '参考资料.pdf', '汇报演示.pptx', '素材归档.zip', '阅读说明.txt', '章节草稿.md', '这是一份名称很长需要保留扩展名的项目资料.xlsx'];

/** 两个使用场景共用样例数据；文件只记录打开回调，图片提供真实预览。 */
export function MessageAttachmentSamples({ onAction }: { onAction: (action: string) => void }) {
  const [preview, setPreview] = useState(false);
  return <>
    {names.map(name => <AttachmentCard key={name} name={name} size={1024} onOpen={() => onAction(`打开附件：${name}（演示回调）`)} />)}
    <button type="button" className="pl-attachment-image-trigger" aria-label="预览图片 架构参考.png" aria-haspopup="dialog" onClick={() => setPreview(true)}>
      <AttachmentThumbnail src={imageSrc} name="架构参考.png" />
    </button>
    <Dialog open={preview} onOpenChange={setPreview} title="架构参考.png" style={{ width: 960 }}>
      <img src={imageSrc} alt="架构参考.png" style={{ display: 'block', width: '100%', maxHeight: '70dvh', objectFit: 'contain' }} />
    </Dialog>
  </>;
}

/** 独立调试共用卡片、移除回调及原位状态变化，不接入上传接口。 */
export function AttachmentExample({ state, style, onAction }: { state: string; style: CSSProperties; onAction: (action: string) => void }) {
  const [status, setStatus] = useState<AttachmentCardProps['status']>('ready');
  const [removed, setRemoved] = useState(false);
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8, ...style }}>
    {state === 'types' ? <MessageAttachmentSamples onAction={onAction} /> : <>
      {!removed ? <AttachmentCard name="这是一份名称很长需要保留扩展名的项目资料.xlsx" size={1536}
        status={status} error="附件上传失败，请重新选择" onOpen={() => onAction('打开附件')}
        onRemove={state === 'draft' ? () => { setRemoved(true); onAction('移除草稿附件'); } : undefined} /> : null}
      {state === 'status' ? <Button variant="secondary" size="sm" onClick={() => setStatus(value => value === 'ready' ? 'processing' : value === 'processing' ? 'error' : 'ready')}>切换附件状态</Button> : null}
      {removed ? <Button variant="secondary" size="sm" onClick={() => setRemoved(false)}>恢复样例</Button> : null}
    </>}
  </div>;
}
