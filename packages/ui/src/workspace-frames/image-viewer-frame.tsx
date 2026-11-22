import { Image } from 'lucide-react';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';
import { FrameState } from './frame-state.tsx';
import './workspace-frames.css';

/** 图片框架消费调用方提供的图像地址，在工作区约束内显示原比例。 */
export function ImageViewerFrame({ src, alt = '' }: { src?: string; alt?: string }) {
  return <section className="pl-content-frame" aria-label="图片预览">
    <ScrollBox className="pl-content-frame__body" aria-label="图片内容">
      {src ? <img src={src} alt={alt} className="pl-workspace-preview-image" /> :
        <FrameState icon={<Image />} title="尚未打开图片">文件打开能力尚未接入。</FrameState>}
    </ScrollBox>
  </section>;
}
