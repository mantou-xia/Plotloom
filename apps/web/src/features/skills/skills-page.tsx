import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
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
import { Skeleton } from '@plotloom/ui/skeleton';
import './skills-page.css';

export interface SkillsSnapshot { skills: SkillInfo[]; tools: ToolInfo[] | null }

/** 页面负责请求与筛选；通用交互来自组件库，目录读取和导入仅通过公开接口执行。 */
export function SkillsPage({ skillRevision = 0, snapshot, setSnapshot }: {
  skillRevision?: number; snapshot: SkillsSnapshot | null; setSnapshot: Dispatch<SetStateAction<SkillsSnapshot | null>>;
}) {
  const skills = snapshot?.skills ?? [];
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
    // 回访和手动刷新都保留当前清单；离开页面时取消后台校验。
    const load = async () => {
      try {
        // 同时加载目录，让详情首次打开就能显示完整工具列表；目录故障仍可查看技能。
        const [result, directory] = await Promise.all([
          requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, controller.signal),
          requestJson<{ tools: ToolInfo[] }>('/api/tools', 'GET', undefined, controller.signal).catch(() => null),
        ]);
        if (!controller.signal.aborted) {
          setSnapshot({ skills: result.skills, tools: directory?.tools ?? null });
        }
      } catch (cause) { if (!controller.signal.aborted) setFailed(true); throw cause; }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    if (reload) void runWithToast(load, { loading: '正在刷新技能…', success: '技能列表已刷新' });
    else void load().catch(cause => notifyRequestError(cause, 'skills-load-error'));
    return () => controller.abort();
  }, [reload, skillRevision, setSnapshot]);

  /** 系统取消是正常返回；成功后切到个人分类并清空搜索，让新导入条目立即可见。 */
  async function importFolder() {
    if (picker.current) return;
    const controller = new AbortController();
    picker.current = controller;
    setImporting(true); setImportError('');
    try {
      const { skill } = await requestJson<SkillFolderImportResult>('/api/skills/import-folder', 'POST', {}, controller.signal);
      if (controller.signal.aborted || !skill) return;
      setSnapshot(current => current && { ...current, skills: [...current.skills.filter(item => item.id !== skill.id), skill] });
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
      <Button variant="ghost" iconOnly aria-label="刷新技能" loading={loading && reload > 0} disabled={importing} onClick={() => setReload(value => value + 1)}><RefreshCw /></Button>
      <Button startIcon={<FolderPlus />} loading={importing} disabled={loading || failed} onClick={() => void importFolder()}>导入技能</Button>
    </>}>
    <p className="plotloom-skills-intro">通过专用技能扩展创作能力，让常用方法随时可用。</p>
    <Input type="search" aria-label="搜索技能" placeholder="搜索技能名称或描述" startIcon={<Search />} clearable value={query} onValueChange={setQuery} />
    {importing ? <p className="plotloom-skills-feedback" role="status">请在系统窗口选择包含 SKILL.md 的文件夹，确认后开始导入。</p> : null}
    {importError ? <p className="plotloom-skills-feedback" role="alert">{importError}</p> : null}
    <PrimaryTabs label="技能分类" value={category} onValueChange={setCategory} options={[
      { value: 'builtin', label: <>系统内置 <span className="plotloom-skills-count">{snapshot ? builtinCount : '—'}</span></> },
      { value: 'personal', label: <>个人安装 <span className="plotloom-skills-count">{snapshot ? skills.length - builtinCount : '—'}</span></> },
    ]}>
    <PrimaryTabPanel value={category}>
    <section className="plotloom-skills-section" aria-label={categoryLabel} aria-busy={loading}>
      <div className="plotloom-skills-section__heading"><h2>{categoryLabel}</h2>
        {snapshot ? <span role="status">{keyword ? '找到 ' : '共 '}{visibleSkills.length} 个技能</span> : null}
      </div>
      {!snapshot && loading ? <div className="plotloom-skills plotloom-skills-skeleton">
          <Skeleton /><Skeleton /><Skeleton /><Skeleton />
        </div>
        : !snapshot && failed ? <div className="plotloom-skills-empty" role="alert"><p>技能列表加载失败，请重试。</p><Button variant="secondary" onClick={() => setReload(value => value + 1)}>重新加载</Button></div>
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
    {selected ? <SkillDetails key={selected.id} skill={selected} tools={snapshot?.tools ?? null} onClose={() => setSelectedId(null)} /> : null}
  </PageLayout>;
}
