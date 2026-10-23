import { useVillageTheme } from './theme-bridge.ts'
import { EntranceOverlay, entranceCSS } from './EntranceOverlay.tsx'
import { RecoveryEntrance, recoveryEntranceCSS } from './RecoveryEntrance.tsx'
import { RegionTransitionOverlay } from './RegionTransitionOverlay.tsx'
import { uiVariables } from './ui-theme.ts'
import { PanelShell } from './PanelShell.tsx'
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
  return <iframe ref={ref} src="/api/nidofy-ai-village/frame" title={runtime.frameKey === 'bookhouse' ? 'AI 书屋互动场景 / Interactive bookhouse' : 'AI 小院互动场景 / Interactive courtyard'} sandbox="allow-scripts" />
}
export function Floating({ runtime: r, locale, active, onClose }: { runtime: VillageRuntime; locale: string; active: boolean; onClose(): void }) {
  useSyncExternalStore(r.subscribeUI, r.snapshotUI)
  const language = r.preferences.language === 'system' ? (locale === 'zh' ? 'zh' : 'en') : r.preferences.language, cn = language === 'zh', t = (a: string, b: string) => cn ? a : b, labels = cn ? zh : en
  useEffect(() => r.setLocale(language), [r, language])
  const anchor = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null), returnFocus = useRef<HTMLElement | null>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [fail] = useState(() => () => { setFailed(true); r.returnToDoor() })
  const [retryFrame] = useState(() => () => { setFailed(false); setRetry(v => v + 1) })
  useLayoutEffect(() => { setFailed(false) }, [r.generation, r.frameKey])
  const p = r.presentation, expanded = p.expanded, confirmClose = p.confirmClose
  const theme = useVillageTheme(r.preferences.theme)
  const material = r.preferences.reducedTransparency ? 'reduced-transparency' : r.softwareRendering ? 'software-renderer' : typeof CSS !== 'undefined' && CSS.supports('backdrop-filter','blur(14px)') ? 'glass' : 'unsupported-blur'
  const setConfirmClose = (confirmClose: boolean, confirmTarget: 'plugin' | 'arrangement' = 'plugin') => r.present({ type: 'patch', patch: { confirmClose, confirmTarget } })
  useLayoutEffect(() => {
    if (!r.open || !active || !anchor.current) { setGeometry(null); r.pause('sidebar', true); return }
    return attachFloatingLayout(anchor.current, value => { setGeometry(value); r.pause('sidebar', !value) }, expanded)
  }, [r, r.open, active, expanded])
  const width = geometry?.width ?? 340, height = Math.min(expanded ? 760 : 720, geometry?.height ?? 720), short = height < uiContract.shortHeight
  const insufficient = !!geometry && (height < uiContract.minimumHeight || width < uiContract.minimumWidth)
  useEffect(() => { r.pause('insufficient-space', insufficient); return () => r.pause('insufficient-space', false) }, [r, insufficient])
  const mode = r.arranging || r.photoMode, lastMode = useRef(mode), lastPanel = useRef(false)
  const focusBack = () => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); else (card.current?.querySelector<HTMLElement>('#village-tab-' + r.presentation.tab) ?? card.current?.querySelector<HTMLElement>('.village-hud button'))?.focus() }
  useEffect(() => { const open=p.drawer!=='closed'||!!p.overlay; if(lastPanel.current&&!open&&!mode)focusBack();lastPanel.current=open },[p.drawer,p.overlay,mode])
  useEffect(() => { if (lastMode.current && !mode) focusBack(); lastMode.current = mode }, [mode])
  useEffect(() => { if(confirmClose)card.current?.querySelector<HTMLButtonElement>('.village-confirm button')?.focus() },[confirmClose])
  const close = () => { if (r.saveReceipt.status === 'pending' || r.saveReceipt.status === 'unknown' || r.homeSaving) return; if (r.arranging && r.arrangementDirty) setConfirmClose(true); else { r.cancelArrangements(); onClose() } }
  const visible = r.open && active && geometry && !r.reasons.has('hidden')
  const blocked = r.entrance.blocking, canvas = useRef<HTMLDivElement>(null), entryUI = useRef<HTMLDivElement>(null)
  const entryHadFocus = useRef(false)
  useLayoutEffect(() => { if(canvas.current)canvas.current.inert=blocked; if(entryUI.current)entryUI.current.inert=blocked && !insufficient }, [blocked, visible, insufficient])
  useLayoutEffect(() => { if (!blocked && entryHadFocus.current) { if(visible && document.activeElement===document.body) card.current?.querySelector<HTMLButtonElement>('.village-hud button')?.focus(); entryHadFocus.current=false } }, [blocked,visible])
  return <div ref={anchor} data-nidofy-ai-village-overlay="" data-nidofy-village-open={r.open && active ? '' : undefined} className="dsh-ai-village"><style>{css + entranceCSS + recoveryEntranceCSS}</style>
    {visible && <aside ref={card} className="village-card" aria-label={t('AI 小院', 'AI Village')} data-expanded={expanded} data-wide={width >= uiContract.inspectorWidth} data-short={short} data-entrance-wide={width >= 580} data-theme={theme.mode} data-theme-source={theme.source} data-material={material} data-solid={material !== 'glass'} data-motion={r.preferences.reducedMotion} style={{ left: geometry.left, top: geometry.top, width, height, '--card-height': `${height}px`, ...uiVariables(width,height,r.preferences.textScale,theme.mode,r.controller?.world.home.environment ?? 'afternoon') } as React.CSSProperties}
      onClickCapture={e => { const target = (e.target as HTMLElement).closest<HTMLElement>('button'); if (target && !r.arranging && !r.photoMode && !p.overlay) returnFocus.current = target }}
      onFocusCapture={e => { if((e.target as HTMLElement).closest('.village-entrance,.village-region-transition'))entryHadFocus.current=true }}
      onKeyDown={e => {
        if(e.key==='Tab' && confirmClose){const buttons=[...card.current!.querySelectorAll<HTMLButtonElement>('.village-confirm button')];if(e.shiftKey&&document.activeElement===buttons[0]){buttons.at(-1)?.focus();e.preventDefault()}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){buttons[0]?.focus();e.preventDefault()}return}
        if (e.key !== 'Escape' || e.nativeEvent.isComposing) return
        if (blocked && !r.entrance.reentry && !r.error && !failed) { r.skipEntrance(); e.preventDefault(); e.stopPropagation(); return }
        const details=card.current?.querySelector<HTMLDetailsElement>('details[open]')
        if (confirmClose) setConfirmClose(false)
        else if(details) details.open=false
        else if (r.controller?.drag) r.cancelDrag()
        else if ((p.overlay || p.drawer !== 'closed') && !mode) r.present({ type: 'back' })
        else if (r.arranging) { if (r.saveReceipt.status !== 'pending' && r.saveReceipt.status !== 'unknown' && !r.homeSaving) { if(r.arrangementDirty) setConfirmClose(true, 'arrangement'); else r.cancelArrangements() } }
        else if (r.photoMode) r.exitPhoto()
        else if (expanded) r.present({ type: 'patch', patch: { expanded: false } })
        else return
        e.preventDefault(); e.stopPropagation()
      }}>
      {!insufficient && <div ref={canvas} className="village-canvas" aria-hidden={blocked}>{r.ready && !failed && (!r.entrance.reentry || r.entrance.doorOpened) && <Scene key={r.generation + ':' + r.frameKey + ':' + retry} runtime={r} fail={fail} />}</div>}
      <div ref={entryUI} className="village-entry-ui" aria-hidden={blocked && !insufficient} data-entered={!blocked}>
      {!r.photoMode && <Hud runtime={r} cn={cn} compact={width < uiContract.fullHudWidth} close={close} />}
      {insufficient ? <div className="village-error" role="status">{t('当前空间不足，已暂停。请调整窗口或展开小院。聊天输入区保持可用。', 'Paused for limited space. Resize or expand the courtyard. The chat composer remains available.')}</div> : <>
        {!r.error && !failed && <ManagementPanel runtime={r} cn={cn} short={short} />}
        <Notifications runtime={r} cn={cn} />
        {r.arranging && <ArrangementControls runtime={r} cn={cn} />}
        {r.photoMode && <PhotoPanel runtime={r} locale={language} />}
        {p.overlay === 'resident' && !mode && r.controller && <PanelShell runtime={r} cn={cn} title={characterNames[r.controller.world.actor.id]} className="village-popover village-resident-card"><p>{labels[r.controller.world.actor.behavior]}</p><button onClick={() => r.present({ type: 'push', patch: { tab: 'residents', page:'activities', drawer: 'full', overlay: null } })}>{t('互动', 'Activities')}</button></PanelShell>}
        {p.overlay === 'settings' && !mode && <SettingsPanel runtime={r} cn={cn} close={() => { r.present({ type: 'patch', patch: { overlay: null } }); focusBack() }} />}
      </>}
      </div>
      {!insufficient && r.entrance.reentry && <RecoveryEntrance runtime={r} cn={cn} close={close} retryFrame={retryFrame} />}
      {!insufficient && blocked && !r.entrance.reentry && !r.error && !failed && (r.regionTransition ? <RegionTransitionOverlay runtime={r} cn={cn} close={close} /> : <EntranceOverlay runtime={r} cn={cn} close={close} />)}
      {blocked && !r.entrance.reentry && (r.error || failed) && <button style={{position:'absolute',right:8,bottom:8,zIndex:30,minHeight:40}} onClick={close}>{t('关闭小院','Close courtyard')}</button>}
      {!insufficient && !r.entrance.reentry && (r.error || failed || r.saveReceipt.status === 'unknown' || r.saveReceipt.status === 'rejected') && <section className="village-error" role="alert"><p>{failed ? labels.frameFailed : r.error.includes('WORLD_IN_USE') ? labels.occupied : r.saveReceipt.status === 'unknown' || r.errorCode === 'PREFERENCES_UNCONFIRMED' ? labels.saveUnknown : r.errorCode === 'CONNECTION_TEMPORARY' ? (r.recoveryState === 'blocked' ? t('连接尚未恢复，请重新核对。','Connection not restored. Check again.') : t('正在连接小院…','Connecting to the courtyard…')) : r.errorCode.includes('CONFLICT') ? t('小院记录已变化，请核对后再继续。','Courtyard data changed. Check before continuing.') : labels.error}</p><button onClick={() => { if (failed) { setFailed(false); setRetry(v => v + 1) } else if (r.errorCode === 'CONNECTION_TEMPORARY' || r.errorCode.includes('UNCONFIRMED')) void r.checkRecovery(); else r.retry() }}>{failed ? labels.retryFrame : labels.retry}</button><details><summary>{t('诊断与恢复', 'Diagnostics and recovery')}</summary><p>{r.errorCode}</p><button onClick={() => void (r.error.includes('PREFERENCES') ? r.recoverPreferences() : r.recover())}>{t('恢复上一成功版本', 'Restore previous revision')}</button></details></section>}
      {confirmClose && <div className="village-confirm-shade"><section className="village-confirm" role="alertdialog" aria-modal="true" aria-label={t('放弃未保存布置？', 'Discard unsaved arrangement?')}><h2>{t('放弃未保存布置？', 'Discard unsaved arrangement?')}</h2><button onClick={() => setConfirmClose(false)}>{t('继续布置', 'Keep arranging')}</button><button onClick={() => { const target=p.confirmTarget; setConfirmClose(false); r.cancelArrangements(); if(target==='plugin') onClose() }}>{p.confirmTarget==='plugin'?t('放弃并关闭', 'Discard and close'):t('放弃并退出布置','Discard and exit arrangement')}</button></section></div>}
    </aside>}
  </div>
}
