import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@plotloom/ui/button';
import { ProviderAvatar } from './provider-detail';

const presets = [['', '服务器'], ['box', '方块'], ['cloud', '云'], ['cpu', '芯片']] as const;

/** 用同一头像渲染器预览内置图标和上传图片；连续选择时只采用最后一次结果。 */
export function ProviderAvatarPicker({ value, name, onChange }: { value: string; name: string; onChange: (value: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const [error, setError] = useState('');
  function upload(file?: File) {
    if (!file) return;
    const current = ++revision.current;
    if (file.size > 256 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('请选择 256 KB 以内的 PNG、JPEG 或 WebP 图片。'); return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => { if (revision.current === current && typeof reader.result === 'string') onChange(reader.result); };
    reader.onerror = () => { if (revision.current === current) setError('无法读取图片，请重新选择。'); };
    reader.readAsDataURL(file);
  }
  return <fieldset className="plotloom-avatar-picker"><legend>供应商头像</legend>
    <div className="plotloom-provider-avatar" aria-hidden="true"><ProviderAvatar avatar={value} name={name} /></div>
    <div className="plotloom-provider-actions">
      {presets.map(([id, label]) => <Button key={id} type="button" size="sm" variant={id === value ? 'subtle' : 'ghost'}
        iconOnly tooltip aria-label={label + '头像'} aria-pressed={value === id}
        onClick={() => { revision.current++; setError(''); onChange(id); }}><ProviderAvatar avatar={id} name={name} /></Button>)}
      <Button type="button" variant="secondary" size="sm" startIcon={<Upload />} onClick={() => fileInput.current?.click()}>上传图片</Button>
      <input hidden ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
        upload(e.currentTarget.files?.[0]); e.currentTarget.value = '';
      }} />
    </div><small role="status">{error || 'PNG、JPEG 或 WebP，最大 256 KB'}</small>
  </fieldset>;
}
