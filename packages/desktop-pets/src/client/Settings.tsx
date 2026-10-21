import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, Input, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PetSettings } from '@nidofy/dsh-plugin-shared/state'
import type { PetStore } from './store.ts'
import { desktopPetsBridge } from './native.ts'
export const settingsCss = `
.nidofy-pet-settings{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font:inherit}
.nidofy-pet-settings .pet-row{display:flex;align-items:center;justify-content:space-between;gap:20px}
.nidofy-pet-settings .pet-group{display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--dsw-alias-border-l2,#8883);padding-top:16px}
.nidofy-pet-settings p{margin:4px 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6}
.nidofy-pet-settings select,.nidofy-pet-settings textarea{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2,#8884);border-radius:8px;padding:8px;max-width:100%}
.nidofy-pet-settings .pet-actions{display:flex;gap:8px;flex-wrap:wrap}.nidofy-pet-settings label{display:grid;gap:6px}
.nidofy-pet-settings [role=alert]{color:var(--dsw-alias-status-error,#d34b59);overflow-wrap:anywhere}
`
export function PetSettingsPage({ store, zh }: { store: PetStore; zh: boolean }) {
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  const [id, setId] = useState('1'), [resources, setResources] = useState<{id:string;displayName:string}[]>([])
  const [path, setPath] = useState(''), [destination, setDestination] = useState(''), [replace, setReplace] = useState(false)
  const [preview, setPreview] = useState<{ digest: string; preview: string; id: string } | null>(null)
  const [working, setWorking] = useState(false), [message, setMessage] = useState('')
  const [templates, setTemplates] = useState(''), [deleteId, setDeleteId] = useState<string | null>(null)
  const words = (cn: string, en: string) => zh ? cn : en
  const loadResources = () => store.request<{items: typeof resources}>('pet/packages', { action: 'list' }).then(data => setResources(data.items))
  useEffect(() => { let alive = true; void store.request<{items: typeof resources}>('pet/packages', { action: 'list' }).then(data => { if (alive) setResources(data.items) }).catch(error => { if (alive) setMessage(String(error)) }); return () => { alive = false } }, [store])
  const p = state.preferences, pets = p ? [p.pet, ...p.companions] : [], selected = pets.find(pet => pet.id === id) ?? pets[0]
  useEffect(()=>{setTemplates(JSON.stringify(selected?.bubble.templates ?? {},null,2));setDeleteId(null)},[selected?.id])
  const disabled = state.busy || working || !p
  const edit = (change: Partial<PetSettings>) => void store.save(next => { const pet = [next.pet,...next.companions].find(pet => pet.id === selected?.id); if (pet) Object.assign(pet,change) })
  const operation = async (run: () => Promise<unknown>) => {
    setWorking(true); setMessage('')
    try { await run(); await loadResources(); setMessage(words('已完成','Done')) }
    catch(error) { setMessage(String(error)) } finally { setWorking(false) }
  }
  const row = (label: string, checked: boolean, onChange: (value:boolean)=>void) => <div className="pet-row"><span>{label}</span><Switch label={label} checked={checked} disabled={disabled} onChange={onChange}/></div>
  return <div className="nidofy-pet-settings"><style>{settingsCss}</style>
    {row(words('显示桌宠','Show pets'), !!p?.pets, enabled => void store.save(next => { next.pets=enabled; if (enabled && ![next.pet,...next.companions].some(pet=>pet.enabled)) next.pet.enabled=true }))}
    <p>{words('开启后，桌宠显示为独立桌面悬浮窗，可拖动到屏幕上的其他位置。关闭后关闭所有桌宠窗口并暂停状态观察。','Show pets in independent floating desktop windows. Drag a pet to reposition it. Turning off closes all pet windows and pauses session observation.')}</p>
    {!desktopPetsBridge() && <p role="status">{words('当前客户端尚未接入独立桌宠窗口。设置会保留，请使用配套的 Desktop 桌宠适配载体。','This client does not provide native pet windows. Your settings are saved; use the accompanying Desktop pet carrier.')}</p>}
    {state.error && <div role="alert">{state.error}<Button onClick={()=>void store.refresh()}>{words('重试','Retry')}</Button></div>}
    {selected && <>
      <div className="pet-group">
        <label>{words('桌宠实例','Pet instance')}<select value={selected.id} onChange={event=>setId(event.target.value)}>{pets.map(pet=><option key={pet.id} value={pet.id}>{resources.find(r=>r.id===pet.resource)?.displayName ?? pet.resource} · {pet.id}</option>)}</select></label>
        <div className="pet-actions"><Button disabled={disabled || pets.length>=3} onClick={()=>void store.save(next=>{const id=crypto.randomUUID().slice(0,8); next.companions.push({...structuredClone(next.pet),id,enabled:true,position:null,pinned:null,affinity:0,lastInteractionMs:0});setId(id)})}>{words('添加桌宠','Add pet')}</Button>
        <Button disabled={disabled || selected.id==='1'} onClick={()=>void store.save(next=>{next.companions=next.companions.filter(pet=>pet.id!==selected.id);setId('1')})}>{words('移除此实例','Remove instance')}</Button></div>
        {row(words('显示此桌宠','Show this pet'),selected.enabled,value=>edit({enabled:value}))}
        <label>{words('形象','Appearance')}<select disabled={disabled} value={selected.resource} onChange={event=>edit({resource:event.target.value})}>{resources.map(resource=><option key={resource.id} value={resource.id}>{resource.displayName}</option>)}</select></label>
        <label>{words('大小','Size')}<select disabled={disabled} value={selected.scale} onChange={event=>edit({scale:Number(event.target.value)})}>{[.75,1,1.25,1.5].map(scale=><option key={scale} value={scale}>{Math.round(scale*100)}%</option>)}</select></label>
        {row(words('点击互动','Click interactions'),selected.interaction,value=>edit({interaction:value}))}
        {row(words('跟随视线','Follow pointer'),selected.look,value=>edit({look:value}))}
        {row(words('安静模式','Quiet mode'),selected.quiet,value=>edit({quiet:value}))}
        {row(words('互动心情','Interaction mood'),selected.moodEnabled,value=>edit({moodEnabled:value}))}
      </div>
      <details className="pet-group"><summary>{words('气泡与资源管理','Bubbles and resources')}</summary>
        <label>{words('气泡主题','Bubble theme')}<select disabled={disabled} value={selected.bubble.theme} onChange={event=>edit({bubble:{...selected.bubble,theme:event.target.value as PetSettings['bubble']['theme']}})}>{['dark','light','blue'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>{words('气泡位置','Bubble placement')}<select disabled={disabled} value={selected.bubble.placement} onChange={event=>edit({bubble:{...selected.bubble,placement:event.target.value as 'top'|'bottom'}})}><option value="top">{words('上方','Above')}</option><option value="bottom">{words('下方','Below')}</option></select></label>
        <label>{words('气泡字号','Bubble font size')}<select disabled={disabled} value={selected.bubble.fontSize} onChange={event=>edit({bubble:{...selected.bubble,fontSize:Number(event.target.value)}})}>{Array.from({length:13},(_,i)=>i+10).map(size=><option key={size}>{size}</option>)}</select></label>
        <label>{words('气泡时长（秒）','Bubble duration (seconds)')}<select disabled={disabled} value={selected.bubble.durationMs} onChange={event=>edit({bubble:{...selected.bubble,durationMs:Number(event.target.value)}})}>{Array.from({length:15},(_,i)=>i+1).map(seconds=><option key={seconds} value={seconds*1000}>{seconds}</option>)}</select></label>
        <label>{words('自定义气泡模板 JSON','Custom bubble templates JSON')}<textarea rows={4} value={templates} onChange={event=>setTemplates(event.target.value)}/></label>
        <Button disabled={disabled} onClick={()=>{try{edit({bubble:{...selected.bubble,templates:JSON.parse(templates)}});setMessage('')}catch{setMessage(words('请输入有效 JSON','Enter valid JSON'))}}}>{words('保存气泡模板','Save bubble templates')}</Button>
        <label>{words('资源包本地路径','Local resource path')}<Input value={path} onChange={event=>{setPath(event.target.value);setPreview(null)}} /></label>
        <div className="pet-actions"><Button disabled={disabled || !path} onClick={()=>void operation(async()=>setPreview(await store.request('pet/packages',{action:'preview',source:path})))}>{words('预检','Inspect')}</Button>
        <Button disabled={disabled || !preview} onClick={()=>void operation(async()=>{await store.request('pet/packages',{action:'import',source:path,expected:preview?.digest,replace});setPreview(null)})}>{words('导入','Import')}</Button></div>
        {row(words('替换同 ID 资源','Replace same ID'),replace,setReplace)}
        {preview && <div><p>{preview.id}</p><img src={preview.preview} alt={words('资源预览','Resource preview')} style={{maxWidth:160,maxHeight:160}}/></div>}
        <label>{words('资源导出目录','Export directory')}<Input value={destination} onChange={event=>setDestination(event.target.value)}/></label>
        <Button disabled={disabled || !destination} onClick={()=>void operation(()=>store.request('pet/packages',{action:'export',resourceId:selected.resource,destination}))}>{words('导出资源','Export resources')}</Button>
        <Button disabled={disabled || selected.resource==='xiaojing'} onClick={()=>setDeleteId(selected.resource)}>{words('删除自定义资源','Delete custom resource')}</Button>
        {deleteId && <div className="pet-actions"><span>{words('确认删除资源 ','Delete resource ')}{deleteId}?</span>
          <Button disabled={disabled} onClick={()=>void operation(async()=>{await store.request('pet/packages',{action:'delete',resourceId:deleteId});setDeleteId(null)})}>{words('确认删除','Confirm delete')}</Button>
          <Button onClick={()=>setDeleteId(null)}>{words('取消','Cancel')}</Button></div>}
      </details>
    </>}
    {message && <p role="status">{message}</p>}
  </div>
}
