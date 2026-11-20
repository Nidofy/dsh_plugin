import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import * as plugin from '../src/index.ts'
import { Engine } from '../src/engine.ts'
import type { AddressInfo } from 'node:net'
import type { RunRecord } from '../src/types.ts'

const root = await mkdtemp(join(tmpdir(),'infra-gloo-gate-'))
const image = 'dsh-ai-infra-lab-cpu:0.1'
const activity = 'D05-code'
const docker = (...args:string[]) => execFileSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:8000}).trim()
const remaining = () => docker('ps','-aq','--filter','name=ai-infra-lab-')
const engine = await Engine.open(root,image,{outputBytes:16384,timeoutMs:50000})
const ref = engine.exercise(activity).reference
const run = async (code:string) => {
  const start = await engine.start(activity,code,{})
  const finished = await engine.waitRun(start.id)
  assert.equal(remaining(),'')
  return finished
}
try {
  for (const size of [2,3]) {
    const started = await engine.start(activity,ref,{world_size:size})
    const ended = await engine.waitRun(started.id)
    assert.equal(ended.check_status,'passed',JSON.stringify(ended.events))
    assert.equal(ended.events.find(e=>e.name==='workers')?.value,size)
    assert.equal(remaining(),'')
  }
  console.log('PASS two- and three-rank spawn on loopback')
  // Linux pids.max charges threads and processes alike. A single producer in the
  // verified 256-task cgroup makes at most 256 attempts; no recursive children.
  const bounded = `
import pathlib, threading
def verify_pid_ceiling():
    if dist.get_rank() != 0:
        return
    cg = pathlib.Path("/sys/fs/cgroup")
    assert (cg/"pids.max").read_text().strip() == "256"
    def hits():
        return int(dict(line.split() for line in (cg/"pids.events").read_text().splitlines())["max"])
    before = hits()
    release = threading.Event()
    workers = []
    try:
        for _ in range(256):
            worker = threading.Thread(target=release.wait, args=(3,))
            try:
                worker.start()
            except RuntimeError:
                break
            workers.append(worker)
        assert hits() > before
    finally:
        release.set()
        for worker in workers:
            worker.join(3)
`
  const pidTest = ref.replace('    partial =','    verify_pid_ceiling()\n    partial =') + bounded
  let result = await run(pidTest)
  assert.equal(result.check_status,'passed',JSON.stringify(result.events)+result.log)
  console.log('PASS real cgroup pids.max=256 denial, finite producer, all workers reaped')

  const skip = ref.replace('    dist.all_reduce(partial)','    if dist.get_rank() != 0:\n        dist.all_reduce(partial)')
  const started = Date.now()
  result = await run(skip)
  const diagnosis = result.events.find(e=>e.type==='check')?.message
  assert.equal(result.check_status,'failed',result.log)
  assert.match(diagnosis?.en ?? '',/25 s collective timeout/)
  assert.match(diagnosis?.zh ?? '',/通信超时/)
  assert.match(diagnosis!.en,/rank 0=complete/)
  assert.match(diagnosis!.en,/rank [123]=all_reduce/)
  assert.ok(Date.now()-started<48000)
  console.log('PASS missing rank diagnosed at 25 s with last primitive by rank, clean group exit')

  const burst = ref.replace('    partial =','    dist.barrier()\n    print("x" * 8192, flush=True)\n    partial =')
  result = await run(burst)
  assert.equal(result.run_status,'failed')
  assert.match(result.log+' '+result.reason,/output exceeded|Output limit/)
  assert.ok(Buffer.byteLength(result.log)<17000)
  console.log('PASS bounded simultaneous rank output crosses byte limit and triggers cleanup')
} finally { await engine.close() }

class Transport extends Service { constructor(ctx:Context) { super(ctx,'connection') } }
const ctx = new Context()
const server = createServer((req,res)=>{void ctx.waterfall('connection/request',req,res,async()=>{res.statusCode=404;res.end('{}')})})
try {
  await ctx.plugin(Transport)
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const fiber = await ctx.plugin(plugin,plugin.Config({image,dataRoot:root}))
  const endpoint = 'http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/ai-infra-lab/rpc'
  const post = (method:string,args:unknown[]) => fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,args})})
  const code = ref.replace('    partial =','    import time\n    time.sleep(20)\n    partial =')
  const response = await post('start',[activity,code,{}])
  assert.equal(response.status,200)
  const run = await response.json() as RunRecord
  const until = Date.now()+20000
  let workers = 0
  while (Date.now()<until && workers<4) {
    const id = docker('ps','-q','--filter','name='+run.id)
    if (id) workers = docker('top',id,'-eo','pid,args').split('\n').filter(s=>s.includes('spawn_main')).length
    if (workers<4) await delay(150)
  }
  assert.equal(workers,4,'All four live workers must be observed before disposal')
  await fiber.dispose()
  assert.equal(remaining(),'')
  assert.equal((await post('overview',[])).status,404)
  const reopened = await Engine.open(root,image)
  try { assert.equal(reopened.run(run.id).run_status,'cancelled') } finally { await reopened.close() }
  console.log('PASS real Cordis disposal with four live workers, route removed, cancelled record reopened')
} finally {
  await ctx.fiber.dispose()
  server.closeAllConnections()
  await new Promise<void>(resolve=>server.close(()=>resolve()))
  await rm(root,{recursive:true,force:true})
}
