import { useEffect, useState } from 'react';
import { AGENT_PROFILE_LIMITS, type AgentPersona, type AgentProfile, type AgentProfileUpdate } from '@plotloom/contracts';
import { Button } from '@plotloom/ui/button';
import { FormField } from '@plotloom/ui/form-field';
import { Input } from '@plotloom/ui/input';
import { Textarea } from '@plotloom/ui/textarea';
import { requestJson } from '../../utils/http';
import { runWithToast } from '../../utils/feedback';

const profilePath = '/api/agent-profile';

/** 打开设置时读取已保存的人设，包括 Agent 刚在聊天中保存的内容。 */
function useAgentProfile() {
  const [profile, setProfile] = useState<AgentProfile>();
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void requestJson<AgentProfile>(profilePath, 'GET', undefined, abort.signal).then(value => {
      if (!abort.signal.aborted) { setProfile(value); setFailed(false); }
    }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [reload]);

  async function update(input: AgentPersona) {
    setSaving(true);
    const result = await runWithToast(() => requestJson<AgentProfile>(profilePath, 'PUT', { action: 'save', ...input } satisfies AgentProfileUpdate),
      { loading: '正在保存…', success: 'Agent 人设已保存' });
    setSaving(false);
    if (result.ok) setProfile(result.value);
    return result.ok;
  }
  return { profile, failed, saving, update, reload: () => { setFailed(false); setReload(value => value + 1); } };
}

type AgentProfileControls = ReturnType<typeof useAgentProfile>;

/** 留空时使用助手的默认行为。 */
function ProfileFields({ draft, onChange, disabled }: { draft: AgentPersona; onChange: (value: AgentPersona) => void; disabled: boolean }) {
  return <div style={{ display: 'grid', gap: 16 }}>
    <FormField label="Agent 名字" disabled={disabled}>
      <Input value={draft.name} placeholder="例如 小舟" maxLength={AGENT_PROFILE_LIMITS.name} onValueChange={name => onChange({ ...draft, name })} />
    </FormField>
    <FormField label="沟通风格" disabled={disabled}>
      <Input value={draft.style} placeholder="例如 简洁直率，先说结论" maxLength={AGENT_PROFILE_LIMITS.style} onValueChange={style => onChange({ ...draft, style })} />
    </FormField>
    <FormField label="协作偏好" disabled={disabled}>
      <Textarea value={draft.preferences} placeholder="例如 遇到设定冲突时先问我，给两种可选方案" rows={4}
        maxLength={AGENT_PROFILE_LIMITS.preferences} onValueChange={preferences => onChange({ ...draft, preferences })} />
    </FormField>
  </div>;
}

function ProfileEditor({ value, controls }: { value: AgentProfile; controls: AgentProfileControls }) {
  const [draft, setDraft] = useState<AgentPersona>({ name: value.name, style: value.style, preferences: value.preferences });
  const dirty = draft.name !== value.name || draft.style !== value.style || draft.preferences !== value.preferences;
  return <form style={{ display: 'grid', gap: 20, maxWidth: 580 }} onSubmit={event => {
    event.preventDefault();
    if (!controls.saving && dirty) void controls.update(draft);
  }}>
    <p style={{ margin: 0 }}>设置适用于所有项目和小说，留空时沿用默认。</p>
    <ProfileFields draft={draft} onChange={setDraft} disabled={controls.saving} />
    <div><Button type="submit" disabled={!dirty || controls.saving} loading={controls.saving}>保存人设</Button></div>
  </form>;
}

export function AgentProfileSettings() {
  const controls = useAgentProfile();
  if (controls.failed) return <Button variant="secondary" onClick={controls.reload}>重新加载人设</Button>;
  const value = controls.profile;
  if (!value) return <p role="status">正在加载 Agent 人设…</p>;
  return <ProfileEditor key={JSON.stringify(value)} value={value} controls={controls} />;
}
