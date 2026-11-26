import { useState } from 'react';
import type { Project } from '@plotloom/contracts';
import { MorphingPopover } from '@plotloom/ui/morphing-popover';
import { Button } from '@plotloom/ui/button';
import { Input } from '@plotloom/ui/input';
import { Check, Folder, Plus, Search, X } from 'lucide-react';
import './project-switcher.css';

/** 应用负责切换草稿归属，菜单只提交选中项目或取消选择的意图。 */
export function ProjectSwitcher({ projects, currentPath, projectName, state, open, disabled, onOpenChange, onRetry, onSelect, onClear, onCreate }: {
  projects: Project[]; currentPath: string; state: 'loading' | 'ready' | 'error';
  projectName: string; open: boolean; disabled: boolean; onOpenChange: (open: boolean) => void;
  onRetry: () => void; onSelect: (project: Project) => void; onClear: () => void; onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase();
  const visibleProjects = projects.filter(project => `${project.name} ${project.path}`.toLocaleLowerCase().includes(search));
  // 搜索仅过滤已加载的公开项目列表；每次重开恢复全部项目，不改变当前项目或草稿。
  function changeOpen(next: boolean) { if (next) setQuery(''); onOpenChange(next); }
  // 项目名直接原位更新，避免收起动画先隐藏胶囊文字再重新显示。
  return <MorphingPopover open={open} onOpenChange={changeOpen} label="切换项目" panelWidth={380} topLayer reducedMotion
    panelPlacement="below" className="plotloom-project-switcher" panelClassName="plotloom-project-switcher__panel"
    trigger={props => <Button {...props} className="plotloom-work-start__project" variant="secondary"
      title={currentPath} aria-label={`切换项目：${projectName}`} disabled={disabled}>{projectName}</Button>}>
    <Input aria-label="搜索项目" placeholder="搜索项目" value={query} onValueChange={setQuery} startIcon={<Search />} />
    <div className="plotloom-project-switcher__list" aria-label="项目列表">
      {state === 'loading' ? <p role="status">正在加载项目…</p> : state === 'error' ? <>
        <p role="alert">项目列表加载失败</p><Button variant="secondary" onClick={onRetry}>重新加载</Button>
      </> : visibleProjects.length ? visibleProjects.map(project => <Button key={project.id} variant="ghost"
        className="plotloom-project-switcher__item" startIcon={<Folder />} aria-pressed={project.path === currentPath}
        onClick={() => onSelect(project)} title={project.path}>
        <span className="plotloom-project-switcher__name">{project.name}</span>
        {project.path === currentPath ? <Check className="plotloom-project-switcher__check" aria-hidden="true" /> : null}
      </Button>) : <p role="status">{search ? '未找到匹配项目' : '暂无项目，可以先新增一个。'}</p>}
    </div>
    <div className="plotloom-project-switcher__footer">
      {currentPath ? <Button variant="ghost" startIcon={<X />} onClick={onClear}>取消项目选择</Button> : null}
      <Button variant="ghost" startIcon={<Plus />} onClick={onCreate}>新建项目</Button>
    </div>
  </MorphingPopover>;
}
