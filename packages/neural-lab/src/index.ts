import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import Schema from '@deepseek-ai/schemastery'
import type { IncomingMessage,ServerResponse } from 'node:http'
import { Engine } from './engine.ts'
export { Engine } from './engine.ts'
import { mentor } from './mentor.ts'
import type { HelpLevel } from './types.ts'
export const name='neural-lab'
export const inject=['connection']
export interface Config {dataRoot:string;image:string;timeoutMs?:number;memoryMb?:number;cpus?:number;outputBytes?:number}
export const Config:Schema<Config>=Schema.object({dataRoot:Schema.string().required(),image:Schema.string().default('dsh-neural-lab-cpu:0.1'),timeoutMs:Schema.number().min(1000).max(600000).default(120000),memoryMb:Schema.number().min(256).max(8192).default(1024),cpus:Schema.number().min(.25).max(8).default(1),outputBytes:Schema.number().min(4096).max(4194304).default(262144)})
function string(v:unknown):string {if(typeof v!=='string')throw Error('Expected string');return v}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Expected object');return v as Record<string,unknown>}
function numeric(v:unknown):Record<string,number>{return Object.fromEntries(Object.entries(object(v)).map(([k,x])=>{if(typeof x!=='number')throw Error('Expected number');return [k,x]}))}
export async function dispatch(engine:Engine,method:string,args:unknown[],tutor:(prompt:string)=>Promise<{status:string;text:string}>):Promise<unknown>{
  const id=()=>string(args[0])
  switch(method){
    case 'overview':return engine.overview()
    case 'workspace':return engine.workspace(id())
    case 'saveDraft':if(typeof args[2]!=='number')throw Error('Expected revision');return engine.saveDraft(id(),string(args[1]),args[2])
    case 'saveNote':if(typeof args[2]!=='number')throw Error('Expected revision');return engine.saveNote(id(),string(args[1]),args[2])
    case 'readLesson':return engine.readLesson(id())
    case 'selectLesson':if(!engine.catalog.lessons.some(l=>l.id===id()))throw Error('Unknown lesson');return engine.store.set('currentLesson',id())
    case 'saveProfile':return engine.saveProfile(Object.fromEntries(Object.entries(object(args[0])).map(([k,v])=>[k,string(v)])))
    case 'start':return engine.start(id(),string(args[1]),numeric(args[2]))
    case 'run':return engine.run(id())
    case 'cancel':return engine.cancel(id())
    case 'answer':return engine.answer(id(),string(args[1]))
    case 'hint':return engine.hint(id(),string(args[1]) as HelpLevel)
    case 'environment':return engine.runner.environment()
    case 'exportData':return JSON.stringify({...JSON.parse(engine.store.export()),contentVersion:engine.catalog.version},null,2)
    case 'snooze':return engine.snooze(id())
    case 'independent':engine.exercise(id());return engine.store.beginIndependent(id())
    case 'tutor':{const e=engine.exercise(id()),text=string(args[1]),selection=string(args[2]);engine.text(text,6000);engine.text(selection,3000);const workspace=engine.workspace(e.id);const lesson=engine.catalog.lessons.find(l=>l.id===e.lessonId);const profile=Object.fromEntries(Object.entries(engine.store.get<Record<string,string>>('profile',{})).map(([key,value])=>[key,value.slice(0,1000)]));const selectionIndex=selection&&lesson?lesson.body.indexOf(selection):-1;const excerpt=lesson?.body.slice(Math.max(0,selectionIndex-300),Math.max(0,selectionIndex-300)+1800)??'';engine.snapshotAttempt(e.id,'mentor-request');engine.store.record(e.id,'message',{role:'user',text,status:'completed'});engine.store.record(e.id,'hint','concept');const result=await tutor(JSON.stringify({exercise:{title:e.title,prompt:e.prompt,inputDomain:e.inputDomain},lesson:{id:e.lessonId,title:lesson?.title,objectives:lesson?.objectives,excerpt},profile,recentEvidence:engine.store.evidence().filter(item=>item.exerciseId===e.id).slice(-4),observedHelp:engine.store.help(e.id),selection,question:text,code:workspace.draft.slice(0,12000),latestRun:workspace.runs[0]?{id:workspace.runs[0].id,status:workspace.runs[0].run_status,checks:workspace.runs[0].check_status,events:workspace.runs[0].events.slice(-12),log:workspace.runs[0].log.slice(-3000)}:null}));engine.store.record(e.id,'message',{role:'assistant',...result});return result}
    default:throw Error('Unknown Neural Lab method')
  }
}
export async function handleRequest(engine:Engine,req:IncomingMessage,res:ServerResponse,signal:AbortSignal,tutor:(prompt:string)=>Promise<{status:string;text:string}>):Promise<void>{
  const abort=()=>req.destroy();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,30000)
  if(signal.aborted){abort();clearTimeout(timeout);return}
  res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store')
  try {if(req.method!=='POST'||!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))throw Error('JSON POST required')
    if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))throw Error('Origin refused')
    const chunks:Buffer[]=[];let size=0
    for await(const chunk of req){signal.throwIfAborted();size+=chunk.length;if(size>160000)throw Error('Request too large');chunks.push(Buffer.from(chunk))}
    const input=object(JSON.parse(Buffer.concat(chunks).toString('utf8')));if(!Array.isArray(input.args)||input.args.length>5)throw Error('Invalid arguments')
    clearTimeout(timeout);const value=await dispatch(engine,string(input.method),input.args,tutor);res.end(JSON.stringify(value??null))
  }catch(error){res.statusCode=400;res.end(JSON.stringify({error:error instanceof Error?error.message:String(error)}))}finally{clearTimeout(timeout);signal.removeEventListener('abort',abort)}
}
export async function apply(ctx:Context,config:Config):Promise<void>{
  const engine=await Engine.open(config.dataRoot,config.image,{timeoutMs:config.timeoutMs,memoryMb:config.memoryMb,cpus:config.cpus,outputBytes:config.outputBytes}),lifetime=new AbortController(),pending=new Set<Promise<void>>();let tutoring=false
  const ask=async(prompt:string)=>{if(tutoring)return {status:"unavailable",text:"导师正在回答 / Tutor is busy"};tutoring=true;try{return await mentor(ctx,prompt,AbortSignal.any([lifetime.signal,AbortSignal.timeout(120000)]))}finally{tutoring=false}}
  ctx.on('connection/request',async(req,res,next)=>{if(new URL(req.url??'/','http://localhost').pathname!=='/api/neural-lab/rpc')return next();if(lifetime.signal.aborted){res.statusCode=503;res.end();return}const task=handleRequest(engine,req,res,lifetime.signal,ask);pending.add(task);try{await task}finally{pending.delete(task)}})
  ctx.effect(()=>async()=>{lifetime.abort();await Promise.allSettled([...pending]);await engine.close()})
}
