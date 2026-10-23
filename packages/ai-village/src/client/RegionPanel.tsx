import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { actors } from '../core/world.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { CollectionPanel } from './CollectionPanel.tsx'

export function RegionPanel({ runtime: r, locale, locked, tab = 'decor' }: { runtime: VillageRuntime; locale: Locale; locked: boolean; tab?: string }) {
  const w = r.controller?.world, t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!w) return null
  const inside = w.region?.active === 'bookhouse', members = actors(w)
  const busy = locked || r.regionTransition || r.arranging || r.photoMode || !!r.controller?.drag || !!w.activeEvent || !!w.neighborhood.event || !!w.play.active || !!w.bookhouse.active
  const paused = !!r.controller?.pauseReasons.size
  return <section className="village-neighborhood village-region" aria-label={t('AI 书屋 · 开发样板', 'AI Bookhouse · Development preview')}>
    <h3>{t('AI 书屋 · 开发样板', 'AI Bookhouse · Development preview')}</h3>
    {!inside ? <><p>{t('和全体在场居民一起去书屋读书、写字、坐一会儿。现有手账、相册和收藏会一起带过去。', 'Visit the bookhouse with everyone present to read, write, or sit a while. Your journal, album, and collections stay with you.')}</p><p>{t('当前场景为开发样板，正式美术仍待完善。', 'This scene is a development preview; final artwork is still in progress.')}</p><button disabled={busy} onClick={() => void r.switchRegion('bookhouse')}>{t('前往 AI 书屋', 'Go to AI Bookhouse')}</button>{!!(w.activeEvent || w.neighborhood.event || w.play.active) && <p>{t('先结束或取消当前活动，再一起出发。', 'Finish or cancel the current activity before traveling.')}</p>}</>
      : <><p>{t('全体在场居民共享这间书屋。家具位置固定，庭院故事、布置和入退住请回小院操作。', 'Everyone present shares this bookhouse. Furniture stays in place; return to the courtyard for stories, arranging, or resident arrivals and departures.')}</p>
        {(tab === 'residents' || tab === 'wishes') && <>
          <label>{t('当前居民', 'Current resident')}<select aria-label={t('当前居民', 'Current resident')} value={w.actor.id} disabled={busy} onChange={e => r.selectCharacter(e.target.value as CharacterId)}>{members.map(a => <option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label>
          <div className="choices"><button disabled={busy || paused} onClick={() => void r.bookhouseActivity('bookcase')}>{t('在书柜选书', 'Read at the bookcase')}</button><button disabled={busy || paused} onClick={() => void r.bookhouseActivity('reading-desk')}>{t('在阅读桌写字', 'Write at the reading desk')}</button><button disabled={busy || paused} onClick={() => void r.bookhouseActivity('window-seat')}>{t('在窗边坐下', 'Sit by the window')}</button></div>
          {!!w.actor.intent && <button disabled={busy} onClick={() => void r.cancelBookhouseActivity()}>{t('结束当前活动', 'Stop current activity')}</button>}
          {paused && <p>{t('小院已暂停，恢复后可以开始读写；暂停期间仍可返回小院。', 'The village is paused. Resume to read or write; you can still return to the courtyard while paused.')}</p>}
        </>}
        <button disabled={busy} onClick={() => void r.switchRegion('courtyard')}>{t('返回小院', 'Return to courtyard')}</button>
        {tab === 'wishes' && <CollectionPanel runtime={r} locale={locale} tab="wishes"/>}
      </>}
  </section>
}
