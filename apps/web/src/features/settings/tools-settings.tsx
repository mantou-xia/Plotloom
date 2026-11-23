import { useEffect, useState } from 'react';
import type { ToolInfo, ToolScope } from '@plotloom/contracts/skills';
import { SettingsSection } from '@plotloom/ui/settings-section';
import { SettingsRow } from '@plotloom/ui/settings-row';
import { requestJson } from '../../utils/http';

const scopeNames: Record<ToolScope, string> = { project: '项目聊天', novel: '小说聊天' };

/** 进入此栏才查询后端目录，切走时丢弃旧请求，避免快速切页时显示过期结果。 */
export function ToolsSettings() {
  const [tools, setTools] = useState<ToolInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ tools: ToolInfo[] }>('/api/tools', 'GET', undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setTools(result.tools);
    }, () => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, []);

  const status = failed ? '工具清单加载失败' : tools ? (tools.length ? `共 ${tools.length} 个工具` : '暂无工具') : '正在加载工具…';
  return <SettingsSection title="ToolCall 工具清单" description="工具按聊天类型和启用条件提供，具体可用项取决于当前会话。">
    <p className="plotloom-tools-status" role="status">{status}</p>
    {tools?.map(tool => <SettingsRow key={tool.name} layout="columns" className="plotloom-tool-row"
      title={<code>{tool.name}</code>} description={tool.description}>
      <dl>
        <dt>提供方</dt><dd>{tool.provider || '未提供来源'}</dd>
        <dt>调用参数</dt><dd>{tool.parameters}</dd>
        <dt>适用会话</dt><dd>{tool.availableIn.map(scope => scopeNames[scope]).join('、')}</dd>
        <dt>启用条件</dt><dd>{tool.condition}</dd>
      </dl>
    </SettingsRow>)}
  </SettingsSection>;
}
