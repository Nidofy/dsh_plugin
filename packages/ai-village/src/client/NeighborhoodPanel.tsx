import { playDefinition, playDefinitions } from '../core/play-catalog.ts'
import { useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { actors } from '../core/world.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { neighborhoodEvents, residentLine, wishes, stories, layouts, layoutNames, furnitureCatalog, decorationNames, type Locale, type LayoutId } from '../core/neighborhood-catalog.ts'
import { extraUnlocked } from '../core/neighborhood-state.ts'
import { villageTime } from '../core/dialogue.ts'
export function NeighborhoodPanel({ runtime, tab, locale, locked }: { runtime: VillageRuntime; tab: string; locale: Locale; locked: boolean }) {
  const world = runtime.controller?.world, n = world?.neighborhood, cn = locale === 'zh', t = (zh: string, en: string) => cn ? zh : en
  const [guest, setGuest] = useState<CharacterId>('claude'), [layoutDraft, setLayoutDraft] = useState<LayoutId | null>(null)
  const decorDraft = runtime.extraDecorationDraft, setDecorDraft = (value: typeof decorDraft) => runtime.previewExtraDecoration(value)
  if (!world || !n) return null
  const members = actors(world), selected = world.actor.id, other = members.find(a => a.id === guest && a.id !== selected)?.id ?? members.find(a => a.id !== selected)?.id
  const busy = locked || runtime.arranging || !!world.activeEvent || !!n.event, definition = neighborhoodEvents.find(d => d.id === n.event?.definitionId)
  const sceneMissing = (id: string, furniture: string) => (furniture === 'books' || id === 'shared-book') && n.layout !== 'reading' || (furniture === 'plant' || id === 'plant-care') && n.layout !== 'garden'
  return <div className="village-neighborhood" onKeyDown={e=>{if(!locked&&e.key==='Escape'&&!e.nativeEvent.isComposing&&(layoutDraft||decorDraft)){setLayoutDraft(null);setDecorDraft(null);e.preventDefault();e.stopPropagation()}}}>
    {tab === 'residents' && <><h3>{t('邻里的小日常', 'Little neighborhood moments')}</h3><p>{residentLine(selected, 0, Math.floor(world.ticks / 300), locale)}</p>
      <div className="choices">{neighborhoodEvents.filter(d=>d.count===1).map(d=><button key={d.id} disabled={busy || world.ticks<n.nextInteractionTick || sceneMissing(d.id,d.furniture)} onClick={()=>void runtime.interact(d.id,[selected])}>{d.name[locale]}</button>)}</div>
      <p>{t('读书在阅读角落，浇水在花草角落；可在布置页切换。', 'Reading needs the reading corner; watering needs the garden corner. Change layouts in Decor.')}</p>
      <h3>{t('共同经历', 'Shared memories')}</h3>{n.bonds.length ? n.bonds.map(b=><p key={b.pair.join('/')}>
        {b.pair.map(id=>characterNames[id]).join(' & ')} · {b.count>=3?t('熟悉','Familiar'):b.count>=2?t('一起活动','Companions'):t('初次相聚','First gathering')} · ×{b.count}</p>) : <p>{t('一起完成活动，慢慢认识彼此。离开不会让关系下降。','Get to know each other through shared activities. Time away never reduces a bond.')}</p>}
    </>}
    {tab === 'wishes' && <><h3>{t('还有这些小心愿', 'More little wishes')}</h3>{wishes.map(w=><p key={w.id}>{n.memories.some(m=>m.id===w.story)?'✓ ':'○ '}{w.title[locale]}</p>)}
      <label>{t('一起活动的朋友','A friend to join')}<select aria-label={t('一起活动的朋友','A friend to join')} value={other??''} disabled={busy} onChange={e=>setGuest(e.target.value as CharacterId)}>{members.filter(a=>a.id!==selected).map(a=><option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label>
      <div className="choices">{neighborhoodEvents.filter(d=>d.count===2).map(d=><button key={d.id} disabled={busy || !other || world.ticks<n.nextInteractionTick || sceneMissing(d.id,d.furniture)} onClick={()=>other&&void runtime.interact(d.id,[selected,other])}>{d.name[locale]}</button>)}</div>
      <p>{t('分享书页需要阅读布局；聊花草需要花草布局。', 'Share a page in the reading layout; talk about plants in the garden layout.')}</p>
    </>}
    {(tab==='wishes'||tab==='residents') && definition && n.event && <div className="village-status" role="status"><strong>{definition.name[locale]} · {n.event.phase==='approaching'?t('正在前往','On their way'):t('正在一起度过','A moment together')}</strong>
      {n.event.participants.map((id,i)=><p key={id}>{characterNames[id]}：{residentLine(id,definition.count===2?4:['listen','sky'].includes(definition.id)?5:2,i,locale)}</p>)}
      <button disabled={locked} onClick={()=>void runtime.cancelEvent()}>{t('取消这次活动','Cancel this activity')}</button></div>}
    {tab==='decor' && <><h3>{t('小院布局','Courtyard layout')}</h3><p>{t('四类家具、六个活动位。切换角落会结束被替换家具上的普通活动；剧情中不能切换。','Four furniture types and six activity seats. Changing corners ends activities on the replaced furniture. Finish or cancel a story first.')}</p>
      <div className="choices">{layouts.map(id=><button key={id} disabled={busy} aria-pressed={(layoutDraft??n.layout)===id} onClick={()=>setLayoutDraft(id)}>{layoutNames[id][locale]}</button>)}</div>
      {layoutDraft && <div role="status"><p>{layoutNames[layoutDraft][locale]} · {furnitureCatalog.filter(f=>['work','eat','bench',layoutDraft==='reading'?'books':layoutDraft==='garden'?'plant':'rest'].includes(f.id)).map(f=>f.name[locale]).join(' / ')}</p>
        <button disabled={busy} onClick={()=>void runtime.chooseLayout(layoutDraft).then(()=>{if(!runtime.actionError)setLayoutDraft(null)})}>{t('确认布局','Confirm layout')}</button><button onClick={()=>setLayoutDraft(null)}>{t('取消布局','Cancel layout')}</button></div>}
      <details><summary>{t('六类家具目录','Furniture catalog')}</summary>{furnitureCatalog.map(f=><p key={f.id}>{f.name[locale]}</p>)}</details>
      <h3>{t('新的小装饰','More little decorations')}</h3>{(['lantern','planter'] as const).map(id=><div key={id}><strong>{decorationNames[id][locale]}</strong>
        {extraUnlocked(n,id)?<button disabled={locked || runtime.arranging} onClick={()=>setDecorDraft({id,slot:n.decorations[id]})}>{t('调整位置','Choose a place')}</button>:<p>{id==='lantern'?t('分享一页书后发现。','Discovered by sharing a page.'):t('照料盆栽后发现。','Discovered by watering a plant.')}</p>}</div>)}
      {decorDraft && <div className="choices">{(['window','door','wall',null] as const).map(slot=><button disabled={locked} key={slot??'away'} aria-pressed={decorDraft.slot===slot} onClick={()=>setDecorDraft({...decorDraft,slot})}>{slot===null?t('收起','Put away'):slot==='window'?t('窗边','Window'):slot==='door'?t('门旁','Door'):t('院墙','Wall')}</button>)}
        <button disabled={locked} onClick={()=>void runtime.decorateExtra(decorDraft.id,decorDraft.slot).then(()=>{if(!runtime.actionError)setDecorDraft(null)})}>{t('保存装饰','Save decoration')}</button><button disabled={locked} onClick={()=>setDecorDraft(null)}>{t('取消','Cancel')}</button></div>}
    </>}
    {tab==='journal' && <>{[...n.memories].reverse().map(m=><article className="village-journal" key={m.id}><small>{t('小院第 ','Day ')}{villageTime(m.completedTick).day}{cn?' 天':''} · ×{m.count}</small><h3>{(stories.find(s=>s.id===m.id)?.name[locale] ?? playDefinition(m.id)?.name[locale])}</h3><p>{m.participants.map(id=>characterNames[id]).join(' & ')}</p><p>{t('这是第一次发生时留下的回忆，再次体验只累计次数。','This keeps the first moment. Later visits add to the count.')}</p></article>)}<p>{t('已发现的手账','Discovered memories')}：{world.journal.length+n.memories.length}/{stories.length+playDefinitions.length+1}</p></>}
    {runtime.actionError && <p role="alert">{runtime.actionError==='INTERACTION_COOLDOWN'?t('让这句话停留一会儿，再开始下一件小事。','Let the moment settle before the next activity.'):runtime.actionError==='LAYOUT_REQUIRED'?t('请先在布置中选择相应布局。','Choose the matching layout in Decor first.'):t('暂时无法开始。请结束当前活动，或挪开座位和路线旁的居民。','Cannot start yet. Finish the current activity, or clear the seats and path.')}<small>{residentLine(selected,3,Math.floor(world.ticks/90),locale)}</small></p>}
  </div>
}
