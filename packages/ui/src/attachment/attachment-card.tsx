import { useState, type CSSProperties } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFile, faFileExcel, faFileWord, faFilePdf, faFilePowerpoint, faFileZipper, faFileLines, faFileCode } from '@fortawesome/free-solid-svg-icons';
import { ImageOff, X } from 'lucide-react';
import { attachmentStyles } from './styles.ts';

export interface AttachmentCardProps {
  name: string;
  /** 原始字节数；未提供时显示“文件”，不伪造大小。 */
  size?: number;
  status?: 'ready' | 'processing' | 'error';
  error?: string;
  onOpen?: () => void;
  /** 草稿才传入移除操作；与打开按钮为同级，避免嵌套交互元素。 */
  onRemove?: () => void;
  removeDisabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** 用文件后缀识别类型，兼容空 MIME 的本地上传；复用 Composer 已使用的 Font Awesome 图标。 */
function fileAppearance(extension: string) {
  const ext = extension.toLowerCase();
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return { icon: faFileExcel, color: '#299b65' };
  if (['.doc', '.docx'].includes(ext)) return { icon: faFileWord, color: '#4388d6' };
  if (ext === '.pdf') return { icon: faFilePdf, color: '#e35656' };
  if (['.ppt', '.pptx'].includes(ext)) return { icon: faFilePowerpoint, color: '#e18a45' };
  if (['.zip', '.rar', '.7z', '.gz', '.tar'].includes(ext)) return { icon: faFileZipper, color: '#cda640' };
  if (['.md', '.markdown'].includes(ext)) return { icon: faFileCode, color: '#777a82' };
  if (['.txt', '.log'].includes(ext)) return { icon: faFileLines, color: '#777a82' };
  return { icon: faFile, color: '#777a82' };
}

function fileSize(size: number | undefined) {
  if (size === undefined) return '文件';
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${Number(value.toFixed(1))} ${units[unit]}`;
}

/** 发送前后共用文件展示；固定高度的详情行承载处理、失败和大小，状态切换不挤动布局。 */
export function AttachmentCard({ name, size, status = 'ready', error, onOpen, onRemove, removeDisabled,
  className = '', style }: AttachmentCardProps) {
  const dot = name.lastIndexOf('.');
  const basename = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  const appearance = fileAppearance(extension);
  const detail = status === 'processing' ? '处理中…' : status === 'error' ? error || '处理失败' : fileSize(size);
  const content = <>
    <span className="pl-attachment-card__icon" style={{ color: appearance.color }} aria-hidden="true"><FontAwesomeIcon icon={appearance.icon} /></span>
    <span className="pl-attachment-card__info">
      <span className="pl-attachment-card__name"><span className="pl-attachment-card__basename">{basename}</span><span className="pl-attachment-card__extension">{extension}</span></span>
      <span className="pl-attachment-card__detail" data-failed={status === 'error'} title={detail} aria-live="polite">{detail}</span>
    </span>
  </>;
  return <div className={`pl-attachment-card ${className}`} style={style} title={name} data-status={status}>
    <style>{attachmentStyles}</style>
    {onOpen ? <button type="button" className="pl-attachment-card__body" aria-label={`打开 ${name}`} onClick={onOpen}>{content}</button>
      : <div className="pl-attachment-card__body">{content}</div>}
    {onRemove ? <button type="button" className="pl-attachment-card__remove" aria-label={`移除附件 ${name}`}
      disabled={removeDisabled || status === 'processing'} onClick={onRemove}><X size={13} aria-hidden="true" /></button> : null}
  </div>;
}

/** 共用真实缩略图；加载失败仍保留 68px 占位，预览与草稿移除由外层场景提供。 */
export function AttachmentThumbnail({ src, name }: { src: string; name: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === src;
  return <span className="pl-attachment-thumbnail">
    <style>{attachmentStyles}</style>
    <img src={src} alt={name} data-failed={failed} onError={() => setFailedSource(src)} />
    {failed ? <span className="pl-attachment-thumbnail__fallback" role="img" aria-label={`${name}：图片加载失败`}><ImageOff size={20} aria-hidden="true" /></span> : null}
  </span>;
}
