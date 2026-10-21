import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PetSettings } from '@nidofy/dsh-plugin-shared/state'
import type { PetStore } from './store.ts'
function Pet({ pet, index, zh }: { pet: PetSettings; index: number; zh: boolean }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [menu, setMenu] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const drag = useRef<{id:number;x:number;y:number;left:number;top:number} | null>(null)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'nidofy:pet-menu') return
      setMenu(event.data.open === true)
    }
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive)
  }, [])
  const width = Math.ceil(240 * pet.scale), height = Math.ceil(280 * pet.scale)
  return <div data-nidofy-pet={pet.id} style={{position:'absolute',left:24+index*260+offset.x,bottom:20-offset.y,width:menu?width+220:width,height:menu?Math.max(350,height):height,pointerEvents:'auto'}}>
    <button aria-label={zh?'拖动桌宠':'Move pet'} title={zh?'拖动桌宠':'Move pet'}
      style={{display:'block',margin:'0 auto',height:18,width:48,border:0,borderRadius:8,background:'var(--dsw-alias-bg-overlay,#8884)',color:'var(--dsw-alias-label-secondary)',cursor:'move',touchAction:'none'}}
      onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:offset.x,top:offset.y}}}
      onPointerMove={event=>{const d=drag.current;if(d?.id!==event.pointerId)return;setOffset({x:Math.max(-index*260-24,Math.min(innerWidth-width-24-index*260,d.left+event.clientX-d.x)),y:Math.min(20,Math.max(height-innerHeight,d.top+event.clientY-d.y))})}}
      onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>⋯</button>
    <iframe ref={frame} title={zh?'桌宠 '+pet.id:'Pet '+pet.id} src={'/api/nidofy-pets/assets/pet/index.html?id='+encodeURIComponent(pet.id)}
      style={{width:'100%',height:'calc(100% - 18px)',border:0,display:'block',background:'transparent'}} />
  </div>
}
export function PetOverlay({ store, zh }: {store:PetStore;zh:boolean}) {
  const {preferences}=useSyncExternalStore(store.subscribe,store.snapshot)
  const [visible,setVisible]=useState(!document.hidden)
  useEffect(()=>{const change=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change)},[])
  if (!visible || !preferences?.pets) return null
  return <div data-nidofy-pets-overlay>{[preferences.pet,...preferences.companions].filter(p=>p.enabled).map((pet,index)=><Pet key={pet.id} pet={pet} index={index} zh={zh}/>)}</div>
}
