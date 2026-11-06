import assert from 'node:assert/strict'
import { Engine } from '../src/engine.ts'
import { temporaryDirectory } from './temporary-directory.mjs'
import { writeFile, mkdir } from 'node:fs/promises'
const a = await temporaryDirectory('neural-mlp-replay-a-')
const b = await temporaryDirectory('neural-mlp-replay-b-')
const first = await Engine.open(a.directory)
const second = await Engine.open(b.directory)
try {
  const exercise = first.exercise('L04-train')
  async function execute(engine: Engine, code: string, prediction: string, seed: number, learningRate: number) {
    const started = engine.start(exercise.id,code,{seed,learningRate},prediction)
    const until = Date.now()+180000
    while (Date.now()<until) {
      const result = engine.run(started.id)
      if (!['queued','running'].includes(result.run_status)) {
        assert.equal(result.run_status,'completed',result.reason)
        assert.equal(result.check_status,'passed')
        return result
      }
      await new Promise(resolve=>setTimeout(resolve,100))
    }
    throw Error('MLP replay exceeded bounded wait')
  }
  const original = await execute(first,exercise.reference,'The held-out loss should be reproducible',42,.05)
  const file = first.projectFile(original.id)
  const imported = second.inspectProject(exercise.id,JSON.stringify(file))
  assert.deepEqual(imported.components,[])
  assert.equal(second.store.runs().length,0,'import must not create trusted run')
  second.saveDraft(exercise.id,imported.code,0)
  const replay = await execute(second,imported.code,imported.prediction,imported.seed,imported.learningRate)
  const repeated = second.projectFile(replay.id)
  assert.equal(repeated.signature,file.signature)
  assert.equal(repeated.image,file.image)
  assert.deepEqual(repeated.manifest,file.manifest)
  assert.notEqual(repeated.runId,file.runId)
  await mkdir(new URL('../.build/',import.meta.url),{recursive:true})
  const result = {checkedAt:new Date().toISOString(),original:original.id,replay:replay.id,image:file.image,signature:file.signature,manifest:file.manifest,checks:['real CPU train','two isolated databases','import creates no trusted run','explicit replay exact signature']}
  await writeFile(new URL('../.build/mlp-replay-1106.json',import.meta.url),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result))
} finally { await first.close(); await second.close(); await a.cleanup(); await b.cleanup() }
