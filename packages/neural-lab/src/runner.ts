import { spawn } from 'node:child_process'

import { mkdir, writeFile, access } from 'node:fs/promises'

import { join, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

import type { EnvironmentStatus, Exercise, RunEvent, RunRecord } from './types.ts'

const runtime=fileURLToPath(new URL('../runtime',import.meta.url))

const MAX_OUTPUT=262144

async function dockerPath():Promise<string>{if(process.platform==='win32'){const candidate=join(process.env.ProgramFiles??'C:\\Program Files','Docker','Docker','resources','bin','docker.exe');try{await access(candidate);return candidate}catch{}}return 'docker'}

async function command(exe:string,args:string[],timeout=15000):Promise<{code:number;out:string}>{return await new Promise((res,rej)=>{const p=spawn(exe,args,{windowsHide:true});let out='';const timer=setTimeout(()=>{p.kill();rej(new Error('Docker command timed out'))},timeout);p.stdout.on('data',(d:Buffer)=>{out=(out+d.toString()).slice(-MAX_OUTPUT)});p.stderr.on('data',(d:Buffer)=>{out=(out+d.toString()).slice(-MAX_OUTPUT)});p.on('error',e=>{clearTimeout(timer);rej(e)});p.on('close',code=>{clearTimeout(timer);res({code:code??-1,out})})})}

export interface RunnerLimits { timeoutMs?:number; memoryMb?:number; cpus?:number; outputBytes?:number }

export class Runner {

 private limits:Required<RunnerLimits>

 constructor(private root:string,private image='dsh-neural-lab-cpu:0.1',limits:RunnerLimits={}){

 this.limits={timeoutMs:limits.timeoutMs??120000,memoryMb:limits.memoryMb??1024,cpus:limits.cpus??1,outputBytes:limits.outputBytes??262144}

 const l=this.limits;if(!Number.isInteger(l.timeoutMs)||l.timeoutMs<1000||l.timeoutMs>600000||!Number.isInteger(l.memoryMb)||l.memoryMb<256||l.memoryMb>8192||!Number.isFinite(l.cpus)||l.cpus<0.25||l.cpus>8||!Number.isInteger(l.outputBytes)||l.outputBytes<4096||l.outputBytes>4194304)throw new Error('Invalid runner resource limits')

 }

 async environment():Promise<EnvironmentStatus>{try{const exe=await dockerPath();const r=await command(exe,['image','inspect',this.image,'--format','{{.Id}}']);if(r.code!==0)throw new Error(r.out);const p=await command(exe,['version','--format','{{.Server.Version}}']);if(p.code!==0)throw new Error(p.out);return{available:true,detail:r.out.trim()+' '+p.out.trim(),image:this.image}}catch(e){return{available:false,detail:String(e),image:this.image}}}

 async execute(original:RunRecord,exercise:Exercise,signal:AbortSignal,onUpdate?:(r:RunRecord)=>void):Promise<RunRecord>{

  const r:RunRecord={...original,events:[],log:'',check_status:'not_run',run_status:'running'}

  const finish=()=>{r.finishedAt=new Date().toISOString();onUpdate?.({...r});return r}

  if(signal.aborted){r.run_status='cancelled';return finish()}

  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(r.id)||!exercise.runtimeKey||! /^(code\d{2}|grad|mlp|softmax|attention|causal|lm)$/.test(exercise.runtimeKey))throw new Error('Invalid run identity')

  const env=await this.environment();if(signal.aborted){r.run_status='cancelled';return finish()}r.environment=env.detail;if(!env.available){r.run_status='failed';r.reason=env.detail;return finish()}

  const dir=resolve(this.root,r.id);await mkdir(dir,{recursive:true});await writeFile(join(dir,'submission.py'),r.code);await writeFile(join(dir,'snapshot.json'),JSON.stringify(r));

  const exe=await dockerPath();const name='neural-lab-'+r.id;let cancelled=false,timedOut=false,overflow=false,complete=false;let buffer='',size=0

  const limit=Math.min(this.limits.timeoutMs,Math.max(1000,r.config.timeoutMs??this.limits.timeoutMs));const outputLimit=this.limits.outputBytes

  let cleanupPromise:Promise<void>|undefined;const cleanup=():Promise<void>=>cleanupPromise??=(async()=>{try{const removed=await command(exe,['rm','-f',name]);if(removed.code!==0&&!removed.out.includes('No such container'))r.log+='\nContainer cleanup: '+removed.out}catch(error){r.log+='\nContainer cleanup not confirmed: '+String(error)}})()

  try{

   await new Promise<void>((resolvePromise,reject)=>{

    const p=spawn(exe,['run','--pull=never','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--cap-add','SETUID','--cap-add','SETGID','--cap-add','KILL','--security-opt','no-new-privileges','--pids-limit','64','--memory',String(this.limits.memoryMb)+'m','--cpus',String(this.limits.cpus),'--tmpfs','/tmp:rw,noexec,nosuid,size=64m','--user','0:0','-e','OMP_NUM_THREADS=1','-e','MKL_NUM_THREADS=1','-e','PYTHONDONTWRITEBYTECODE=1','--mount',`type=bind,source=${dir},target=/work,readonly`,'--mount',`type=bind,source=${runtime},target=/runtime,readonly`,this.image,'python','/runtime/controller.py',exercise.runtimeKey!,r.id,String(r.seed),JSON.stringify(r.config)],{windowsHide:true})

    const stop=()=>{void cleanup();p.kill()};const abort=()=>{cancelled=true;stop()};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()

    const timer=setTimeout(()=>{timedOut=true;stop()},limit)

    p.stdout.on('data',(data:Buffer)=>{size+=data.length;if(size>outputLimit){overflow=true;stop();return}buffer+=data.toString();let nl:number;while((nl=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);try{if(complete)throw new Error('Event after completion');const event:unknown=JSON.parse(line);if(typeof event!=='object'||event===null)throw new Error('Invalid event');if('controller_complete' in event){complete=event.controller_complete===true;continue}const e=event as RunEvent;if(e.runId!==r.id||e.seq!==r.events.length+1||!['metric','tensor','check'].includes(e.type)||typeof e.name!=='string'||e.name.length>200||(e.detail!==undefined&&(typeof e.detail!=='string'||e.detail.length>4000)))throw new Error('Invalid event identity');if(e.type==='metric'&&!Number.isFinite(e.value))throw new Error('Invalid metric');if(e.type==='tensor'&&(!Array.isArray(e.data)||e.data.length>128||e.data.some(row=>!Array.isArray(row)||row.length>128||row.some(v=>!Number.isFinite(v)))))throw new Error('Invalid tensor');if(e.type==='check'&&typeof e.passed!=='boolean')throw new Error('Invalid check');r.events.push(e);onUpdate?.({...r})}catch(err){r.log+=String(err)+'\n';overflow=true;stop()}}})

    p.stderr.on('data',(data:Buffer)=>{size+=data.length;r.log=(r.log+data.toString()).slice(0,outputLimit);if(size>outputLimit){overflow=true;stop()}})

    p.on('error',error=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(error)});p.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',abort);if(cancelled)r.run_status='cancelled';else if(timedOut)r.run_status='timed_out';else if(overflow||code!==0||!complete||buffer.trim()!==''){r.run_status='failed';r.reason=overflow?'Output/protocol limit':`Controller exit ${code}; completion=${complete}`}else{r.run_status='completed';const checks=r.events.filter(e=>e.type==='check');r.check_status=checks.length===0?'inconclusive':checks.every(e=>e.passed)?'passed':'failed'}resolvePromise()})

   })

  }catch(e){r.run_status='failed';r.reason=String(e)}finally{await cleanup()}

  r.finishedAt=new Date().toISOString();await writeFile(join(dir,'events.jsonl'),r.events.map(e=>JSON.stringify(e)).join('\n'));r.events.push({runId:r.id,seq:r.events.length+1,type:'artifact',name:'Raw execution events / 原始运行事件',path:'events.jsonl'});r.events.push({runId:r.id,seq:r.events.length+1,type:'artifact',name:'Run snapshot / 运行快照',path:'result.json'});await writeFile(join(dir,'result.json'),JSON.stringify(r));return finish()

 }

}
