import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AuditReport } from '../contracts.ts'

const en = { title: 'Windows Sandbox Enhanced', warning: 'Diagnostics only — isolated execution is NOT active. The official ACL provider remains unchanged.',
  configure: 'Add explicit roots in this plugin’s configuration in Plugins to enable read-only inspection.', scan: 'Inspect ACL / Low IL', busy: 'Inspecting…', incomplete: 'Incomplete scan; no recovery may be authorized.',
  complete: 'Scan completed (this is not an isolation security certification).', clean: 'No explicit Low IL label was found in the inspected entries.', error: 'Inspection failed', untested: 'Isolation, ACL restoration and VM execution are not available in this preview.' }
const zh: typeof en = { title: 'Windows 沙箱增强', warning: '当前仅提供诊断，隔离执行尚未启用。官方 ACL Provider 未被更改。',
  configure: '请在 Plugins 中配置本插件的 roots，显式选择只读检查目录。', scan: '检查 ACL / Low IL', busy: '正在检查…', incomplete: '扫描不完整，不能据此授权恢复。',
  complete: '扫描完成（不代表隔离安全验收通过）。', clean: '本次检查对象未发现显式 Low IL 标签。', error: '检查失败', untested: '此预览版尚不提供隔离执行、ACL 恢复或虚拟机运行。' }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'windows-sandbox-enhanced': keyof typeof en } }
export const name = 'windows-sandbox-enhanced-client'
export const inject = ['slots', 'locale', 'connection']
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('windows-sandbox-enhanced', { en, zh }))
  const t = ctx.locale.bind('windows-sandbox-enhanced')
  function Panel(props: PropsLocale<'windows-sandbox-enhanced'>) {
    const [roots, setRoots] = useState<string[]>([]), [report, setReport] = useState<AuditReport | null>(null)
    const [error, setError] = useState(''), [busy, setBusy] = useState(false)
    const controller = useRef<AbortController | null>(null)
    async function post(route: string, body: unknown) {
      const live = controller.current
      if (!live) throw new Error('DISCONNECTED')
      const response = await fetch('/api/windows-sandbox-enhanced/' + route, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: live.signal })
      const data = await response.json(); live.signal.throwIfAborted()
      if (!response.ok) throw new Error(data.error ?? 'REQUEST_FAILED'); return data
    }
    useEffect(() => {
      const live = new AbortController(); controller.current = live
      void post('status', {}).then(data => setRoots(data.roots)).catch(e => { if (!live.signal.aborted) setError(String(e)) })
      return () => live.abort()
    }, [])
    const scan = async (root: number) => {
      const live = controller.current
      if (!live) return
      setBusy(true); setReport(null); setError('')
      try { setReport(await post('scan', { root })) } catch (e) { if (!live.signal.aborted) setError(String(e)) }
      finally { if (!live.signal.aborted) setBusy(false) }
    }
    const low = report ? [...report.ancestors, ...report.entries].filter(e => e.integrityRid !== null && e.integrityRid <= 4096) : []
    return <section style={{ fontSize: 'inherit', maxWidth: '60rem', padding: '1rem' }}>
      <p role="status" style={{ color: 'var(--color-warning, #d6a756)' }}>{props.t('warning')}</p>
      <p>{props.t('untested')}</p>
      {!roots.length && <p>{props.t('configure')}</p>}
      {roots.map((root, index) => <div key={root} style={{ display: 'flex', gap: '1rem', marginBlock: '.5rem' }}><code style={{ overflowWrap: 'anywhere', flex: 1 }}>{root}</code><button disabled={busy} onClick={() => void scan(index)}>{props.t(busy ? 'busy' : 'scan')}</button></div>)}
      {error && <p role="alert">{props.t('error')}: {error}</p>}
      {report && <><p>{props.t(report.complete ? 'complete' : 'incomplete')}</p><p>{report.entries.length} objects / {report.failures.length} errors</p>
        {low.length ? <ul>{low.slice(0, 100).map(e => <li key={e.path}><code>{e.path}</code> — IL {e.integrityRid}{e.labelInherited ? ' (inherited)' : ''}</li>)}</ul> : <p>{props.t('clean')}</p>}</>}
    </section>
  }
  let generation = 0
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  // The settings renderer owns mounts; a connection reset invalidates in-flight observations.
  const View = (props: PropsLocale<'windows-sandbox-enhanced'>) => {
    const current = useSyncExternalStore(subscribe, () => generation)
    return createElement(Panel, { ...props, key: current })
  }
  ctx.on('connection/reset', () => { generation++; for (const listener of listeners) listener() })
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'windows-sandbox-enhanced', order: 49,
    locale: 'windows-sandbox-enhanced', label: () => t('title') }, View))
}
