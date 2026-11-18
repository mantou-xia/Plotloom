import { ArrowRight, Plus } from 'lucide-react';
import { Button, type ButtonVariant } from '../button/button.tsx';

export const buttonVariants: { value: ButtonVariant; label: string }[] = [
  { value: 'primary', label: '主按钮' },
  { value: 'secondary', label: '次按钮' },
  { value: 'subtle', label: '浅底按钮' },
  { value: 'ghost', label: '透明按钮' },
  { value: 'text', label: '文字按钮' },
  { value: 'link', label: '链接样式' },
];

/** 总览只组合真实 Button：状态用公开参数驱动，hover、active 和焦点由用户实际触发。 */
export function ButtonGallery({ onAction }: { onAction: () => void }) {
  return <div className="pl-button-gallery">
    <section aria-label="按钮类型与状态">
      <h2>类型与状态</h2>
      <p>六种类型并列对照；可悬停、按下或用 Tab 检查交互。</p>
      {buttonVariants.map(({ value, label }) => <section className="pl-button-gallery__variant" aria-label={label} key={value}>
        <h3>{label}<code>{value}</code></h3>
        <div className="pl-button-gallery__row">
          <div><span>常规</span><Button variant={value} onClick={onAction}>{label}</Button></div>
          <div><span>危险操作</span><Button variant={value} danger onClick={onAction}>删除内容</Button></div>
          <div><span>禁用</span><Button variant={value} disabled onClick={onAction}>{label}</Button></div>
          <div><span>加载中</span><Button variant={value} loading onClick={onAction}>{label}</Button></div>
        </div>
      </section>)}
    </section>
    <section aria-label="按钮尺寸"><h2>三档尺寸</h2><div className="pl-button-gallery__examples">
      <Button size="sm" onClick={onAction}>小按钮 · 32</Button>
      <Button size="md" onClick={onAction}>中按钮 · 40</Button>
      <Button size="lg" onClick={onAction}>大按钮 · 48</Button>
    </div></section>
    <section aria-label="按钮图标"><h2>图标组合</h2><div className="pl-button-gallery__examples">
      <Button startIcon={<Plus />} onClick={onAction}>前置图标</Button>
      <Button variant="secondary" endIcon={<ArrowRight />} onClick={onAction}>后置图标</Button>
      <Button variant="subtle" startIcon={<Plus />} endIcon={<ArrowRight />} onClick={onAction}>双侧图标</Button>
      <Button variant="secondary" iconOnly aria-label="添加内容" onClick={onAction}><Plus /></Button>
      <Button variant="secondary" iconOnly loading aria-label="添加内容中" onClick={onAction}><Plus /></Button>
      <Button variant="secondary" iconOnly disabled aria-label="添加内容不可用" onClick={onAction}><Plus /></Button>
    </div></section>
  </div>;
}
