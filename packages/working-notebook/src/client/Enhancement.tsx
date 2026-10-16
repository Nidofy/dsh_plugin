/** One durable profile-wide choice shared by the rail and settings page. */
import { useEffect, useMemo, useState } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
interface Settings { schemaVersion: 1; revision: number; autoOrganize: boolean }
async function settingsRequest(method: string, input: object, signal?: AbortSignal): Promise<Settings> {
  const response = await fetch('/api/nidofy-notebook/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), ...(signal ? { signal } : {}) })
  const value = await response.json() as Settings & { error?: string }
  if (!response.ok) throw Error(value.error ?? 'NOTEBOOK_SETTINGS_UNAVAILABLE')
  return value
}
/** Disabling takes effect for the next compaction and discards pending enhancement candidates. */
export function Enhancement({ t }: PropsLocale<'nidofy.notebook'>) {
  const [settings, setSettings] = useState<Settings>(), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lifetime = useMemo(() => new AbortController(), [])
  useEffect(() => () => lifetime.abort(), [lifetime])
  useEffect(() => {
    const abort = new AbortController()
    const refresh = () => { void settingsRequest('settings', {}, abort.signal).then((value) => { if (!abort.signal.aborted) setSettings(value) }).catch((error: unknown) => { if (!abort.signal.aborted) setError(String(error)) }) }
    refresh(); window.addEventListener('nidofy-notebook-settings', refresh)
    return () => { abort.abort(); window.removeEventListener('nidofy-notebook-settings', refresh) }
  }, [])
  const save = async (autoOrganize: boolean) => {
    if (!settings) return
    setBusy(true); setError('')
    try {
      const saved = await settingsRequest('save-settings', { ...settings, autoOrganize }, lifetime.signal)
      lifetime.signal.throwIfAborted()
      setSettings(saved)
      window.dispatchEvent(new Event('nidofy-notebook-settings'))
    } catch (error) { if (!lifetime.signal.aborted) { setError(String(error)); window.dispatchEvent(new Event('nidofy-notebook-settings')) } }
    finally { if (!lifetime.signal.aborted) setBusy(false) }
  }
  return <section className="nidofy-note-enhancement">
    <div className="nidofy-notebook-setting-row"><div><div>{t('autoOrganize')}</div><p>{t('autoOrganizeHint')}</p></div>
      <Switch checked={settings?.autoOrganize ?? false} disabled={!settings || busy} label={t('autoOrganize')} onChange={(value) => { void save(value) }} /></div>
    {error && <div role="alert"><p>{t('contextError')}</p><details><summary>{t('errorDetails')}</summary><pre>{error}</pre></details></div>}
  </section>
}
