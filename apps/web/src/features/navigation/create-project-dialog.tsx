import { useEffect, useRef, useState } from 'react';
import type { Project, ProjectFolderSelection } from '@plotloom/contracts';
import { Dialog } from '@plotloom/ui/dialog';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { Folder, FolderPlus } from 'lucide-react';
import { requestJson } from '../../utils/http';
import './project-dialog.css';

/** 只维护名称和选择结果；文件夹浏览完全交给系统窗口，创建成功才通知应用更新列表。 */
export function CreateProjectDialog({ onCancel, onCreated }: { onCancel: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef<AbortController | null>(null);
  useEffect(() => () => picker.current?.abort(), []);

  async function selectFolder() {
    const controller = new AbortController();
    picker.current = controller;
    setSelecting(true); setError('');
    try {
      const result = await requestJson<ProjectFolderSelection>('/api/projects/select-folder', 'POST', {}, controller.signal);
      // 系统窗口取消时保留之前选中的目录；关闭创建弹窗不接收迟到结果。
      if (!controller.signal.aborted && result.path !== null) setPath(result.path);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '选择文件夹失败。'); }
    finally { if (!controller.signal.aborted) setSelecting(false); }
  }
  async function create() {
    if (!name.trim() || !path || selecting || saving) return;
    setSaving(true); setError('');
    try { onCreated(await requestJson<Project>('/api/projects', 'POST', { name: name.trim(), path })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '创建项目失败。'); setSaving(false); }
  }
  return <Dialog open dismissOnBackdrop={false} title="创建项目" onOpenChange={open => { if (!open && !saving) onCancel(); }}
    footer={<><Button variant="ghost" disabled={saving} onClick={onCancel}>取消</Button>
      <Button disabled={!name.trim() || !path || selecting || saving} loading={saving} onClick={() => void create()}>创建项目</Button></>}>
    <div className="plotloom-project-dialog">
      <Input aria-label="项目名称" placeholder="项目名称" autoFocus maxLength={120} value={name}
        onValueChange={setName} disabled={saving} startIcon={<Folder />} />
      <section className="plotloom-project-dialog__source" aria-label="源文件夹">
        <h3>源文件夹</h3>
        <div className="plotloom-project-dialog__folder">
          <p title={path || undefined}>{path || '在此电脑上添加文件夹'}</p>
          <Button variant="secondary" startIcon={<FolderPlus />} disabled={selecting || saving}
            loading={selecting} onClick={() => void selectFolder()}>{path ? '更换文件夹' : '添加文件夹'}</Button>
          {selecting ? <span role="status">请在系统窗口中选择文件夹</span> : null}
        </div>
      </section>
      {error ? <p className="plotloom-project-dialog__error" role="alert">{error}</p> : null}
    </div>
  </Dialog>;
}
