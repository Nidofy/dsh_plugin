import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { VillageIcon } from './Icon.tsx'
import { villageTime } from '../core/dialogue.ts'
export function Hud({ runtime: r, cn, compact, close }: { runtime: VillageRuntime; cn: boolean; compact: boolean; close(): void }) {
  const t = (a: string, b: string) => cn ? a : b, p = r.presentation, world = r.controller?.world, time = villageTime(world?.ticks ?? 0)
  const [hint, setHint] = useState(false), viewRef = useRef<HTMLElement>(null), [viewFocused, setViewFocused] = useState(false)
  useEffect(() => { const remaining=2000-(Date.now()-p.zoomHint);if(remaining<=0){setHint(false);return}setHint(true);const timer=setTimeout(()=>setHint(false),remaining); return () => clearTimeout(timer) }, [p.zoomHint])
  const locked = !r.ready || !!r.error || r.reasons.has('commit-pending'), mode = r.arranging || r.photoMode
  useEffect(() => { if(!viewRef.current?.contains(document.activeElement))setViewFocused(false) },[p.overlay,p.drawer,mode])
  const unread = r.preferences.noticesInitialized ? r.notices.filter(n => !r.preferences.noticeReadIds.includes(n.id)).length : 0
  const actions = [
    { icon: 'camera' as const, label: t('拍照', 'Photo mode'), disabled: mode || locked || !r.frameReady, run: () => { r.present({ type: 'close' }); void r.enterPhoto() } },
    { icon: 'view' as const, label: t('视角', 'View'), disabled: mode, run: () => r.present({ type: 'overlay', overlay: 'view' }) },
    { icon: p.expanded ? 'compact' as const : 'expand' as const, label: t(p.expanded ? '收起小院' : '展开小院', p.expanded ? 'Compact courtyard' : 'Expand courtyard'), run: () => r.present({ type: 'patch', patch: { expanded: !p.expanded, overlay: null } }) },
    { icon: 'settings' as const, label: t('小院设置', 'Courtyard settings'), disabled: mode, run: () => r.present({ type: 'overlay', overlay: 'settings' }) },
    { icon: 'close' as const, label: t('关闭小院', 'Close courtyard'), run: close },
  ]
  return <><header className="village-hud">
    <button disabled={mode} aria-label={t(`消息，${unread} 条未读`, `Notifications, ${unread} unread`)} onClick={() => r.present({ type: 'overlay', overlay: 'notifications' })}><VillageIcon name="notifications" />{unread > 0 && <b className="village-badge">{unread > 9 ? '9+' : unread}</b>}</button>
    <span className="village-time">{t(`第${time.day}天`, `Day ${time.day}`)} · {String(time.hour).padStart(2, '0')}:{String(time.minute).padStart(2, '0')}</span>
    <span className="village-hud-spacer" />
    <button disabled={locked || mode} aria-label={world?.userPaused ? t('继续', 'Resume') : t('暂停', 'Pause')} onClick={() => r.pause('user', !world?.userPaused)}><VillageIcon name={world?.userPaused ? 'play' : 'pause'} /></button>
    {compact ? <button aria-label={t('更多', 'More')} onClick={() => r.present({ type: 'overlay', overlay: 'more' })}><VillageIcon name="more" /></button> : actions.map(a => <button key={a.icon} title={a.label} aria-label={a.label} disabled={a.disabled} onClick={a.run}><VillageIcon name={a.icon} /></button>)}
  </header>
  {p.overlay === 'more' && <section className="village-popover village-more" aria-label={t('更多', 'More')}>{actions.map(a => <button key={a.icon} disabled={a.disabled} onClick={a.run}><VillageIcon name={a.icon} />{a.label}</button>)}</section>}
  {(p.overlay === 'view' || (hint || viewFocused) && !p.overlay && p.drawer === 'closed' && !mode) && <section ref={viewRef} className="village-popover village-view" onFocus={()=>setViewFocused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setViewFocused(false)}} aria-label={t('视角', 'View')}><button aria-label={t('缩小', 'Zoom out')} onClick={() => r.setCamera({ ...p.camera, zoom: Math.max(1, p.camera.zoom - .1) })}>−</button><output>{Math.round(p.camera.zoom * 100)}%</output><button aria-label={t('放大', 'Zoom in')} onClick={() => r.setCamera({ ...p.camera, zoom: Math.min(1.5, p.camera.zoom + .1) })}>+</button><button onClick={() => r.resetCamera()}>{t('恢复全景', 'Reset view')}</button></section>}
  </>
}
