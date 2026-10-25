import { useEffect, useState } from 'react'
import type { CommunityArt } from './community-art.ts'
import { communityPlaces, communityPlace, communityConnections, travelMessage, type CommunityPlaceId } from '../core/community-map.ts'
import type { VillageRuntime } from './runtime.ts'
import { PanelShell } from './PanelShell.tsx'
import { VillageIcon } from './Icon.tsx'

/** Selection, previews and the map itself are presentation state, never a world command. */
export function CommunityMap({ runtime:r, cn }: { runtime:VillageRuntime; cn:boolean }) {
  const locale=cn?'zh':'en', t=(zh:string,en:string)=>cn?zh:en
  const current=r.controller?.world.region.active ?? 'courtyard'
  const [selected,setSelected]=useState<CommunityPlaceId>(current)
  const [attempted,setAttempted]=useState(false)
  const [art,setArt]=useState<CommunityArt|null>(null),[artState,setArtState]=useState<'loading'|'ready'|'fallback'>('loading')
  useEffect(()=>{
    const controller=new AbortController();let loaded:CommunityArt|undefined
    void r.communityArt(controller.signal).then(value=>{if(controller.signal.aborted){value.dispose();return}loaded=value;setArt(value);setArtState('ready')}).catch(()=>{if(!controller.signal.aborted)setArtState('fallback')})
    return()=>{controller.abort();loaded?.dispose()}
  },[r])
  const place=communityPlace(selected)!, issue=r.regionTravelIssue(selected)
  const choose=(id:CommunityPlaceId)=>{setSelected(id);setAttempted(false)}
  const status=(id:CommunityPlaceId)=>id===current?t('当前所在地','You are here'):communityPlace(id)?.status==='planned'?t('规划中','Planned'):t('已开放','Open')
  const travel=async()=>{setAttempted(true);if(place.scene)await r.switchRegion(place.scene.id)}
  return <PanelShell runtime={r} cn={cn} title={t('社区地图','Community map')} className="village-community-map">
    <p className="village-map-intro">{t('挑一个地方，和伙伴们一起去走走。','Choose a place to visit with your neighbors.')}</p>
    <div className="village-map-overview" data-art={artState} role="group" aria-label={t('社区地点概览','Community overview')}>
      {art&&<img className="village-map-terrain" data-map-layer="terrain" src={art.urls['map/terrain.png']} alt=""/>}
      <svg viewBox="0 0 1000 750" preserveAspectRatio="none" aria-hidden="true" className="village-map-roads">
        {communityConnections.map(([a,b])=>{const start=communityPlace(a)!,end=communityPlace(b)!,open=start.status==='available'&&end.status==='available';const path=`M ${start.map.x*10} ${start.map.y*7.5} Q ${(start.map.x+end.map.x)*5} ${start.map.y*7.5} ${end.map.x*10} ${end.map.y*7.5}`;return <g key={a+b} data-open={open}><path className="village-map-road-edge" d={path}/><path d={path}/></g>})}
      </svg>
      {art&&communityPlaces.map(node=><img key={node.id} className="village-map-landmark" data-map-layer={node.id} src={art.urls[`map/${node.id}.png`]} style={{left:`${node.map.x}%`,top:`${node.map.y}%`}} alt=""/>)}
      {communityPlaces.map(node=><button key={node.id} type="button" className="village-map-node" data-place={node.id} data-current={node.id===current} data-planned={node.status==='planned'} aria-label={`${node.name[locale]} · ${status(node.id)}`} aria-pressed={selected===node.id} style={{left:`${node.map.x}%`,top:`${node.map.y}%`}} onClick={()=>choose(node.id)}><VillageIcon name={node.icon}/><span>{node.name[locale]}</span>{node.id===current&&<b aria-hidden="true">●</b>}</button>)}
    </div>
    <p className="village-map-caption">{artState==='ready'?t('实线为已开放路线，虚线为规划路线','Solid routes are open; dashed routes are planned'):artState==='loading'?t('正在展开地图…','Unfolding the map…'):t('地图插画暂不可用，已显示导航示意。','Map illustration unavailable. Showing the navigation sketch.')}</p>
    <div className="village-map-places" role="group" aria-label={t('选择地点','Choose a place')}>
      {communityPlaces.map(node=><button key={node.id} data-place={node.id} aria-pressed={selected===node.id} onClick={()=>choose(node.id)}><VillageIcon name={node.icon}/><span>{node.name[locale]}</span><small>{status(node.id)}</small></button>)}
    </div>
    <section className="village-map-preview" aria-label={t('地点预览','Place preview')} aria-live="polite">
      <h3>{place.name[locale]}</h3><p>{place.description[locale]}</p>
      {place.art.status==='development-preview'&&<p>{t('书屋场景为开发样板；正式绘本美术仍待签收。','The bookhouse scene is a development preview; final illustrated art awaits review.')}</p>}
      {issue?<p role="status">{travelMessage(issue,locale)}</p>:<p>{t('全体在场居民一起出发，保留当前暂停状态。','Everyone present travels together. Your pause setting is kept.')}</p>}
      <button className="village-map-travel" disabled={!!issue} onClick={()=>void travel()}>{t(`前往 ${place.name.zh}`,`Go to ${place.name.en}`)}</button>
      {attempted&&r.actionError&&<p role="alert">{travelMessage(r.actionError,locale)}</p>}
    </section>
  </PanelShell>
}

