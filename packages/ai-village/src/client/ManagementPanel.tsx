import { PanelShell } from './PanelShell.tsx'
import type { Page } from './ui-state.ts'
import { zh, en } from './messages.ts'
import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { villageTabs } from './ui-contract.ts'
import { VillageIcon } from './Icon.tsx'
import { actors } from '../core/world.ts'
import { characterIds, characterNames, type CharacterId } from '../core/roster.ts'
import { neighborhoodEvents, stories, wishes, layouts, layoutNames, furnitureCatalog, decorationNames } from '../core/neighborhood-catalog.ts'
import { extraUnlocked } from '../core/neighborhood-state.ts'
import { villageTime } from '../core/dialogue.ts'
import { PhotoPanel } from './PhotoPanel.tsx'
export const actionErrorText = (code: string, cn: boolean) => {
  const map: Record<string, [string, string]> = {
    INTERACTION_COOLDOWN: ['请稍候，再开始下一次活动。', 'Wait a moment before another activity.'], LAYOUT_REQUIRED: ['请先布置所需的角落。', 'Arrange the required corner first.'],
    EVENT_ACTIVE: ['请先结束或取消当前活动。', 'Finish or cancel the current activity first.'], SAVE_UNCONFIRMED: ['保存结果尚未确认，请重新读取核对。', 'Save unconfirmed; read again to verify.'],
    FURNITURE_OCCUPIED: ['这个位置有居民，请取消布置并挪开居民后再试。', 'A resident occupies this spot. Cancel and move them first.'], LAYOUT_CONFLICT: ['布局已变化，请取消并重新开始。', 'The layout changed; cancel and start again.'],
  }
  return (map[code] ?? ['当前操作未完成，请检查活动、位置和连接状态。', 'Action incomplete. Check activities, positions and connection.'])[cn ? 0 : 1]
}
export function ManagementPanel({ runtime: r, cn, short }: { runtime: VillageRuntime; cn: boolean; short: boolean }) {
  const t = (a: string, b: string) => cn ? a : b, locale = cn ? 'zh' : 'en', p = r.presentation, w = r.controller?.world
  const content = useRef<HTMLDivElement>(null), scrolls = useRef<Record<string, number>>({})
  const [first, setFirst] = useState<CharacterId>('bluewhale'), [second, setSecond] = useState<CharacterId>('claude'), [food, setFood] = useState<'tea' | 'rice'>('tea')
  const names = { residents: t('居民', 'Residents'), wishes: t('心愿', 'Wishes'), decor: t('布置', 'Decor'), journal: t('手账', 'Journal') }
  useEffect(() => {
    if (!p.noticeTarget || p.tab !== 'journal' || p.drawer === 'closed') return
    const target = document.querySelector<HTMLElement>(`[data-notice-id="${CSS.escape(p.noticeTarget)}"]`)
    if (target) { target.scrollIntoView({ block: 'nearest' }); target.focus(); void r.markNoticesRead([p.noticeTarget]); r.present({ type: 'patch', patch: { noticeTarget: null } }) }
  }, [p.noticeTarget, p.tab, p.drawer, r])
  if (!w || r.arranging || r.photoMode) return null
  const members = actors(w), selected = p.residentTarget && members.some(a=>a.id===p.residentTarget) ? p.residentTarget : w.actor.id, busy = !r.ready || !!r.error || r.reasons.has('commit-pending'), eventBusy = busy || !!w.activeEvent || !!w.neighborhood.event
  const guest1 = members.some(a => a.id === first) ? first : selected, guest2 = members.find(a => a.id === second && a.id !== guest1)?.id ?? members.find(a => a.id !== guest1)?.id
  const go = (page: Page) => r.present({ type: 'push', patch: { page, drawer: 'full' } })
  const sub = (key: keyof typeof p.subpages, value: string) => r.present({ type: 'push', patch: { page: value as Page, drawer: 'full', subpages: { ...p.subpages, [key]: value } } })
  const activities = (count: number) => <div className="choices">{neighborhoodEvents.filter(d => d.count === count).map(d => {
    const missing = (d.furniture === 'books' || d.id === 'shared-book') && w.neighborhood.layout !== 'reading' || (d.furniture === 'plant' || d.id === 'plant-care') && w.neighborhood.layout !== 'garden'
    const reason = busy ? t('保存或连接处理中', 'Save or connection pending') : eventBusy ? t('请先结束当前活动', 'Finish the active event') : missing ? t('需要对应角落', 'Requires the matching corner') : w.ticks < w.neighborhood.nextInteractionTick ? t('请稍候', 'Wait a moment') : count === 2 && !guest2 ? t('需要两位居民', 'Requires two residents') : ''
    return <span key={d.id} className="village-action"><button disabled={!!reason} title={reason} onClick={() => void r.interact(d.id, count === 1 ? [selected] : [guest1, guest2!])}>{d.name[locale]}</button></span>
  })}</div>
  const begin = () => { r.present({ type: 'close' }); r.beginHome() }
  return <section className="village-management" data-snap={p.drawer}>
    {p.drawer !== 'closed' && !p.overlay && <PanelShell runtime={r} cn={cn} title={names[p.tab]} className="village-drawer">
      {p.page === 'quick' && <>
        {p.tab === 'residents' && <><div className="village-person"><img src={`/api/nidofy-ai-village/assets/portraits/${selected}.png`} alt=""/><span><strong>{characterNames[selected]}</strong><small>{t('在场','Present')} {members.length}/7 · {(cn?zh:en)[w.actor.behavior]}</small></span></div><div className="choices"><button onClick={()=>go('activities')}>{t('互动','Activities')}</button><button onClick={()=>go('residents')}>{t('全部居民','All residents')}</button></div></>}
        {p.tab === 'wishes' && <><p>{w.activeEvent || w.neighborhood.event ? t('朋友们正在一起活动','An activity is in progress') : t('同桌的午后','An afternoon together')}</p><div className="choices"><button onClick={()=>sub('wishes','wishes')}>{t('全部心愿','All wishes')}</button><button onClick={()=>sub('wishes','activities')}>{t('一起活动','Together')}</button></div></>}
        {p.tab === 'decor' && <><small>{layoutNames[w.neighborhood.layout][locale]}</small><div className="choices">{(['furniture','hanging','atmosphere'] as const).map((v,i)=><button key={v} onClick={()=>sub('decor',v)}>{[t('家具','Furniture'),t('挂饰','Hangings'),t('氛围','Atmosphere')][i]}</button>)}</div></>}
        {p.tab === 'journal' && <><p>{r.notices.length ? (r.notices[0]!.story==='first-table'?t('今天，我们坐到了一起','Today, we shared a table'):stories.find(s=>s.id===r.notices[0]!.story)?.name[locale]) : t('回忆将留在这里。','Memories will stay here.')}</p><div className="choices"><button onClick={()=>sub('journal','memories')}>{t('回忆','Memories')}</button><button onClick={()=>sub('journal','album')}>{t('相册','Album')}</button></div></>}
      </>}
      {p.page !== 'quick' && <>
      {(p.tab === 'wishes' || p.tab === 'residents') && (w.activeEvent || w.neighborhood.event) && <article className="village-status"><strong>{w.activeEvent ? t('同桌的午后', 'An afternoon together') : neighborhoodEvents.find(d => d.id === w.neighborhood.event?.definitionId)?.name[locale]}</strong><p>{(w.activeEvent ?? w.neighborhood.event)!.participants.map(id => characterNames[id]).join(' · ')} · {(w.activeEvent ?? w.neighborhood.event)!.phase}</p><button disabled={busy} onClick={() => void r.cancelEvent()}>{t('取消活动', 'Cancel activity')}</button></article>}
      {p.tab === 'residents' && (p.page==='residents'||p.page==='admissions') && <><header><strong>{t('在场', 'Present')} {members.length}/7</strong><button onClick={() => go('admissions')}>{t('安排入住', 'Manage residents')}</button></header>
        {p.page === 'admissions' && <div className="village-admissions">{characterIds.map(id => <label key={id}><input aria-label={t('入住 ', 'Resident ') + characterNames[id]} type="checkbox" checked={members.some(a => a.id === id)} disabled={busy || members.length === 1 && id === selected} onChange={e => r.setCharacterPresent(id, e.target.checked)} />{characterNames[id]}</label>)}<button disabled={busy} onClick={() => r.setAllCharacters(true)}>{t('全员入住', 'Invite everyone')}</button><button disabled={busy} onClick={() => r.setAllCharacters(false)}>{t('仅留当前', 'Keep selected only')}</button></div>}
        {p.page==='residents' && members.map(a => <div className="village-person" key={a.id}><img src={`/api/nidofy-ai-village/assets/portraits/${a.id}.png`} alt="" /><span><strong>{characterNames[a.id]}</strong><small>{(cn ? zh : en)[a.behavior]}</small></span><button disabled={busy} onClick={() => { r.selectCharacter(a.id); r.present({type:'close'}) }}>{t('看看', 'Look')}</button><button data-focus-key={'resident-detail-'+a.id} onClick={()=>r.present({type:'push',patch:{page:'activities',residentTarget:a.id}})}>{t('详情','Details')}</button></div>)}
      </>}
      {p.tab==='residents' && p.page==='activities' && <>
        <h3>{characterNames[selected]} · {t('日常互动', 'Daily activities')}</h3>{activities(1)}
        <button onClick={() => r.present({ type: 'push', patch: { tab: 'decor', page: 'atmosphere', accessoryTarget: selected, subpages: { ...p.subpages, decor: 'atmosphere' } } })}>{t('配饰', 'Accessories')}</button>
        <button onClick={()=>go('bonds')}>{t('共同经历','Shared experiences')}</button><button onClick={()=>r.present({type:'overlay',overlay:'settings'})}>{t('小院设置','Courtyard settings')}</button></>}
      {p.tab==='residents' && p.page==='bonds' && <><h3>{t('共同经历', 'Shared experiences')}</h3>{w.neighborhood.bonds.filter(b => b.pair.includes(selected)).map(b => <p key={b.pair.join('/')}>{b.pair.map(id => characterNames[id]).join(' & ')} · {b.count >= 3 ? t('熟悉', 'Familiar') : b.count >= 2 ? t('一起活动', 'Companions') : t('初次相聚', 'First gathering')} · ×{b.count}</p>)}
      </>}
      {p.tab === 'wishes' && <><div className="choices"><button aria-pressed={p.subpages.wishes === 'wishes'} onClick={() => sub('wishes', 'wishes')}>{t('心愿', 'Wishes')}</button><button aria-pressed={p.subpages.wishes === 'activities'} onClick={() => sub('wishes', 'activities')}>{t('一起活动', 'Together')}</button></div>
        {p.subpages.wishes === 'wishes' ? <><article><p>{w.journal.length ? '✓ ' : '○ '}{t('同桌的午后', 'An afternoon together')}</p><button onClick={() => sub('wishes', 'activities')}>{t('去看看', 'Explore')}</button></article>{wishes.map(item => <article key={item.id}><p>{w.neighborhood.memories.some(m => m.id === item.story) ? '✓ ' : '○ '}{item.title[locale]}</p><button onClick={() => sub('wishes', 'activities')}>{t('去看看', 'Explore')}</button></article>)}</> : <>
          <label>{t('第一位朋友', 'First guest')}<select value={guest1} disabled={eventBusy} onChange={e => setFirst(e.target.value as CharacterId)}>{members.map(a => <option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label>
          <label>{t('第二位朋友', 'Second guest')}<select value={guest2 ?? ''} disabled={eventBusy} onChange={e => setSecond(e.target.value as CharacterId)}>{members.filter(a => a.id !== guest1).map(a => <option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label>
          <div className="choices">{(['tea', 'rice'] as const).map(f => <button key={f} aria-pressed={food === f} onClick={() => setFood(f)}>{f === 'tea' ? t('热茶', 'Tea') : t('白米饭', 'Rice')}</button>)}</div><button disabled={eventBusy || !guest2} onClick={() => void r.invite([guest1, guest2!], food)}>{t('邀请同桌', 'Invite to the table')}</button>{activities(2)}
        </>}
      </>}
      {p.tab === 'decor' && <><div className="choices">{(['furniture', 'hanging', 'atmosphere'] as const).map((s, i) => <button key={s} aria-pressed={p.subpages.decor === s} onClick={() => sub('decor', s)}>{[t('家具', 'Furniture'), t('挂饰', 'Hangings'), t('氛围', 'Atmosphere')][i]}</button>)}</div>
        {p.subpages.decor === 'furniture' && <><div className="choices">{layouts.map(id => <button key={id} disabled={eventBusy} onClick={() => { begin(); r.homeTemplate(id) }}>{layoutNames[id][locale]}</button>)}</div><div className="village-catalog">{furnitureCatalog.map(f => <div key={f.id}><img src={`/api/nidofy-ai-village/assets/thumbnails/${f.id}.png`} alt="" width="44" height="44" style={{objectFit:'contain'}} />{f.name[locale]}</div>)}</div><button disabled={eventBusy} onClick={begin}>{t('开始布置', 'Start arranging')}</button></>}
        {p.subpages.decor === 'hanging' && <>{(['windChime', 'lantern', 'planter'] as const).map(id => <article key={id}><h3>{id === 'windChime' ? t('风铃', 'Wind chime') : decorationNames[id][locale]}</h3>{(id === 'windChime' ? !!w.decorations.windChime : extraUnlocked(w.neighborhood, id)) ? <button disabled={eventBusy} onClick={() => { r.present({ type: 'close' }); if (id === 'windChime') r.previewDecoration(w.decorations.windChime?.slot ?? 'window'); else r.previewExtraDecoration({ id, slot: w.neighborhood.decorations[id] }) }}>{t('调整位置', 'Adjust position')}</button> : <p>{id === 'windChime' ? t('首次同桌后发现', 'Discovered after sharing a table') : id === 'lantern' ? t('分享书页后发现', 'Discovered by sharing a page') : t('照料盆栽后发现', 'Discovered by watering a plant')}</p>}</article>)}</>}
        {p.subpages.decor === 'atmosphere' && <><p>{t('环境不影响界面主题。配饰分别记住每位居民的选择。', 'Environment does not change the UI theme. Accessories are remembered per resident.')}</p><label>{t('目标居民', 'Resident')}<select value={p.accessoryTarget ?? selected} onChange={e => r.present({ type: 'patch', patch: { accessoryTarget: e.target.value as CharacterId } })}>{characterIds.map(id => <option key={id} value={id}>{characterNames[id]}</option>)}</select></label><button disabled={eventBusy} onClick={begin}>{t('调整氛围与配饰', 'Arrange atmosphere and accessories')}</button></>}
        {!!(w.activeEvent || w.neighborhood.event) && <p>{t('请先结束或取消当前活动。', 'Finish or cancel the active event first.')}</p>}
      </>}
      {p.tab === 'journal' && <><div className="choices"><button aria-pressed={p.subpages.journal === 'memories'} onClick={() => sub('journal', 'memories')}>{t('回忆', 'Memories')}</button><button aria-pressed={p.subpages.journal === 'album'} onClick={() => sub('journal', 'album')}>{t('相册', 'Album')}</button></div>{p.subpages.journal === 'album' ? <><button disabled={busy || !r.frameReady} onClick={() => { r.present({ type: 'close' }); void r.enterPhoto() }}>{t('拍一张', 'Take a photo')}</button><PhotoPanel runtime={r} locale={locale} albumOnly /></> : <>{r.notices.map(n => <article tabIndex={-1} data-notice-id={n.id} className="village-journal" key={n.id}><small>{t('第', 'Day ')}{villageTime(n.tick).day}{cn ? '天' : ''} · ×{n.count}</small><h3>{n.story === 'first-table' ? t('今天，我们坐到了一起', 'Today, we shared a table') : stories.find(s => s.id === n.story)?.name[locale]}</h3><p>{n.participants.map(id => characterNames[id as CharacterId]).join(' & ')}</p></article>)}{!r.notices.length && <p>{t('回忆会在第一次完成活动并保存后留下。', 'First completed activities become memories after saving.')}</p>}</>}</>}
      {r.actionError && <p role="alert">{actionErrorText(r.actionError, cn)}<details><summary>{t('详情', 'Details')}</summary>{r.actionError}</details></p>}
    </>}
    </PanelShell>}
    {!p.overlay && <nav className="village-tabs" role="tablist" aria-label={t('小院页面', 'Courtyard pages')}>{villageTabs.map((tab, i) => <button id={`village-tab-${tab}`} key={tab} role="tab" aria-controls="village-panel" aria-selected={p.tab === tab && p.drawer !== 'closed'} onClick={() => r.present({ type: 'tab', tab, short })} onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; const next = villageTabs[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4]!; r.present({ type: 'tab', tab: next }); document.getElementById(`village-tab-${next}`)?.focus(); e.preventDefault() }}><VillageIcon name={tab} /><span>{names[tab]}</span></button>)}</nav>}
  </section>
}
