import { useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { actors } from '../core/world.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { teaSquareLine, teaSquareOrder, teaSquareStages, teaSquareToken, type TeaSquareMemory } from '../core/tea-square-state.ts'

export function TeaSquarePanel({runtime:r,tab,locale,locked}:{runtime:VillageRuntime;tab:string;locale:Locale;locked:boolean}) {
  const [chosen,setChosen]=useState<CharacterId[]>([]),[item,setItem]=useState<number|null>(null)
  const w=r.controller?.world,t=(zh:string,en:string)=>locale==='zh'?zh:en
  if(!w||w.region.active!=='tea-square'||tab==='journal')return null
  const s=w.teaSquare,e=s.active,members=actors(w),guests:CharacterId[]=[]
  for(let i=0;i<3;i++){const id=members.find(a=>a.id===chosen[i]&&!guests.includes(a.id))?.id??members.find(a=>!guests.includes(a.id))?.id;if(id)guests.push(id)}
  const paused=!!r.controller?.pauseReasons.size,busy=locked||r.arranging||r.photoMode||r.regionTransition||!!r.controller?.drag
  const shapes=[t('云','Cloud'),t('叶','Leaf'),t('星','Star')],ready=!busy&&!paused&&e?.phase==='ready'
  const selectGuest=(index:number,id:CharacterId)=>setChosen(guests.map((old,i)=>i===index?id:old))
  return <section className="village-neighborhood village-tea-square" data-stage={e?.stage??'idle'} aria-label={t('AI 茶会广场','AI Tea Square')}>
    <h3>{t('AI 茶会广场','AI Tea Square')}</h3>
    {(tab==='residents'||tab==='wishes')&&<>
      <p>{t('三位朋友，一张茶桌，一段可以慢慢完成的下午。','Three friends, one tea table, and an afternoon to take at your own pace.')}</p>
      {tab==='residents'&&<>
        <label>{t('当前居民','Current resident')}<select aria-label={t('当前居民','Current resident')} disabled={busy||!!e||!!s.activity} value={w.actor.id} onChange={ev=>r.selectCharacter(ev.target.value as CharacterId)}>{members.map(a=><option key={a.id} value={a.id}>{characterNames[a.id]}</option>)}</select></label>
        <p>{characterNames[w.actor.id]}：{teaSquareLine(w.actor.id,locale)}</p>
        {!s.activity?<button disabled={busy||paused||!!e} onClick={()=>void r.startTeaSquareActivity()}>{t('选一杯茶，坐一会儿','Choose a tea and sit a while')}</button>:<article aria-label={t('选茶活动','Tea activity')}><p role="status">{characterNames[s.activity.actorId]} · {(['counter','choosing'].includes(s.activity.stage)?t('正在茶柜选茶','Choosing tea at the counter'):t('带着茶到桌边坐一会儿','Taking tea to the table'))}</p><button disabled={busy} onClick={()=>void r.cancelTeaSquareActivity()}>{t('结束选茶','Stop tea activity')}</button></article>}
      </>}
      {!e?<>
        <h4>{t('三杯不同的下午','Three cups, one afternoon')}</h4>
        {guests.map((id,i)=><label key={i}>{[t('茶会伙伴一','Tea companion one'),t('茶会伙伴二','Tea companion two'),t('茶会伙伴三','Tea companion three')][i]}<select aria-label={[t('茶会伙伴一','Tea companion one'),t('茶会伙伴二','Tea companion two'),t('茶会伙伴三','Tea companion three')][i]} value={id} disabled={busy||paused||!!s.activity} onChange={ev=>selectGuest(i,ev.target.value as CharacterId)}>{members.map(a=><option key={a.id} value={a.id} disabled={guests.some((g,j)=>j!==i&&g===a.id)}>{characterNames[a.id]}</option>)}</select></label>)}
        {guests.length<3&&<p>{t('请回小院邀请至少三位居民，再一起过来。','Invite at least three residents in the courtyard, then visit together.')}</p>}
        <button disabled={busy||paused||!!s.activity||guests.length!==3} onClick={()=>{setItem(null);void r.startTeaSquareStory(guests)}}>{s.memory?t('再来一次茶会','Share tea again'):t('开始茶会','Start tea gathering')}</button>
      </>:<article className="village-status" aria-label={t('进行中的茶会','Current tea gathering')}>
        <h4>{teaSquareStages[e.stage].title[locale]} · {e.stage+1}/3</h4>
        <p>{e.participants.map(id=>characterNames[id]).join(' · ')}</p>
        <p role="status">{paused?t('已暂停，恢复后可继续。','Paused. Resume to continue.'):e.phase==='approaching'?t('朋友们正在沿小路走向下一处。','Friends are walking along the path.'):e.phase==='observing'?t('先停一停，听完大家的话。','Pause and hear everyone out.'):t('准备好了。','Ready.')}</p>
        <p>{teaSquareStages[e.stage].text[locale]}</p>
        {e.stage===0&&e.participants.map(id=><p key={id}>{characterNames[id]}：{teaSquareLine(id,locale)}</p>)}
        {e.stage===1&&<>
          <p data-coaster-hint>{t('桌边的线索，从左到右：','The hint, from left to right: ')}{teaSquareOrder(e.seed).map(n=>shapes[n]).join(' → ')}</p>
          <div className="choices" role="group" aria-label={t('杯垫图案','Coaster shapes')}>{shapes.map((name,i)=><button key={i} disabled={!ready} aria-pressed={item===i} onClick={()=>setItem(i)}>{name}</button>)}</div>
          <div className="choices" role="group" aria-label={t('杯垫位置','Coaster places')}>{e.board.map((shape,i)=><button key={i} disabled={!ready||item===null} onClick={()=>{void r.actTeaSquareStory(teaSquareToken(e),'place',`${item}:${i}`);setItem(null)}}>{i+1} · {shape<0?t('空','Empty'):shapes[shape]}</button>)}</div>
          {e.board.every(n=>n>=0)&&<p role="status">{t('还没有排成线索里的顺序，可以换个位置试试。','The order does not match yet. Try another place.')}</p>}
          <button disabled={!ready} onClick={()=>{setItem(null);void r.actTeaSquareStory(teaSquareToken(e),'reset')}}>{t('重排杯垫','Reset coasters')}</button>
        </>}
        {e.stage!==1&&<button disabled={!ready} onClick={()=>void r.actTeaSquareStory(teaSquareToken(e),e.stage===0?'continue':'remember')}>{e.stage===0?t('一起摆好杯垫','Arrange the coasters together'):t('记住这个下午','Remember this afternoon')}</button>}
        <button disabled={busy} onClick={()=>{setItem(null);void r.cancelTeaSquareStory()}}>{t('取消茶会','Cancel tea gathering')}</button>
      </article>}
      {paused&&<p>{t('暂停期间可取消活动，恢复后再继续。','You can cancel while paused; resume to continue.')}</p>}
    </>}
    {tab==='decor'&&<><h4>{t('三叶茶签','Three-leaf tea tag')}</h4>{s.memory?<><p>{t('把这个下午留在留言树上。第一次的朋友和日期会一直保留。','Keep this afternoon on the message tree. The first friends and date stay with the memory.')}</p><div className="choices"><button aria-pressed={s.keepsake==='message-tree'} disabled={busy||!!e} onClick={()=>void r.placeTeaSquareKeepsake('message-tree')}>{t('挂在留言树上','Hang on the message tree')}</button><button aria-pressed={s.keepsake===null} disabled={busy||!!e} onClick={()=>void r.placeTeaSquareKeepsake(null)}>{t('收起茶签','Put the tag away')}</button></div></>:<p>{t('第一次完成茶会后留下，重玩会累积回忆次数。','Complete a tea gathering to discover it. Replays add to the memory count.')}</p>}</>}
    <button disabled={busy||!!e} onClick={()=>r.present({type:'overlay',overlay:'map'})}>{t('打开社区地图','Open community map')}</button>
  </section>
}

export function TeaSquareMemoryArticle({memory,locale,noticeId}:{memory:TeaSquareMemory;locale:Locale;noticeId:string}) {
  const t=(zh:string,en:string)=>locale==='zh'?zh:en
  return <article tabIndex={-1} data-notice-id={noticeId} className="village-journal"><small>{t('第','Day ')}{memory.day}{t('天','')} · ×{memory.count}</small><h3>{t('三杯不同的下午','Three cups, one afternoon')}</h3><p>{memory.participants.map(id=>characterNames[id]).join(' · ')}</p><p>{t('三张杯垫排成了这个下午的句子，我们把三叶茶签留在树上。','Three coasters told the story of our afternoon. We left a three-leaf tea tag on the tree.')}</p><p>{t('第一次的朋友与日期会一直保留。','The first companions and date are kept.')}</p></article>
}
