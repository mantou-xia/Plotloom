import { useRef, useState, type CSSProperties } from 'react';
import { FileText } from 'lucide-react';
import { WorkspaceTabs } from '../workspace-tabs/workspace-tabs.tsx';
import { ScrollBox } from '../scroll-box/scroll-box.tsx';

/** 仅使用独立草稿验证框架公开参数，不装入实际业务页。 */
export function WorkspaceTabsExample({ state, style, onAction }: { state: string; style?: CSSProperties; onAction: (action: string) => void }) {
  const [ids, setIds] = useState(() => Array.from({ length: state === 'empty' ? 0 : state === 'overflow' ? 10 : 2 }, (_, i) => String(i + 1)));
  const [active, setActive] = useState(ids[0] ?? '');
  const serial = useRef(10);
  return <WorkspaceTabs style={style} activeId={active} onSelect={id => { setActive(id); onAction(`onSelect(${id})`); }}
    onClose={id => {
      const next = ids.filter(item => item !== id);
      if (id === active) setActive(next[Math.min(ids.indexOf(id), next.length - 1)] ?? '');
      setIds(next); onAction(`onClose(${id})`);
    }} onAdd={() => { const id = String(++serial.current); setIds([...ids, id]); setActive(id); onAction('onAdd'); }}
    empty={<p style={{ padding: 24 }}>没有打开的标签，点击加号新增。</p>}
    tabs={ids.map(id => ({ id, title: state === 'overflow' ? `独立内容页面与长标题 ${id}` : `页面 ${id}`, icon: <FileText />,
      page: state === 'custom-page' ? <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <header style={{ padding: 16, background: 'var(--pl-surface-muted)' }}>页面 {id} 的自定义工具栏</header>
        <ScrollBox aria-label={`自定义页面 ${id} 内容`} style={{ flex: 1 }}><div style={{ padding: 24 }}>
          <input aria-label={`页面 ${id} 草稿`} placeholder="页面独立保存输入" style={{ border: 0, padding: 12, background: 'var(--pl-surface-muted)' }} />
          {Array.from({ length: 24 }, (_, i) => <p key={i}>自定义页面 {id}，段落 {i + 1}</p>)}
        </div></ScrollBox>
        <footer style={{ padding: '8px 16px', background: 'var(--pl-surface-muted)' }}>页面 {id} 的自定义底栏</footer>
      </div> : undefined,
      closable: !(state === 'fixed' && id === '1'), toolbar: <span>页面 {id} 的独立工具栏</span>,
      content: <div style={{ padding: 24 }}><input aria-label={`页面 ${id} 草稿`} placeholder="切换后保留输入" style={{ border: 0, background: 'var(--pl-surface-muted)', padding: 12 }} />
        {Array.from({ length: 30 }, (_, i) => <p key={i}>页面 {id}，段落 {i + 1}。框架不决定页面能力。</p>)}</div>,
    }))} />;
}
