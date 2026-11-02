import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { temporaryRunner } from './runner-helper.ts'
import { Engine } from '../src/engine.ts'
import { Runner } from '../src/runner.ts'
import { loadCatalog } from '../src/catalog.ts'
import type { RunRecord } from '../src/types.ts'

const exec = promisify(execFile)
const docker =
  process.platform === 'win32'
    ? join(process.env.ProgramFiles!, 'Docker/Docker/resources/bin/docker.exe')
    : 'docker'
const cli = async (...args: string[]) =>
  (await exec(docker, args, { windowsHide: true, timeout: 20000 })).stdout.trim()
const tmp = await temporaryRunner()
const tag = 'neural-lab-lifecycle:' + randomUUID()
const image = (await tmp.runner.environment()).resolvedImageId!
const exercise = (await loadCatalog()).lessons[0]!.exercises[0]!
let tagged = false
try {
  await cli('tag', image, tag)
  tagged = true
  const engine = await Engine.open(join(tmp.root, 'profile'))
  const running = engine.start(
    exercise.id,
    'import time\ntime.sleep(30)\ndef solve(*args):return 0',
    {},
  )
  try {
    const until = Date.now() + 30000
    while (!(await cli('ps', '-q', '--filter', 'name=' + running.id))) {
      assert.ok(Date.now() < until, 'container must start before unload')
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  } finally {
    await engine.close()
  }
  assert.equal(await cli('ps', '-aq', '--filter', 'name=' + running.id), '')
  console.log('unload removed active container')
  for (const phase of ['inspect', 'snapshot', 'create', 'retag']) {
    const abort = new AbortController()
    const original: RunRecord = {
      id: randomUUID(),
      exerciseId: exercise.id,
      code: exercise.reference,
      contentVersion: '0.1.3',
      testVersion: '3',
      seed: 42,
      config: {},
      help: 'none',
      environment: '',
      createdAt: new Date().toISOString(),
      run_status: 'queued',
      check_status: 'not_run',
      events: [],
      log: '',
    }
    let created = false
    const runner = new Runner(tmp.root, tag, {}, async (_exe, args) => {
      if (args[0] === 'image' && phase === 'inspect') abort.abort()
      if (args[0] === 'create') {
        assert.ok(args.includes(image))
        if (phase === 'create') abort.abort()
        if (phase === 'retag') {
          const other = (await cli('images', '--no-trunc', '-q'))
            .split(/\r?\n/)
            .find((id) => id !== image && /^sha256:[a-f0-9]{64}$/.test(id))
          if (other) await cli('tag', other, tag)
          else {
            await cli('rmi', tag)
            tagged = false
          }
        }
        created = true
      }
      try {
        return { code: 0, out: await cli(...args) }
      } catch (error) {
        return { code: 1, out: String(error) }
      }
    })
    const result = await runner.execute(original, exercise, abort.signal, (update) => {
      if (phase === 'snapshot' && update.run_status === 'running') abort.abort()
    })
    assert.equal(created, phase === 'create' || phase === 'retag')
    assert.equal(result.run_status, phase === 'retag' ? 'completed' : 'cancelled')
    if (phase === 'retag') {
      assert.equal(result.resolvedImageId, image)
      assert.equal(result.check_status, 'passed')
    }
    assert.equal(result.cleanupPending, undefined)
    assert.equal(await cli('ps', '-aq', '--filter', 'name=' + original.id), '')
    console.log(phase, result.run_status, 'no residual container')
  }
} finally {
  try {
    if (tagged) await cli('rmi', tag)
  } finally {
    await tmp.cleanup()
  }
}
