import { Image } from 'lucide-react';

/** 图片工具与阅读状态独立于文档、浏览器；文件来源由后续公开接口提供。 */
export function ImagePage() {
  return <div className="plotloom-workspace__empty"><Image aria-hidden="true" size={32} />
    <h2>尚未打开图片</h2><p>这里用于查看图片。</p><span>文件打开能力尚未接入。</span>
  </div>;
}
