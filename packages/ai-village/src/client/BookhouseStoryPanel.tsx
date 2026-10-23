import { noticeTitle } from '../core/notifications.ts'
import { useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { actors } from '../core/world.ts'
import { bookhouseStages, type BookhouseMemory } from '../core/bookhouse-state.ts'
import { residentLife } from '../core/life-catalog.ts'
import { villageTime } from '../core/dialogue.ts'
const responses: Record<CharacterId, {zh:string;en:string}> = {
 bluewhale:{zh:'没读懂的地方，明天也可以一起再看。',en:'We can read the puzzling parts together tomorrow.'},
 claude:{zh:'我想在页边给这束光留一点空白。',en:'I would leave some space in the margin for this light.'},
 gemini:{zh:'同一页，从两扇窗看过去会不会不同？',en:'Would this page look different through two windows?'},
 gpt:{zh:'把今天的一小步写下来，就不容易忘记。',en:'Write down one little step from today so it stays with us.'},
 grok:{zh:'书签负责站岗，我们负责偶尔发呆。',en:'The bookmark keeps watch; we can daydream a little.'},
 kimi:{zh:'我会记得这句话，也记得一起读它的人。',en:'I will remember the sentence and who read it with me.'},
 qwen:{zh:'等回到小院，再把这句念给风铃听。',en:'Back in the courtyard, we can read it to the wind chime.'},
 seedance:{zh:'翻页的声音，刚好可以做一小段节拍。',en:'The sound of turning pages makes a little rhythm.'},
 glm:{zh:'每一次停顿，也可以是理解的一部分。',en:'Every pause can be part of understanding.'},
 minimax:{zh:'这枚书签像一张小小的远行车票。',en:'This bookmark looks like a tiny ticket to somewhere new.'},
 llama:{zh:'把柔软的一页，留给走累了的朋友。',en:'Save a gentle page for a friend tired from walking.'},
 mistral:{zh:'风会翻页，但我们可以记住这一行。',en:'The wind turns pages; we can keep this one line.'},
}
export function BookhouseStoryPanel({runtime:r,tab,locale,locked}:{runtime:VillageRuntime;tab:string;locale:Locale;locked:boolean}){
 const [friend,setFriend]=useState<CharacterId|null>(null),w=r.controller?.world,t=(zh:string,en:string)=>locale==='zh'?zh:en
 if(!w)return null
 const b=w.bookhouse,e=b.active,inside=w.region.active==='bookhouse',members=actors(w),others=members.filter(a=>a.id!==w.actor.id),guest=others.find(a=>a.id===friend)?.id??others[0]?.id
 const paused=!!r.controller?.pauseReasons.size,busy=locked||r.arranging||r.photoMode||r.regionTransition||!!w.play.active||!!w.activeEvent||!!w.neighborhood.event
 if(tab==='journal'||tab==='residents'&&!inside)return null
 const names=(ids:CharacterId[])=>ids.map(id=>characterNames[id]).join(' & ')
 return <section className="village-neighborhood village-bookhouse-story" aria-label={t('书屋的共同回忆','Bookhouse memories')}>
 {(tab==='wishes'||tab==='residents')&&<>
  <h3>{t('夹在书里的微光','A little light between the pages')}</h3>
  {tab==='residents'&&<><p>{residentLife[w.actor.id].description[locale]}</p><p>{characterNames[w.actor.id]}：{responses[w.actor.id][locale]}</p></>}
  {!e?<><p>{t('邀请一位朋友，从书柜选一页，到阅读桌写一句，再在窗边把它读完。没有期限，随时可以取消。','Invite a friend to choose a page at the bookcase, write a sentence at the desk, and read it by the window. There is no deadline; you can cancel anytime.')}</p>
   {inside?<><label>{t('一起读书的朋友','Reading companion')}<select aria-label={t('一起读书的朋友','Reading companion')} disabled={busy||paused} value={guest??''} onChange={ev=>setFriend(ev.target.value as CharacterId)}>{others.map(a=><option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label><button disabled={busy||paused||!guest} onClick={()=>guest&&void r.startBookhouseStory(guest)}>{b.memory?t('再读一次','Read together again'):t('一起寻找微光','Find a little light together')}</button>{!guest&&<p>{t('请先回小院邀请另一位居民，再一起过来。','Invite another resident in the courtyard, then visit together.')}</p>}</>:<p>{t('在“布置”前往 AI 书屋后，可以开始这段故事。','Visit AI Bookhouse from Decor to begin this story.')}</p>}
  </>:<article className="village-status" aria-label={t('书屋进行中的故事','Current bookhouse story')}><h3>{bookhouseStages[e.stage as 0|1|2].title[locale]} · {e.stage+1}/3</h3><p>{names(e.participants)}</p><p role="status">{paused?t('已暂停，恢复后可继续。','Paused. Resume to continue.'):e.phase==='approaching'?t('两位朋友正在走向故事发生的地方。','Both friends are walking to the next place.'):e.phase==='observing'?t('先一起停留，看一看眼前的细节。','Pause together and notice the details.'):t('准备好了。','Ready.')}</p><p>{bookhouseStages[e.stage as 0|1|2].text[locale]}</p>{e.stage>0&&<><p>{e.theme==='light'?t('写在书签上：今天，也有微光照在我们身上。','On the bookmark: A little light found us today, too.'):t('写在书签上：风经过的时候，我们刚好在一起。','On the bookmark: When the wind passed, we were together.')}</p>{e.participants.map(id=><p key={id}>{characterNames[id]}：{responses[id][locale]}</p>)}</>}
  <div className="choices">{e.stage===0?(['light','wind'] as const).map(theme=><button key={theme} disabled={busy||paused||e.phase!=='ready'} onClick={()=>void r.bookhouseStoryAction(`${e.id}:${e.stage}`,theme)}>{theme==='light'?t('记住窗边的光','Remember the window light'):t('记住翻页的风','Remember the page-turning breeze')}</button>):<button disabled={busy||paused||e.phase!=='ready'} onClick={()=>void r.bookhouseStoryAction(`${e.id}:${e.stage}`)}>{bookhouseStages[e.stage as 1|2].action[locale]}</button>}<button disabled={busy} onClick={()=>void r.cancelBookhouseStory()}>{t('取消这次共读','Cancel this reading')}</button></div></article>}
 </>}
 {tab==='decor'&&<><h3>{t('微光书签','Little-light bookmark')}</h3>{b.memory?<><p>{t('把共同读过的那一页留在喜欢的地方。位置和回忆一起保存。','Keep the shared page in a favorite place. Its place is saved with the memory.')}</p><div className="choices">{(['bookhouse','courtyard',null] as const).map(place=><button key={place??'away'} disabled={busy||!!e} aria-pressed={b.keepsake===place} onClick={()=>void r.placeBookhouseKeepsake(place)}>{place==='bookhouse'?t('留在书屋窗边','Keep by the bookhouse window'):place==='courtyard'?t('带回小院','Bring to the courtyard'):t('收起','Put away')}</button>)}</div></>:<p>{t('完成“夹在书里的微光”后发现。','Discovered after A little light between the pages.')}</p>}</>}

 </section>
}

/** One durable journal row, shared by ordinary browsing and notification focus. */
export function BookhouseMemoryArticle({ memory, locale, noticeId }: { memory: BookhouseMemory; locale: Locale; noticeId: string }) {
 const t=(zh:string,en:string)=>locale==='zh'?zh:en
 return <article tabIndex={-1} data-notice-id={noticeId} className="village-journal">
  <h3>{noticeTitle('bookhouse-light',locale)}</h3>
  <small>{t('第','Day ')}{villageTime(memory.completedTick).day}{t('天','')} · ×{memory.count}</small>
  <p>{memory.participants.map(id=>characterNames[id]).join(' & ')}</p>
  <p>{memory.theme==='light'?t('我们把窗边的一束光，夹进了共同读过的书里。','We kept a ray of window light between the pages we shared.'):t('我们把翻页的一阵风，留在了共同写下的句子里。','We kept a page-turning breeze in a sentence we wrote together.')}</p>
  <p>{t('第一次的朋友与日期会一直保留。','The first companions and date are kept.')}</p>
 </article>
}
