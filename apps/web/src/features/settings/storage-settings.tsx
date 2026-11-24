import { useEffect, useRef, useState } from 'react';
import { Button } from '@plotloom/ui/button';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { exportPreferences, importPreferences } from './preference-transfer';
import { request } from '../../utils/http';
import './storage-settings.css';

export interface DesktopStorage {
  getDataDirectory(): Promise<string>;
  /** 返回可显示的错误；取消或已请求重启时返回 null。 */
  changeDataDirectory(): Promise<string | null>;
  importDataDirectory(): Promise<string | null>;
}

/** 使用桌面宿主提供的目录选择和重启能力，预览可为同一组件传入模拟宿主。 */
export function StorageSettings({ storage, onExportPreferences = exportPreferences, onImportPreferences = importPreferences, onExportUsage = downloadUsage }: {
  storage?: DesktopStorage;
  onExportPreferences?: () => void;
  onImportPreferences?: (file: File) => Promise<void>;
  onExportUsage?: () => Promise<void>;
}) {
  const [directory, setDirectory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'change' | 'import' | 'preferences' | 'usage' | null>(null);
  const preferenceFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!storage) return;
    let active = true;
    void storage.getDataDirectory().then(path => {
      if (active) setDirectory(path);
    }, () => {
      if (active) setError('无法读取当前数据目录。');
    });
    return () => { active = false; };
  }, [storage]);

  async function chooseDirectory(action: 'change' | 'import') {
    if (!storage) return;
    setBusy(action);
    setError('');
    try {
      const result = await (action === 'import' ? storage.importDataDirectory() : storage.changeDataDirectory());
      setError(result ?? '');
    } catch {
      setError(action === 'import' ? '无法导入旧版数据，请稍后重试。' : '无法更改数据目录，请稍后重试。');
    } finally { setBusy(null); }
  }

  /** 文件选择交给浏览器，迁移失败反馈在固定位置显示。 */
  async function restorePreferences(file: File) {
    setBusy('preferences');
    setError('');
    try { await onImportPreferences(file); }
    catch (error) { setError(error instanceof Error ? error.message : '无法导入产品偏好。'); }
    finally { setBusy(null); }
  }

  /** 手动生成可交付文件，仅切换原有操作位的状态。 */
  async function exportUsage() {
    setBusy('usage');
    setError('');
    try { await onExportUsage(); }
    catch (error) { setError(error instanceof Error ? error.message : '无法导出 Agent 使用记录。'); }
    finally { setBusy(null); }
  }

  return <SettingsSection title={storage ? '应用数据位置' : '产品偏好'}
    description={storage ? '应用数据包含聊天、附件、小说历史版本、已保存的模型供应商、默认模型和 Agent 人设。' : undefined}>
    {storage && <>
      <SettingsRow title="当前目录" description={
        <span className="plotloom-storage-path" title={directory || undefined}>{directory || '—'}</span>
      }>
        <Button variant="secondary" disabled={!directory || busy !== null} loading={busy === 'change'}
          onClick={() => void chooseDirectory('change')}>更改位置</Button>
      </SettingsRow>
      <SettingsRow title="旧版数据" description="复制旧数据和已保存的模型设置及 Agent 人设，重启后使用副本。">
        <Button variant="secondary" disabled={!directory || busy !== null} loading={busy === 'import'}
          onClick={() => void chooseDirectory('import')}>导入旧版数据</Button>
      </SettingsRow>
    </>}
    <SettingsRow title="偏好文件" description="迁移主题模式、主题色和书架排序。导入后会刷新页面。">
      <div className="plotloom-storage-actions">
        <Button variant="secondary" disabled={busy !== null} onClick={() => {
          setError('');
          try { onExportPreferences(); }
          catch { setError('无法导出产品偏好。'); }
        }}>导出偏好</Button>
        <Button variant="secondary" disabled={busy !== null} loading={busy === 'preferences'}
          onClick={() => preferenceFile.current?.click()}>导入偏好</Button>
        <input ref={preferenceFile} type="file" accept=".json,application/json" hidden onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void restorePreferences(file);
        }} />
      </div>
    </SettingsRow>
    <SettingsRow title="Agent 使用记录" description="聊天、回答评价和修改记录保存在本机。手动导出会包含原文和文稿版本，分享前请自行核对。">
      <Button variant="secondary" disabled={busy !== null} loading={busy === 'usage'} onClick={() => void exportUsage()}>
        导出压缩包
      </Button>
    </SettingsRow>
    <p className="plotloom-storage-feedback" role="status">{error}</p>
  </SettingsSection>;
}

/** 同源请求使用桌面现有的 HTTP 转发，压缩包由浏览器保存到用户选定位置。 */
async function downloadUsage() {
  const response = await request('/api/agent-usage/export', 'POST', {});
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Plotloom-agent-usage.jsonl.gz';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
