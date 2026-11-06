import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Engine } from '../src/engine.ts'
import { temporaryDirectory } from './temporary-directory.mjs'
import { groupSummary } from '../src/group-summary.ts'
import { Runner, validateDiagnosticEvent } from '../src/runner.ts'
const image='sha256:'+'a'.repeat(64)
const pause=()=>new Promise<void>(r=>setTimeout(r,5))
async function setup() {const tmp=await temporaryDirectory('groups060-');const engine=await Engine.open(tmp.directory);return {engine,tmp,close:async()=>{await engine.close();await tmp.cleanup()}}}
async function finished(engine:Engine,id:string) {for(let i=0;i<400;i++){const g=engine.groups.get(id);if(!['queued','running'].includes(g.status))return g;await pause()}throw Error('Group wait exceeded')}
test('groups freeze attempt/help/code across environment await and execute grid sequentially',async()=>{
 const {engine,close}=await setup()
 try {
  let ready!:()=>void;const gate=new Promise<void>(r=>ready=r)
  engine.runner.environment=async()=>{await gate;return {available:true,detail:'fixture',image:'fixture',resolvedImageId:image}}
  let active=0,max=0;const observed:any[]=[]
  engine.runner.execute=async(run)=>{active++;max=Math.max(max,active);observed.push(structuredClone(run));await pause();active--;return {...run,run_status:'completed',check_status:'passed',resolvedImageId:image,events:[{runId:run.id,seq:1,type:'metric',name:'validation_loss',source:'program',value:run.seed}]}}
  const oldAttempt=engine.workspace('L04-train').attemptId
  const pending=engine.groups.start('L04-train','frozen A',{seeds:[1,2],learningRates:[.05,.1],hypothesis:'one factor',budgetMs:10000})
  engine.store.beginIndependent('L04-train');engine.hint('L04-train','answer');engine.saveDraft('L04-train','new B',0);ready()
  const g=await pending;const final=await finished(engine,g.id)
  assert.equal(final.status,'completed');assert.equal(max,1);assert.equal(observed.length,4)
  for(const r of observed){assert.equal(r.code,'frozen A');assert.equal(r.attemptId,oldAttempt);assert.equal(r.help,'none');assert.equal(r.expectedImageId,image)}
  const rows=groupSummary(final,engine.store.runs());assert.equal(rows.length,2);assert.equal(rows[0]!.n,2);assert.equal(rows[0]!.mean,1.5);assert.ok(Math.abs(rows[0]!.sampleStd!-Math.SQRT1_2)<1e-10)
  assert.throws(()=>engine.groups.conclude(g.id,0,'claim','limits'),/revision/)
  const saved=engine.groups.conclude(g.id,final.revision,'Observed mean under this setup','Two seeds only');assert.equal(saved.conclusion,'Observed mean under this setup')
 } finally {await close()}
})
test('group cancellation waits for current cleanup and never launches remaining items',async()=>{
 const {engine,close}=await setup()
 try {
  engine.runner.environment=async()=>({available:true,detail:'fixture',image:'fixture',resolvedImageId:image})
  let began!:()=>void;const started=new Promise<void>(r=>began=r);let cleaned=false,calls=0
  engine.runner.execute=async(run,e,signal)=>{calls++;began();await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));await pause();cleaned=true;return {...run,run_status:'cancelled',check_status:'not_run'}}
  const g=await engine.groups.start('L04-train','A',{seeds:[1,2],learningRates:[.05],hypothesis:'cancel',budgetMs:10000});await started
  await engine.groups.cancel(g.id);assert.ok(cleaned);assert.equal(calls,1);assert.equal(engine.groups.get(g.id).status,'cancelled')
 }finally{await close()}
})
test('group close awaits in-flight environment inspection without writing after closure',async()=>{
 const {engine,tmp}=await setup();let release!:()=>void;const gate=new Promise<void>(r=>release=r)
 engine.runner.environment=async()=>{await gate;return {available:true,detail:'fixture',image:'fixture',resolvedImageId:image}}
 const pending=engine.groups.start('L04-train','A',{seeds:[1],learningRates:[.05],hypothesis:'prepare',budgetMs:10000});const rejection=assert.rejects(pending,/cancelled/)
 let closed=false;const closing=engine.close().then(()=>{closed=true});await pause();assert.equal(closed,false);release();await rejection;await closing;await tmp.cleanup()
})
test('reopening never resumes an uncertain group and n=0/1 SD remains unavailable',async()=>{
 const {engine,tmp}=await setup()
 engine.runner.environment=async()=>({available:true,detail:'fixture',image:'fixture',resolvedImageId:image})
 engine.runner.execute=async run=>({...run,run_status:'timed_out',check_status:'not_run'})
 const g=await engine.groups.start('L04-train','A',{seeds:[1],learningRates:[.05],hypothesis:'timeout',budgetMs:10000});const done=await finished(engine,g.id);assert.equal(done.status,'failed')
 const stats=groupSummary(done,engine.store.runs())[0]!;assert.equal(stats.n,0);assert.equal(stats.mean,undefined);assert.equal(stats.sampleStd,undefined)
 engine.store.set('experiment-group:'+g.id,{...done,status:'running',items:done.items.map(i=>({...i,status:'queued'}))});await engine.close()
 const reopened=await Engine.open(tmp.directory);assert.equal(reopened.groups.get(g.id).status,'interrupted');assert.equal(reopened.groups.get(g.id).items[0]!.status,'interrupted');await reopened.close();await tmp.cleanup()
})
test('scalar shape is valid while tensor stays two-dimensional; frozen image drift never creates container',async()=>{
 validateDiagnosticEvent({runId:'x',seq:1,type:'shape',name:'loss',shape:[]})
 assert.throws(()=>validateDiagnosticEvent({runId:'x',seq:1,type:'tensor',name:'loss',shape:[],data:[[]],stride:1}))
 const {engine,close}=await setup();const calls:string[][]=[]
 try {
 const runner=new Runner('unused',undefined,{},async(exe,args)=>{calls.push(args);return {code:0,out:args[0]==='image'?'sha256:'+'b'.repeat(64):'29'}})
 const run:any={id:'test',exerciseId:'L04-train',code:'A',config:{},seed:42,events:[],log:'',createdAt:new Date().toISOString(),expectedImageId:image}
 const result=await runner.execute(run,engine.exercise('L04-train'),new AbortController().signal)
 assert.equal(result.run_status,'failed');assert.match(result.reason!,/Frozen image/);assert.ok(calls.every(a=>a[0]!=='create'))
 }finally{await close()}
})

test('total group budget aborts its active run, waits cleanup and never starts queued items',async()=>{
 const {engine,close}=await setup()
 try {
  engine.runner.environment=async()=>({available:true,detail:'fixture',image:'fixture',resolvedImageId:image})
  let calls=0,cleaned=false
  engine.runner.execute=async(run,e,signal)=>{calls++;await new Promise<void>(r=>signal.addEventListener('abort',()=>r(),{once:true}));await pause();cleaned=true;return {...run,run_status:'cancelled',check_status:'not_run'}}
  const g=await engine.groups.start('L04-train','A',{seeds:[1,2],learningRates:[.05],hypothesis:'budget',budgetMs:1000})
  const end=await finished(engine,g.id)
  assert.equal(end.status,'timed_out');assert.equal(calls,1);assert.ok(cleaned)
  assert.equal(end.items[1]!.status,'cancelled')
 }finally{await close()}
})
