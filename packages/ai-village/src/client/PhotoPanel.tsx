import { useEffect, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import type { Photo } from '../core/photo.ts'
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function AlbumImage({runtime,photo,locale}:{runtime:VillageRuntime;photo:Photo;locale:'zh'|'en'}){
 const[url,setUrl]=useState(''),[failed,setFailed]=useState(false)
 useEffect(()=>{let active=true,url='';void runtime.album.image(photo).then(blob=>{if(active){url=URL.createObjectURL(blob);setUrl(url)}}).catch(()=>{if(active)setFailed(true)});return()=>{active=false;if(url)URL.revokeObjectURL(url)}},[runtime,photo.id,photo.hash])
 return url?<img loading="lazy" src={url} alt={photo.title} style={{width:'100%',maxHeight:180,objectFit:'contain'}}/>:failed?<span>{locale==='zh'?'照片暂时不可用':'Photo unavailable'}</span>:null
}
export function PhotoPanel({runtime,locale,albumOnly=false}:{runtime:VillageRuntime;locale:'zh'|'en';albumOnly?:boolean}){
 const cn=locale==='zh',t=(zh:string,en:string)=>cn?zh:en,album=runtime.album
 const[title,setTitle]=useState(''),[bytes,setBytes]=useState<ArrayBuffer|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState<string|null>(null)
 useEffect(()=>{void album.refresh().catch(()=>setError(t('相册暂时不可用。','Album unavailable.')))},[album])
 useEffect(()=>{if(!bytes){setPreview('');return}const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));setPreview(url);return()=>URL.revokeObjectURL(url)},[bytes])
 const act=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch{setError(t('照片操作未完成，请保留当前画面并重试读取。','The photo operation did not finish. Keep this view and check again.'))}finally{setBusy(false)}}
 const locked=busy||album.busy||!!album.pending
 return <section className={albumOnly?'village-album':'village-photo-controls'} aria-label={t('小院相册','Courtyard album')}>
 {!albumOnly&&<><h3>{t('留住这一刻','Keep this moment')}</h3><p>{t('拍照期间小院暂停。退出后保留原来的暂停设置。','The courtyard pauses for the photo. Your earlier pause setting is preserved.')}</p>
   <label>{t('取景缩放','Zoom')}<input aria-label={t('取景缩放','Photo zoom')} type="range" min="1" max="1.5" step="0.05" value={runtime.photoOptions.zoom} onChange={e=>{setBytes(null);runtime.setPhotoOptions({zoom:Number(e.target.value)})}}/></label>
   {(['x','y']as const).map(axis=><label key={axis}>{axis==='x'?t('左右取景','Horizontal crop'):t('上下取景','Vertical crop')}<input type="range" min="-1" max="1" step="0.1" value={runtime.photoOptions[axis]} onChange={e=>{setBytes(null);runtime.setPhotoOptions({[axis]:Number(e.target.value)})}}/></label>)}
   <div className="choices"><label><input type="checkbox" checked={runtime.photoOptions.date} onChange={e=>{setBytes(null);runtime.setPhotoOptions({date:e.target.checked})}}/>{t('日期','Date')}</label><label><input type="checkbox" checked={runtime.photoOptions.border} onChange={e=>{setBytes(null);runtime.setPhotoOptions({border:e.target.checked})}}/>{t('边框','Border')}</label></div>
   <button disabled={locked} onClick={()=>{setBytes(null);runtime.setPhotoOptions({zoom:1,x:0,y:0})}}>{t('重置取景','Reset crop')}</button>
   <button disabled={locked||!runtime.frameReady} onClick={()=>void act(async()=>setBytes(await runtime.capturePhoto()))}>{t('拍摄照片','Take photo')}</button>
   <button disabled={busy||album.busy} onClick={()=>runtime.exitPhoto()}>{t('退出拍照','Exit photo mode')}</button>
   {preview&&bytes&&<><img src={preview} alt={t('照片预览','Photo preview')} style={{width:'100%',maxHeight:200,objectFit:'contain'}}/><label>{t('照片标题','Photo title')}<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <button disabled={locked} onClick={()=>void act(async()=>{await album.add(bytes,title||t('小院的一刻','A courtyard moment'),runtime.controller!.world.ticks);if(!album.error&&!album.pending)setBytes(null)})}>{t('保存到相册','Save to album')}</button>
    <button onClick={()=>download(new Blob([bytes],{type:'image/png'}),'ai-village-postcard.png')}>{t('导出 PNG','Export PNG')}</button></>}
 </>}
 {albumOnly&&<><h3>{t('本地相册','Local album')} · {album.state?.world.photos.length??0}/20</h3><p>{t('最多 20 张、共 40 MiB。删除照片不会删除手账或解锁。','Up to 20 photos and 40 MiB. Deleting a photo keeps memories and unlocks.')}</p>
  {(album.state?.world.photos??[]).map(photo=><article className="village-journal" key={photo.id}><AlbumImage runtime={runtime} photo={photo} locale={locale}/ ><p>{photo.title}</p>
    <button disabled={locked} onClick={()=>void act(async()=>download(await album.image(photo),'ai-village-'+photo.id+'.png'))}>{t('导出','Export')}</button>
    {deleting===photo.id?<><button disabled={locked} onClick={()=>void act(async()=>{await album.remove(photo.id);setDeleting(null)})}>{t('确认删除照片','Confirm photo deletion')}</button><button onClick={()=>setDeleting(null)}>{t('取消','Cancel')}</button></>:<button disabled={locked} onClick={()=>setDeleting(photo.id)}>{t('删除照片','Delete photo')}</button>}
  </article>)}</>}
 {(error||album.error)&&<p role="alert">{error||t('相册结果需要核对；不会自动重复保存。','The album result needs checking; the write will not be repeated automatically.')}<button disabled={album.busy} onClick={()=>void act(()=>album.refresh())}>{t('重新读取相册','Check album again')}</button></p>}
 </section>
}
