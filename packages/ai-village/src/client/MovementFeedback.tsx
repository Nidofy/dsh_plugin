import { useEffect, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { actionErrorText } from './ManagementPanel.tsx'
import { characterNames } from '../core/roster.ts'

export function MovementFeedback({runtime:r,cn}:{runtime:VillageRuntime;cn:boolean}) {
  const move=r.controller?.world.manualMove, [visible,setVisible]=useState(false)
  const code=r.actionError, relevant=['INVALID_MOVE_TARGET','MOVE_FURNITURE','MOVE_ALREADY_HERE','MOVE_PAUSED','PATH_BLOCKED','EVENT_ACTIVE'].includes(code)
  useEffect(()=>{setVisible(relevant);if(!relevant)return;const timer=setTimeout(()=>setVisible(false),5000);return()=>clearTimeout(timer)},[code,relevant])
  if(!move&&!(relevant&&visible))return null
  return <div className="village-movement-feedback" style={{position:'absolute',zIndex:25,top:60,left:'var(--gutter)',right:'var(--gutter)',pointerEvents:'none',display:'flex',alignItems:'center',gap:8,background:'var(--solid)',color:'var(--ink)',border:'1px solid var(--line)',borderRadius:12,padding:'6px 10px'}}>
    <span role="status" style={{flex:1}}>{relevant&&visible?actionErrorText(code,cn):move?cn?`${characterNames[move.actorId]}正在散步`:`${characterNames[move.actorId]} is walking`:''}</span>
    {move&&<button style={{pointerEvents:'auto',minHeight:40}} disabled={r.reasons.has('commit-pending')||r.saveReceipt.status==='unknown'} onClick={()=>void r.cancelResidentMove()}>{cn?'停止散步':'Stop walking'}</button>}
  </div>
}
