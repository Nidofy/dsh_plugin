import { playDefinition } from '../core/play-catalog.ts'
import { PanelShell } from './PanelShell.tsx'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { stories } from '../core/neighborhood-catalog.ts'
export function Notifications({ runtime: r, cn }: { runtime: VillageRuntime; cn: boolean }) {
  const t = (a: string, b: string) => cn ? a : b, p = r.presentation, [hover, setHover] = useState(false), remaining = useRef(5000)
  const blocked = r.arranging || r.photoMode || !!r.error || !!r.controller?.drag || r.saveReceipt.status === 'unknown'
  const ids = p.toastIds.join('|'), [settled, setSettled] = useState(false)
  useEffect(() => { setSettled(false); remaining.current = 5000; const timer = setTimeout(() => setSettled(true), 3000); return () => clearTimeout(timer) }, [ids])
  useEffect(() => { if (!ids || !settled || blocked || hover) return; const start = Date.now(), timer = setTimeout(() => r.present({ type: 'patch', patch: { toastIds: [] } }), remaining.current); return () => { clearTimeout(timer); remaining.current = Math.max(0, remaining.current - (Date.now() - start)) } }, [ids, settled, blocked, hover, r])
  const open = (id?: string) => {
    if (id && !r.notices.some(n => n.id === id)) return
    r.present({ type: 'push', patch: { page:'memories',tab: 'journal', drawer: 'full', overlay: null, noticeTarget: id ?? null, subpages: { ...p.subpages, journal: 'memories' } } })
  }
  return <>{p.overlay === 'notifications' && <PanelShell runtime={r} cn={cn} className="village-popover village-notices" title={t('消息', 'Notifications')}><button disabled={r.preferencesSaving || !r.preferences.noticesInitialized} onClick={() => void r.markNoticesRead(r.notices.map(n => n.id))}>{t('全部已读', 'Mark all read')}</button>
    {!r.preferences.noticesInitialized && <p role="status">{t('消息状态尚未保存', 'Notification state is not saved yet')}</p>}
    <div className="village-notice-list">{r.notices.length ? r.notices.map(n => <button key={n.id} onClick={() => open(n.id)}>{!r.preferences.noticeReadIds.includes(n.id) && r.preferences.noticesInitialized ? '• ' : ''}{n.story === 'first-table' ? t('今天，我们坐到了一起', 'Today, we shared a table') : (stories.find(s => s.id === n.story)?.name[cn ? 'zh' : 'en'] ?? playDefinition(n.story)?.name[cn ? 'zh' : 'en'])}<small>{n.participants.map(id=>characterNames[id as CharacterId]).join(' · ')}{n.story==='first-table'?t(' · 发现风铃',' · Wind chime discovered'):n.story==='shared-book'?t(' · 发现纸灯笼',' · Lantern discovered'):n.story==='water'?t(' · 发现花叶挂饰',' · Hanging leaves discovered'):''}</small></button>) : <p>{t('还没有留下首次回忆。', 'No first memories yet.')}</p>}</div><button onClick={() => open()}>{t('查看手账', 'Open journal')}</button></PanelShell>}
    {!!ids && settled && !blocked && !p.overlay && <aside className="village-toast" style={{bottom:p.drawer==='closed'?80:p.drawer==='half'?'calc(var(--drawer-half) + 24px)':'calc(100% - 72px)'}} role="status" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>{t(`新增 ${p.toastIds.length} 段回忆`, `${p.toastIds.length} new memories`)}<button onClick={() => open(p.toastIds[0])}>{t('查看', 'View')}</button></aside>}
  </>
}
