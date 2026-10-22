import { projectCamera } from '../core/camera.ts'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { attachFloatingLayout, type FloatingGeometry } from './floating-layout.ts'
import { attachFrame } from './frame-bridge.ts'
import type { VillageRuntime } from './runtime.ts'
import { Hud } from './Hud.tsx'
import { SettingsPanel } from './SettingsPanel.tsx'
import { ManagementPanel } from './ManagementPanel.tsx'
import { Notifications } from './Notifications.tsx'
import { ArrangementControls } from './ArrangementControls.tsx'
import { PhotoPanel } from './PhotoPanel.tsx'
import { characterNames } from '../core/roster.ts'
import { en, zh } from './messages.ts'
import { uiContract } from './ui-contract.ts'
import { css } from './content-style.ts'
export { css }
function Scene({ runtime, fail }: { runtime: VillageRuntime; fail(): void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => ref.current ? attachFrame(ref.current, runtime, fail) : undefined, [runtime, fail])
  return <iframe ref={ref} src="/api/nidofy-ai-village/frame" title="AI 小院互动场景 / Interactive courtyard" sandbox="allow-scripts" />
}
export function Floating({ runtime: r, locale, active, onClose }: { runtime: VillageRuntime; locale: string; active: boolean; onClose(): void }) {
  useSyncExternalStore(r.subscribeUI, r.snapshotUI)
  const language = r.preferences.language === 'system' ? (locale === 'zh' ? 'zh' : 'en') : r.preferences.language, cn = language === 'zh', t = (a: string, b: string) => cn ? a : b, labels = cn ? zh : en
  useEffect(() => r.setLocale(language), [r, language])
  const anchor = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null), returnFocus = useRef<HTMLElement | null>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [fail] = useState(() => () => { setFailed(true); r.setFrameReady(false) })
  const p = r.presentation, expanded = p.expanded, confirmClose = p.confirmClose
  const setConfirmClose = (confirmClose: boolean) => r.present({ type: 'patch', patch: { confirmClose } })
  useLayoutEffect(() => {
    if (!r.open || !active || !anchor.current) { setGeometry(null); r.pause('sidebar', true); return }
    return attachFloatingLayout(anchor.current, value => { setGeometry(value); r.pause('sidebar', !value) }, expanded)
  }, [r, r.open, active, expanded])
  const width = geometry?.width ?? 340, height = Math.min(expanded ? 760 : 720, geometry?.height ?? 720), short = height < uiContract.shortHeight
  const insufficient = !!geometry && (height < uiContract.minimumHeight || width < uiContract.minimumWidth)
  useEffect(() => { r.pause('insufficient-space', insufficient); return () => r.pause('insufficient-space', false) }, [r, insufficient])
  const projection = projectCamera({x:0,y:0,width,height},p.camera), actor = r.controller?.world.actor
  const residentPosition = actor ? { left: Math.max(12,Math.min(width-232,projection.x+actor.position.x*projection.scale-110)), top: Math.max(60,Math.min(height-180,projection.y+actor.position.y*projection.scale-150)), transform: 'none' } : {}
  const mode = r.arranging || r.photoMode, lastMode = useRef(mode)
  const focusBack = () => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else (card.current?.querySelector<HTMLElement>('#village-tab-' + r.presentation.tab) ?? card.current?.querySelector<HTMLElement>('.village-hud button'))?.focus() }
  useEffect(() => { if (lastMode.current && !mode) focusBack(); lastMode.current = mode }, [mode])
  useEffect(() => { if(confirmClose)card.current?.querySelector<HTMLButtonElement>('.village-confirm button')?.focus() },[confirmClose])
  const close = () => { if (r.saveReceipt.status === 'pending' || r.saveReceipt.status === 'unknown' || r.homeSaving) return; if (r.arranging && r.arrangementDirty) setConfirmClose(true); else { r.cancelArrangements(); onClose() } }
  const visible = r.open && active && geometry && !r.reasons.has('hidden')
  return <div ref={anchor} data-nidofy-ai-village-overlay="" data-nidofy-village-open={r.open && active ? '' : undefined} className="dsh-ai-village"><style>{css}</style>
    {visible && <aside ref={card} className="village-card" aria-label={t('AI 小院', 'AI Village')} data-expanded={expanded} data-wide={width >= uiContract.inspectorWidth} data-short={short} data-theme={r.preferences.theme} data-solid={r.preferences.reducedTransparency || r.softwareRendering} data-motion={r.preferences.reducedMotion} style={{ left: geometry.left, top: geometry.top, width, height, '--card-height': `${height}px`, '--drawer-half': `${Math.min(360, Math.floor(.48 * height))}px` } as React.CSSProperties}
      onClickCapture={e => { const target = (e.target as HTMLElement).closest<HTMLElement>('button'); if (target && !r.arranging && !r.photoMode && !p.overlay) returnFocus.current = target }}
      onKeyDown={e => {
        if(e.key==='Tab' && confirmClose){const buttons=[...card.current!.querySelectorAll<HTMLButtonElement>('.village-confirm button')];if(e.shiftKey&&document.activeElement===buttons[0]){buttons.at(-1)?.focus();e.preventDefault()}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){buttons[0]?.focus();e.preventDefault()}return}
        if (e.key !== 'Escape' || e.nativeEvent.isComposing) return
        if (confirmClose) setConfirmClose(false)
        else if (r.controller?.drag) r.cancelDrag()
        else if (p.overlay && p.overlay !== 'settings') r.present({ type: 'patch', patch: { overlay: null } })
        else if (r.arranging) { if (r.saveReceipt.status !== 'pending' && r.saveReceipt.status !== 'unknown' && !r.homeSaving) r.cancelArrangements() }
        else if (r.photoMode) r.exitPhoto()
        else if (p.overlay === 'settings') { r.present({ type: 'patch', patch: { overlay: null } }); focusBack() }
        else if (p.drawer !== 'closed') r.present({ type: 'close' })
        else if (expanded) r.present({ type: 'patch', patch: { expanded: false } })
        else return
        e.preventDefault(); e.stopPropagation()
      }}>
      {!insufficient && <div className="village-canvas">{r.ready && !failed && <Scene key={r.generation + ':' + retry} runtime={r} fail={fail} />}</div>}
      {!r.photoMode && <Hud runtime={r} cn={cn} compact={width < uiContract.fullHudWidth} close={close} />}
      {insufficient ? <div className="village-error" role="status">{t('当前空间不足，已暂停。请调整窗口或展开小院。聊天输入区保持可用。', 'Paused for limited space. Resize or expand the courtyard. The chat composer remains available.')}</div> : <>
        {!r.error && !failed && <ManagementPanel runtime={r} cn={cn} short={short} />}
        <Notifications runtime={r} cn={cn} />
        {r.arranging && <ArrangementControls runtime={r} cn={cn} />}
        {r.photoMode && <PhotoPanel runtime={r} locale={language} />}
        {p.overlay === 'resident' && !mode && r.controller && <section className="village-popover village-resident-card" style={residentPosition}><strong>{characterNames[r.controller.world.actor.id]}</strong><p>{labels[r.controller.world.actor.behavior]}</p><button onClick={() => r.present({ type: 'patch', patch: { tab: 'residents', drawer: short ? 'full' : 'half', overlay: null } })}>{t('互动', 'Activities')}</button></section>}
        {p.overlay === 'settings' && !mode && <SettingsPanel runtime={r} cn={cn} close={() => { r.present({ type: 'patch', patch: { overlay: null } }); focusBack() }} />}
      </>}
      {(r.error || failed || r.saveReceipt.status === 'unknown' || r.saveReceipt.status === 'rejected') && <section className="village-error" role="alert"><p>{failed ? labels.frameFailed : r.error.includes('WORLD_IN_USE') ? labels.occupied : r.saveReceipt.status === 'unknown' ? labels.saveUnknown : labels.error}</p><button onClick={() => { if (failed) { setFailed(false); setRetry(v => v + 1) } else r.retry() }}>{failed ? labels.retryFrame : labels.retry}</button><details><summary>{t('诊断与恢复', 'Diagnostics and recovery')}</summary><p>{r.error}</p><button onClick={() => void (r.error.includes('PREFERENCES') ? r.recoverPreferences() : r.recover())}>{t('恢复上一成功版本', 'Restore previous revision')}</button></details></section>}
      {!r.ready && !r.error && <p className="village-loading">{labels.loading}</p>}
      {confirmClose && <section className="village-confirm" role="alertdialog" aria-label={t('放弃未保存布置？', 'Discard unsaved arrangement?')}><h2>{t('放弃未保存布置？', 'Discard unsaved arrangement?')}</h2><button onClick={() => setConfirmClose(false)}>{t('继续布置', 'Keep arranging')}</button><button onClick={() => { setConfirmClose(false); r.cancelArrangements(); onClose() }}>{t('放弃并关闭', 'Discard and close')}</button></section>}
    </aside>}
  </div>
}