export const communityMapCSS = `
.village-community-map{z-index:55;inset:56px var(--gutter) 16px;max-height:calc(100% - 72px);background:var(--solid)}
.village-map-intro{margin:4px 0 10px}.village-map-overview{position:relative;height:180px;border:1px solid var(--line);border-radius:14px;background:var(--soft);isolation:isolate}
.village-card .village-map-roads{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}.village-map-roads path{fill:none;stroke:#f0dfb9;stroke-width:10;stroke-linecap:round}.village-map-roads path.village-map-road-edge{stroke:#a8946c;stroke-width:15}.village-map-roads g[data-open=false]{stroke-dasharray:18 15}
.village-map-overview[data-art=ready]{height:auto!important;aspect-ratio:4/3;max-width:900px;margin-inline:auto;background:#d5dabc}.village-map-terrain{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;border-radius:14px}.village-map-landmark{position:absolute;transform:translate(-50%,-50%);width:22%;height:27%;object-fit:contain;pointer-events:none}
.village-card .village-map-node{position:absolute;transform:translate(-50%,-50%);width:44px;min-width:44px;min-height:44px;padding:6px;border:1px solid var(--line);background:var(--solid);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-direction:column;color:var(--ink)}
.village-map-node>span{display:none}.village-map-node>b{position:absolute;right:-4px;top:-8px;color:var(--accent);font-size:14px}.village-map-node[data-planned=true]{border-style:dashed}.village-card .village-map-node[aria-pressed=true],.village-card .village-map-places button[aria-pressed=true]{outline:2px solid var(--accent);outline-offset:2px}
.village-map-caption{font-size:max(12px,.85em);color:var(--muted);margin:8px 0 12px}.village-map-places{display:grid;gap:8px}.village-card .village-map-places button{display:flex;align-items:center;gap:8px;text-align:left;min-height:44px;width:100%;padding:8px}.village-map-places button>span{flex:1}.village-map-places small{color:var(--muted);font-size:max(12px,.85em)}
.village-map-preview{border-top:1px solid var(--line);margin-top:14px;padding:4px 2px 8px}.village-map-preview h3{margin:12px 0 6px}.village-map-travel{width:100%;min-height:44px}
.village-card[data-entrance-wide=true] .village-map-overview{height:320px}.village-card[data-entrance-wide=true] .village-map-node{width:120px;min-height:64px;gap:4px}.village-card[data-entrance-wide=true] .village-map-node>span{display:block;font-size:max(12px,.9em)}.village-card[data-entrance-wide=true] .village-map-places{grid-template-columns:1fr 1fr}
.village-card .village-map-overview[data-art=ready] .village-map-node{width:20%;height:24%;min-height:0;min-width:0;border:0;background:transparent;border-radius:20px;justify-content:end;padding:0;box-shadow:none}.village-map-overview[data-art=ready] .village-map-node>svg{display:none}.village-map-overview[data-art=ready] .village-map-node>span{background:var(--solid);border:1px solid var(--line);border-radius:12px;padding:3px 8px;max-width:150%;color:var(--ink)}.village-map-overview[data-art=ready] .village-map-node>b{right:20%;top:4%;text-shadow:0 0 3px var(--solid)}
.village-card:not([data-entrance-wide=true]) .village-map-overview[data-art=ready] .village-map-node{min-height:44px;min-width:44px}
`
