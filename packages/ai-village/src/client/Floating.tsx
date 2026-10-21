import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { attachFloatingLayout, type FloatingGeometry } from './floating-layout.ts'
import { attachFrame } from './frame-bridge.ts'
import type { VillageRuntime } from './runtime.ts'
import { en, zh } from './messages.ts'
import { characterIds, characterNames } from '../core/roster.ts'
import { actors } from '../core/world.ts'
export const css = `
[data-nidofy-ai-village-space]{margin-right:364px!important}
.dsh-ai-village{font:13px/1.5 var(--dsw-font-family,system-ui);color:var(--dsw-alias-label-primary,#e8ede6)}
.dsh-ai-village *{box-sizing:border-box}.dsh-ai-village button{font:inherit;color:inherit;cursor:pointer;background:transparent;border:1px solid #808b8060;border-radius:8px;padding:5px 9px}
.dsh-ai-village button:focus-visible{outline:2px solid #9ecbb4}
.village-card{position:absolute;width:340px;pointer-events:auto;background:var(--dsw-alias-bg-layer-2,#242824);border:1px solid #808b8040;border-radius:16px;box-shadow:0 8px 28px #0002;display:flex;flex-direction:column;overflow:hidden}
.village-header{display:flex;align-items:center;gap:6px;padding:10px 12px;flex:none}.village-header strong{flex:1}
.village-roster{display:flex;align-items:center;gap:10px;padding:0 12px 6px}.village-roster select{flex:1;min-width:0;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2,#242824);border:1px solid #808b8060;border-radius:6px;padding:5px}
.village-canvas{width:100%;aspect-ratio:3/4;min-height:0;flex:1;overflow:hidden;background:#ede8db}.village-canvas iframe{width:100%;height:100%;display:block;border:0}
.village-members{padding:0 12px 4px;flex:none}.village-members summary{cursor:pointer;font-size:12px}.village-members-menu{position:absolute;z-index:2;left:12px;right:12px;max-height:210px;overflow:auto;padding:10px;background:var(--dsw-alias-bg-layer-2,#242824);border:1px solid #808b8060;border-radius:10px;box-shadow:0 5px 20px #0003}.village-members-list{display:grid;grid-template-columns:1fr 1fr;gap:5px}.village-members-list label{display:flex;align-items:center;gap:5px}.village-members-menu button{margin:5px 4px 0 0}
.village-footer{padding:6px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#aeb7aa);flex:none}
.village-error{padding:14px;overflow:auto}.village-error button{margin:5px}
`
function Scene({ runtime, fail }: { runtime: VillageRuntime; fail(): void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => ref.current ? attachFrame(ref.current, runtime, fail) : undefined, [runtime, fail])
  return <iframe ref={ref} src="/api/nidofy-ai-village/frame" title="AI 小院互动场景 / Interactive courtyard" sandbox="allow-scripts" />
}
export function Floating({ runtime, locale, active, onClose }: { runtime: VillageRuntime; locale: string; active: boolean; onClose(): void }) {
  useSyncExternalStore(runtime.subscribe, runtime.snapshot)
  const t = locale === 'zh' ? zh : en
  const anchor = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [fail] = useState(() => () => { setFailed(true); runtime.setFrameReady(false) })
  useLayoutEffect(() => {
    if (!runtime.open || !active || !anchor.current) { setGeometry(null); runtime.pause('sidebar', true); return }
    return attachFloatingLayout(anchor.current, value => { setGeometry(value); runtime.pause('sidebar', !value) })
  }, [runtime, runtime.open, active])
  const visible = runtime.open && active && geometry && !runtime.reasons.has('hidden')
  const actor = runtime.controller?.world.actor
  const members = runtime.controller ? actors(runtime.controller.world).map(a => a.id) : ['bluewhale']
  const status = runtime.controller?.pauseReasons.size ? t.paused : runtime.controller?.drag?.active ? t.dragging : actor ? t[actor.behavior] : t.loading
  return <div ref={anchor} data-nidofy-ai-village-overlay="" data-nidofy-village-open={runtime.open && active ? '' : undefined} className="dsh-ai-village"><style>{css}</style>
    {visible && <aside className="village-card" aria-label={t.title} style={{ left: geometry.left, top: geometry.top, height: geometry.stacked ? geometry.height : Math.min(720, geometry.height) }}>
      <header className="village-header"><strong>{t.title}</strong>
        <button disabled={!runtime.controller || !runtime.ready} onClick={() => runtime.pause('user', !runtime.controller?.world.userPaused)}>{runtime.controller?.world.userPaused ? t.resume : t.pause}</button>
        <button aria-label={t.close} onClick={onClose}>×</button>
      </header>
      <label className="village-roster">{locale === 'zh' ? '小院伙伴' : 'Companion'}
        <select aria-label={locale === 'zh' ? '选择角色' : 'Choose character'} value={actor?.id ?? 'bluewhale'}
          disabled={!runtime.ready || !!runtime.error} onChange={event => runtime.selectCharacter(event.target.value)}>
          {characterIds.filter(id => members.length === 1 || members.includes(id)).map(id => <option key={id} value={id}>{id === 'qwen' && locale === 'zh' ? '千问 · Qwen' : characterNames[id]}</option>)}
        </select>
      </label>
      <details className="village-members"><summary>{locale === 'zh' ? '在场伙伴' : 'Residents'} · {members.length}/7</summary>
        <div className="village-members-menu"><div className="village-members-list">
          {characterIds.map(id => <label key={id}><input type="checkbox" aria-label={(locale === 'zh' ? '入住 ' : 'Resident ') + characterNames[id]}
            checked={members.includes(id)} disabled={!runtime.ready || !!runtime.error || (members.length === 1 && members.includes(id))}
            onChange={event => runtime.setCharacterPresent(id, event.target.checked)} />{characterNames[id]}</label>)}
        </div><button disabled={!runtime.ready || !!runtime.error} onClick={() => runtime.setAllCharacters(true)}>{locale === 'zh' ? '全员入住' : 'Invite everyone'}</button>
        <button disabled={!runtime.ready || !!runtime.error} onClick={() => runtime.setAllCharacters(false)}>{locale === 'zh' ? '仅留当前' : 'Keep selected only'}</button></div>
      </details>
      <div className="village-footer" role="status">{status} · {t.saved} r{runtime.revision}</div>
      {runtime.retentionWarning && <div className="village-footer" role="status">{t.retentionWarning}</div>}
      {runtime.error ? <div className="village-error" role="alert">
        <p>{runtime.error.includes('WORLD_IN_USE') ? t.occupied : /PROFILE_CHANGED|REVISION_CONFLICT|HOST_CHANGED/.test(runtime.error) ? t.conflict : t.error}</p>
        <button onClick={() => runtime.retry()}>{t.retry}</button>
        <details><summary>{t.recover}</summary><p>{t.recovery}</p><button onClick={() => void runtime.recover()}>{t.recover}</button></details>
      </div> : failed ? <div className="village-error">{t.frameFailed}<button onClick={() => { setFailed(false); setRetry(v => v + 1) }}>{t.retryFrame}</button></div>
        : runtime.ready ? <div className="village-canvas"><Scene key={runtime.generation + ':' + retry} runtime={runtime} fail={fail} /></div> : <p className="village-error">{t.loading}</p>}
      <div className="village-footer">{runtime.controller?.lastPlacement === 'rejected' ? t.rejected : t.help}</div>
    </aside>}
  </div>
}
