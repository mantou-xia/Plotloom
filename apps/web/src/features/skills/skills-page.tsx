import { useEffect, useState } from 'react';
import type { SkillInfo } from '@plotloom/contracts/skills';
import { PageLayout } from '@plotloom/ui/layouts/page-layout';
import { Button } from '@plotloom/ui/button';
import { requestJson } from '../../utils/http';
import { notifyRequestError, runWithToast } from '../../utils/feedback';
import './skills-page.css';

/** 初步接入只展示已安装技能；不引入小说配置或技能编辑流程。 */
export function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    // 首次读取静默成功，用户点击刷新才展示完整操作反馈；离开页面取消不报错。
    const load = async () => {
      try {
        const result = await requestJson<{ skills: SkillInfo[] }>('/api/skills', 'GET', undefined, controller.signal);
        if (!controller.signal.aborted) setSkills(result.skills);
      } catch (cause) { if (!controller.signal.aborted) setFailed(true); throw cause; }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    if (reload) void runWithToast(load, { loading: '正在刷新技能…', success: '技能列表已刷新' });
    else void load().catch(cause => notifyRequestError(cause, 'skills-load-error'));
    return () => controller.abort();
  }, [reload]);
  return <PageLayout title="技能" style={{ height: '100%' }}
    actions={<Button variant="ghost" loading={loading} onClick={() => setReload(value => value + 1)}>刷新</Button>}>
    {loading ? <p role="status">正在加载技能…</p> : failed ? null : !skills.length ? <p>暂无已安装技能。</p>
      : <ul className="plotloom-skills">{skills.map(skill => <li key={skill.id}>
        <h2>{skill.name}</h2><p>{skill.description}</p>
        {!skill.runnable ? <small>当前不可用：{skill.warnings.join('；') || '所需工具尚未就绪'}</small> : null}
      </li>)}</ul>}
  </PageLayout>;
}
