import { useEffect, useRef, useState } from 'react';
import type { SkillInfo, SkillFolderImportResult, ToolInfo } from '@plotloom/contracts/skills';
import { SkillDetails } from './skill-details';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { PrimaryTabs, PrimaryTabPanel } from '@plotloom/ui/primary-tabs';
import { toast } from '@plotloom/ui/toast/utils';
import { BookOpen, FolderPlus, Puzzle, RefreshCw, Search } from 'lucide-react';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import { SkillItem } from '@plotloom/ui/skill-item';
import './skills-page.css';

/** 页面负责请求与筛选；通用交互来自组件库，目录读取和导入仅通过公开接口执行。 */
export function SkillsPage({ skillRevision = 0 }: { skillRevision?: number }) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('builtin');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const picker = useRef<AbortController | null>(null);
  useEffect(() => () => picker.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    // 离开页面取消读取，避免旧响应覆盖下一次进入页面后的清单。
    const load = async () => {
      try {
        const [result, directory] = await Promise.all([
          requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, controller.signal),
          requestJson<{ tools: ToolInfo[] }>('/api/tools', 'GET', undefined, controller.signal),
        ]);
        if (!controller.signal.aborted) { setSkills(result.skills); setTools(directory.tools); }
      } catch (cause) { if (!controller.signal.aborted) setFailed(true); throw cause; }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    if (reload) void runWithToast(load, { loading: '正在刷新技能…', success: '技能列表已刷新' });
    else void load().catch(cause => notifyRequestError(cause, 'skills-load-error'));
    return () => controller.abort();
  }, [reload, skillRevision]);

  /** 系统取消是正常返回；成功后切到个人分类并清空搜索，让新导入条目立即可见。 */
  async function importFolder() {
    if (picker.current) return;
    const controller = new AbortController();
    picker.current = controller;
    setImporting(true); setImportError('');
    try {
      const { skill } = await requestJson<SkillFolderImportResult>('/api/skills/import-folder', 'POST', {}, controller.signal);
      if (controller.signal.aborted || !skill) return;
      setSkills(current => [...current.filter(item => item.id !== skill.id), skill]);
      setCategory('personal'); setQuery('');
      toast.success('技能已导入');
    } catch (cause) {
      if (!controller.signal.aborted) setImportError(cause instanceof Error ? cause.message : '导入技能失败，请重试。');
    } finally {
      if (!controller.signal.aborted) { setImporting(false); picker.current = null; }
    }
  }
  const builtinCount = skills.filter(skill => skill.source === 'builtin').length;
  const keyword = query.trim().toLocaleLowerCase();
  const categorySkills = skills.filter(skill => category === 'builtin' ? skill.source === 'builtin' : skill.source !== 'builtin');
  const visibleSkills = categorySkills.filter(skill => !keyword || (skill.name + ' ' + skill.description).toLocaleLowerCase().includes(keyword));
  const categoryLabel = category === 'builtin' ? '系统内置' : '个人安装';
  const selected = skills.find(skill => skill.id === selectedId);
  return <PageLayout title="技能" style={{ height: '100%' }} maxWidth={1120}
    actions={<>
      <Button variant="ghost" iconOnly aria-label="刷新技能" loading={loading} disabled={importing} onClick={() => setReload(value => value + 1)}><RefreshCw /></Button>
      <Button startIcon={<FolderPlus />} loading={importing} disabled={loading || failed} onClick={() => void importFolder()}>导入技能</Button>
    </>}>
    <p className="plotloom-skills-intro">通过专用技能扩展创作能力，让常用方法随时可用。</p>
    <Input type="search" aria-label="搜索技能" placeholder="搜索技能名称或描述" startIcon={<Search />} clearable value={query} onValueChange={setQuery} />
    {importing ? <p className="plotloom-skills-feedback" role="status">请在系统窗口选择包含 SKILL.md 的文件夹，确认后开始导入。</p> : null}
    {importError ? <p className="plotloom-skills-feedback" role="alert">{importError}</p> : null}
    <PrimaryTabs label="技能分类" value={category} onValueChange={setCategory} options={[
      { value: 'builtin', label: <>系统内置 <span className="plotloom-skills-count">{loading || failed ? '—' : builtinCount}</span></> },
      { value: 'personal', label: <>个人安装 <span className="plotloom-skills-count">{loading || failed ? '—' : skills.length - builtinCount}</span></> },
    ]}>
    <PrimaryTabPanel value={category}>
    <section className="plotloom-skills-section" aria-label={categoryLabel} aria-busy={loading}>
      <div className="plotloom-skills-section__heading"><h2>{categoryLabel}</h2>
        {!loading && !failed ? <span role="status">{keyword ? '找到 ' : '共 '}{visibleSkills.length} 个技能</span> : null}
      </div>
      {loading ? <p className="plotloom-skills-empty" role="status">正在加载技能…</p>
        : failed ? <div className="plotloom-skills-empty" role="alert"><p>技能列表加载失败，请重试。</p><Button variant="secondary" onClick={() => setReload(value => value + 1)}>重新加载</Button></div>
        : visibleSkills.length ? <ul className="plotloom-skills">{visibleSkills.map(skill => <SkillItem key={skill.id}
          name={skill.name} description={skill.description}
          onClick={() => setSelectedId(skill.id)} status={skill.enabled ? '已启用' : '已停用'}
          icon={skill.source === 'builtin' ? <BookOpen size={22} /> : <Puzzle size={22} />}
          warning={skill.missingTools.length ? `缺少工具：${skill.missingTools.join('、')}` : undefined} />)}</ul>
        : <div className="plotloom-skills-empty"><p>{keyword ? '没有找到匹配的技能' : category === 'personal' ? '还没有安装个人技能' : '暂无系统内置技能'}</p>
          <small>{keyword ? '试试其他名称或描述，或切换技能分类。' : category === 'personal' ? '点击右上角“导入技能”，选择本机技能文件夹。' : '刷新列表后重试。'}</small>
        </div>}
    </section>
    </PrimaryTabPanel>
    </PrimaryTabs>
    {selected ? <SkillDetails key={selected.id} skill={selected} tools={tools} onClose={() => setSelectedId(null)} /> : null}
  </PageLayout>;
}
