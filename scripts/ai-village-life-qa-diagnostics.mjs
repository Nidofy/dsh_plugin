/** Read-only native CPU sampler. Profiling is opt-in and its overhead must be disclosed. */
import {writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
const scrubUrl=value=>{try{const u=new URL(value);u.search='';u.hash='';return u.toString()}catch{return value}}
const bounded=async(p,label,ms=15000)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('QA_TIMEOUT '+label)),ms)})])}finally{clearTimeout(timer)}}
export async function measureNative({page,protocol,parentSession,frame,world,root,runRoot,evidence,name,seconds=20,fullCpu=false,profile=false}){
 protocol=new Proxy(protocol,{get:(o,k)=>k==='send'?(...a)=>bounded(o.send(...a),'protocol '+a[0]):o[k]})
 parentSession=new Proxy(parentSession,{get:(o,k)=>k==='send'?(...a)=>bounded(o.send(...a),'parent '+a[0]):typeof o[k]==='function'?o[k].bind(o):o[k]})
 const profiles=[]
 if(profile){
  const sessions=[{name:'parent',session:parentSession,owned:false}]
  if(frame){const raw=await bounded(page.context().newCDPSession(frame),'scene session');sessions.push({name:'scene',session:new Proxy(raw,{get:(o,k)=>k==='send'?(...a)=>bounded(o.send(...a),'scene '+a[0]):typeof o[k]==='function'?o[k].bind(o):o[k]}),owned:true})}
  const targets=new Set()
  for(const s of sessions){const target=(await s.session.send('Target.getTargetInfo')).targetInfo.targetId;if(targets.has(target)){if(s.owned)await s.session.detach();continue}targets.add(target);await s.session.send('Profiler.enable');await s.session.send('Profiler.setSamplingInterval',{interval:1000});await s.session.send('Profiler.start');profiles.push(s)}
 }
 const snapshot=async()=>{
  const tree=fullCpu?JSON.parse(execFileSync('pwsh',['-NoProfile','-File',join(root,'scripts/ai-village-life-qa-process-snapshot.ps1'),'-RunRoot',runRoot],{encoding:'utf8',windowsHide:true,timeout:15000})):null
  const processes=(await protocol.send('SystemInfo.getProcessInfo')).processInfo,parent=(await parentSession.send('Performance.getMetrics')).metrics
  const scene=frame?await bounded(frame.evaluate(()=>({visibility:document.visibilityState,...window.__sceneMetrics()})),'scene snapshot'):null
  return {at:performance.now(),tree,processes,parent,scene,world:await world()}
 }
 const a=await snapshot();await page.waitForTimeout(seconds*1000);const b=await snapshot(),elapsed=(b.at-a.at)/1000
 const cdpDeltas=b.processes.map(p=>({type:p.type,id:p.id,cpuSeconds:p.cpuTime-(a.processes.find(q=>q.id===p.id)?.cpuTime??p.cpuTime)}))
 const treeInterval=a.tree&&b.tree?(Date.parse(b.tree.sampledAt)-Date.parse(a.tree.sampledAt))/1000:null
 const treeDeltas=a.tree&&b.tree?b.tree.processes.filter(p=>a.tree.processes.some(q=>q.id===p.id)).map(p=>({id:p.id,role:p.role,cpuSeconds:p.cpuSeconds-a.tree.processes.find(q=>q.id===p.id).cpuSeconds,privateBytes:p.privateBytes,privateDelta:p.privateBytes-a.tree.processes.find(q=>q.id===p.id).privateBytes})):null
 const added=a.tree&&b.tree?b.tree.processes.filter(p=>!a.tree.processes.some(q=>q.id===p.id)).map(p=>p.id):[],removed=a.tree&&b.tree?a.tree.processes.filter(p=>!b.tree.processes.some(q=>q.id===p.id)).map(p=>p.id):[]
 const metric=(s,key)=>s.parent.find(m=>m.name===key)?.value??0
 const result={name,seconds:elapsed,profiling:profile,fullCpuRequested:fullCpu,fps:a.scene&&b.scene?(b.scene.frames-a.scene.frames)/elapsed:0,before:a.scene,after:b.scene,ticks:b.world.ticks-a.world.ticks,worldUnchanged:JSON.stringify(a.world)===JSON.stringify(b.world),cdpCpuPercentOfOneCore:cdpDeltas.reduce((n,p)=>n+p.cpuSeconds,0)/elapsed*100,cdpDeltas,parentTaskPercent:(metric(b,'TaskDuration')-metric(a,'TaskDuration'))/elapsed*100,fullTree:treeDeltas?{seconds:treeInterval,cpuPercentOfOneCore:treeDeltas.reduce((n,p)=>n+p.cpuSeconds,0)/treeInterval*100,validUnchangedMembership:!added.length&&!removed.length,added,removed,deltas:treeDeltas,before:a.tree,after:b.tree}:null,profiles:[]}
 for(const s of profiles){const {profile:p}=await s.session.send('Profiler.stop');for(const n of p.nodes)n.callFrame.url=scrubUrl(n.callFrame.url);await writeFile(join(evidence,name+'-'+s.name+'.cpuprofile'),JSON.stringify(p));const times=new Map();for(let i=0;i<(p.samples?.length??0);i++)times.set(p.samples[i],(times.get(p.samples[i])??0)+(p.timeDeltas?.[i]??0));const top=[...times].sort((x,y)=>y[1]-x[1]).slice(0,20).map(([id,us])=>({selfMs:us/1000,percentOfProfile:us/(p.endTime-p.startTime)*100,...p.nodes.find(n=>n.id===id)?.callFrame}));result.profiles.push({name:s.name,durationSeconds:(p.endTime-p.startTime)/1e6,samples:p.samples?.length??0,top});if(s.owned)await s.session.detach()}
 await writeFile(join(evidence,name+'-diagnostic.json'),JSON.stringify(result,null,2)+'\n')
 return result
}
