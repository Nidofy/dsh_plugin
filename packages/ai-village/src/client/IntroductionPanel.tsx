import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { playDefinitions } from '../core/play-catalog.ts'
import { actors } from '../core/world.ts'
import { characterNames } from '../core/roster.ts'

/** Pending introductions are derived from present residents and durable completion facts. */
export function IntroductionPanel({runtime:r, locale, locked}:{runtime:VillageRuntime;locale:Locale;locked:boolean}) {
  const w=r.controller?.world,t=(zh:string,en:string)=>locale==='zh'?zh:en
  if(!w||w.region.active!=='courtyard'||w.play.active)return null
  const members=actors(w),pending=playDefinitions.filter(d=>d.id.startsWith('intro-')&&!w.neighborhood.memories.some(m=>m.id===d.id)&&members.some(a=>d.id===`intro-${a.id}`))
  if(!pending.length)return null
  const busy=locked||r.arranging||!!w.activeEvent||!!w.neighborhood.event||!!w.bookhouse.active||!!r.controller?.pauseReasons.size
  return <section className="village-neighborhood" aria-label={t('初次见面','First meetings')}><h3>{t('初次见面','First meetings')}</h3><p>{t('给新邻居一点认识小院的时间。可以随时取消，之后从这里继续。','Give a new neighbor time to discover the courtyard. Cancel anytime and begin again here.')}</p>{pending.map(d=>{
    const resident=members.find(a=>d.id===`intro-${a.id}`)!
    return <article key={d.id} className="village-journal"><h3>{characterNames[resident.id]} · {d.name[locale]}</h3><p>{d.summary[locale]}</p><button disabled={busy||w.ticks<w.play.nextTick} onClick={()=>void r.startPlay(d.id,[resident.id])}>{t('认识一下','Meet our neighbor')} · {characterNames[resident.id]}</button></article>
  })}</section>
}
