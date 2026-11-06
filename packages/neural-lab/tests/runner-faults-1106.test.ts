import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCatalog } from '../src/catalog.ts'
import { Runner } from '../src/runner.ts'
import { temporaryRunner } from './runner-helper.ts'
import type { RunRecord } from '../src/types.ts'

const catalog = await loadCatalog()
const exercise = catalog.lessons[0]!.exercises[0]!
const image = 'sha256:' + 'a'.repeat(64)
const container = 'b'.repeat(64)
const record = (): RunRecord => ({
  id: randomUUID(), exerciseId: exercise.id, code: exercise.reference,
  config: {}, seed: 42, createdAt: new Date().toISOString(), environment: '',
  help: 'none', events: [], log: '', run_status: 'queued', check_status: 'not_run',
  contentVersion: catalog.version, testVersion: exercise.testVersion,
})

for (const cleanupFails of [false, true]) {
  test(`cancel while create resolves; cleanup failure=${cleanupFails}`, async () => {
    const tmp = await temporaryRunner()
    try {
      const abort = new AbortController()
      const calls: string[][] = []
      const runner = new Runner(tmp.root, undefined, {}, async (_exe, args) => {
        calls.push(args)
        if (args[0] === 'image') return { code: 0, out: image }
        if (args[0] === 'version') return { code: 0, out: 'test-only' }
        if (args[0] === 'create') {
          assert.ok(args.includes(image), 'create must pin inspected image ID')
          abort.abort()
          return { code: 0, out: container }
        }
        if (args[0] === 'rm') return { code: cleanupFails ? 1 : 0, out: 'simulated removal' }
        throw Error('Unexpected Docker command ' + args[0])
      })
      const input = record()
      const out = await runner.execute(input, exercise, abort.signal)
      assert.equal(out.run_status, 'cancelled')
      assert.equal(out.check_status, 'not_run')
      assert.deepEqual(calls.filter((c) => c[0] === 'rm'), [['rm', '-f', container]])
      assert.equal(Boolean(out.cleanupPending), cleanupFails)
      const persisted = JSON.parse(await readFile(join(tmp.root, input.id, 'result.json'), 'utf8'))
      assert.equal(persisted.run_status, 'cancelled')
      assert.equal(persisted.cleanupPending, out.cleanupPending)
      assert.ok(!out.events.some((e) => e.type === 'check'))
    } finally { await tmp.cleanup() }
  })
}

test('uncertain create failure is persisted and recovered by exact owner/name', async () => {
  const tmp = await temporaryRunner()
  try {
    let name = ''
    let owner = ''
    const runner = new Runner(tmp.root, undefined, {}, async (_exe, args) => {
      if (args[0] === 'image') return { code: 0, out: image }
      if (args[0] === 'version') return { code: 0, out: 'test-only' }
      if (args[0] === 'create') {
        name = args[args.indexOf('--name') + 1]!
        owner = args[args.indexOf('--label') + 1]!
        throw Error('create reply lost after server accepted request')
      }
      throw Error('Unexpected command: ' + args)
    })
    const input = record()
    const result = await runner.execute(input, exercise, new AbortController().signal)
    assert.equal(result.run_status, 'failed')
    assert.equal(result.check_status, 'not_run')
    assert.equal(result.cleanupPending, name)
    const calls: string[][] = []
    const recovery = new Runner(tmp.root, undefined, {}, async (_exe, args) => {
      calls.push(args)
      if (args[0] === 'ps') return { code: 0, out: container }
      if (args[0] === 'rm') return { code: 0, out: '' }
      throw Error('Unexpected recovery command')
    })
    await recovery.recover(result)
    assert.deepEqual(calls, [
      ['ps', '-aq', '--no-trunc', '--filter', 'name=^/' + name + '$', '--filter', 'label=' + owner],
      ['rm', '-f', container],
    ])
    assert.equal(JSON.parse(await readFile(join(tmp.root, input.id, 'result.json'), 'utf8')).cleanupPending, name)
  } finally { await tmp.cleanup() }
})

for (const response of ['c'.repeat(64) + '\n' + 'd'.repeat(64), 'not-a-container']) {
  test('ambiguous recovery refuses removal: ' + response.slice(0, 15), async () => {
    const tmp = await temporaryRunner()
    try {
      const calls: string[][] = []
      const runner = new Runner(tmp.root, undefined, {}, async (_exe, args) => {
        calls.push(args)
        return { code: 0, out: response }
      })
      await assert.rejects(runner.recover(record()), /Ambiguous recovery identity/)
      assert.deepEqual(calls.map((c) => c[0]), ['ps'])
    } finally { await tmp.cleanup() }
  })
}
