import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {request} from 'node:http'
import {Engine,handleRequest,dispatch,apply} from '../lib/index.js'
import {Context,Service} from '@deepseek-ai/cordis'
test('real rc5 Cordis lifecycle registers and removes independent namespace',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'neural-cordis-'));const ctx=new Context();const connection=new Service(ctx,'connection');
 try{await apply(ctx,{dataRoot:dir,image:'dsh-neural-lab-cpu:0.1'});await assert.rejects(Engine.open(dir),/active owner/);await ctx.fiber.dispose();const reopened=await Engine.open(dir);await reopened.close()}finally{await ctx.fiber.dispose();await rm(dir,{recursive:true,force:true})}
})
test('actual HTTP RPC preserves drafts and notes, hides answers, validates input and exports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'neural-rpc-'));let engine=await Engine.open(dir);const lifetime=new AbortController()
 let grounded;const server=createServer((req,res)=>void handleRequest(engine,req,res,lifetime.signal,async(prompt)=>{grounded=JSON.parse(prompt);return {status:'unavailable',text:'No model in isolated test'}}))
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/api/neural-lab/rpc`
 const call=async(method,args=[])=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,args})});return {status:r.status,body:await r.json()}}
 try{
  const overview=(await call('overview')).body;assert.equal(overview.catalog.lessons.length,12);assert.ok(overview.catalog.lessons.flatMap(l=>l.exercises).every(e=>e.reference===''&&e.answer===undefined))
  const id=overview.catalog.lessons[0].exercises[0].id;assert.equal((await call('saveDraft',[id,'code snapshot',0])).body,1);assert.equal((await call('saveDraft',[id,'bad',0])).status,400)
  assert.equal((await call('saveNote',[id,'note snapshot',0])).body,1);assert.equal((await call('saveNote',[id,'bad',0])).status,400)
  assert.equal((await call('saveProfile',[{unexpected:'bad'}])).status,400);assert.equal((await call('start',[id,'x',{seed:-2}])).status,400)
  assert.equal((await call('hint',[id,'answer'])).status,200);assert.equal(engine.store.help(id),'answer');assert.equal(engine.store.history(id,'attempt-snapshot')[0].code,'code snapshot');await call('independent',[id]);assert.equal(engine.store.help(id),'none')
  await call('saveProfile',[{background:'Python learner',goal:'Understand attention'}]);const tutor=(await call('tutor',[id,'explain','selected line'])).body;assert.equal(tutor.status,'unavailable');assert.equal(grounded.profile.background,'Python learner');assert.ok(grounded.lesson.objectives.length);assert.ok(grounded.lesson.excerpt.length<=1800);assert.ok(!('catalog' in grounded));assert.equal((await call('workspace',[id])).body.messages.length,2)
  await engine.close();engine=await Engine.open(dir);const ws=(await call('workspace',[id])).body;assert.equal(ws.draft,'code snapshot');assert.equal(ws.note,'note snapshot');assert.equal(ws.noteRevision,1)
  const exported=JSON.parse((await call('exportData')).body);assert.equal(exported.schemaVersion,1);assert.equal(exported.drafts.length,2)
  assert.equal((await call('__proto__')).status,400);assert.equal(engine.matchesAnswer('2.0000001','2'),true);assert.equal(engine.matchesAnswer('NaN','2'),false)
  const cross=await fetch(url,{method:'POST',headers:{'content-type':'application/json','origin':'http://untrusted.invalid'},body:JSON.stringify({method:'overview',args:[]})});assert.equal(cross.status,400)
  const large=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'saveDraft',args:[id,'x'.repeat(170000),1]})});assert.equal(large.status,400)
  await new Promise((resolve,reject)=>{const req=request(url,{method:'POST',headers:{'content-type':'application/json','content-length':'10000'}});const timer=setTimeout(()=>reject(Error('Slow request prevented disposal')),2000);req.on('error',()=>{});req.on('close',()=>{clearTimeout(timer);resolve()});req.write('{');setTimeout(()=>lifetime.abort(),50)})
 }finally{lifetime.abort();await new Promise(resolve=>server.close(resolve));await engine.close();await rm(dir,{recursive:true,force:true})}
})
