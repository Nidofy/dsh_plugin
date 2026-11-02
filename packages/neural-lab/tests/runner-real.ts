import { temporaryRunner } from './runner-helper.ts'
import { strict as assert } from 'node:assert'
import { loadCatalog } from '../src/catalog.ts'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import type { RunRecord } from '../src/types.ts'
const catalog = await loadCatalog()
const temporary = await temporaryRunner()
const runner = temporary.runner
try {
  const environment = await runner.environment()
  assert.ok(environment.available, environment.detail)
  const results: unknown[] = []
  for (const e of catalog.lessons.flatMap((l) => l.exercises).filter((e) => e.runtimeKey)) {
    const make = (code: string): RunRecord => ({
      id: randomUUID(),
      exerciseId: e.id,
      code,
      contentVersion: catalog.version,
      testVersion: e.testVersion,
      seed: 42,
      config: {},
      environment: '',
      run_status: 'queued',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: '',
      help: 'none',
    })
    const start = Date.now()
    const r = await runner.execute(make(e.reference), e, new AbortController().signal)
    results.push({
      id: e.id,
      status: r.run_status,
      check: r.check_status,
      ms: Date.now() - start,
      events: r.events,
      log: r.log,
      reason: r.reason,
    })
    console.log(e.id, r.run_status, r.check_status, r.reason ?? '')
    assert.equal(r.run_status, 'completed', JSON.stringify(r))
    assert.equal(r.check_status, 'passed', JSON.stringify(r))
    if (e.runtimeKey === 'mlp' || e.runtimeKey === 'lm') {
      const repeat = await runner.execute(make(e.reference), e, new AbortController().signal)
      assert.equal(repeat.check_status, 'passed')
      assert.deepEqual(
        repeat.events.filter((e) => e.type !== 'artifact').map(({ runId, ...event }) => event),
        r.events.filter((e) => e.type !== 'artifact').map(({ runId, ...event }) => event),
      )
      console.log(e.id, 'fixed-seed reproducibility verified')
    }
    if (e.kind === 'code') {
      const wrong = await runner.execute(make(e.starter), e, new AbortController().signal)
      assert.equal(wrong.run_status, 'completed', JSON.stringify(wrong))
      assert.equal(wrong.check_status, 'failed')
      assert.ok(wrong.events.some((e) => e.type === 'check' && e.passed === false))
    }
  }
  await mkdir('tests/results', { recursive: true })
  await writeFile(
    'tests/results/reference-runs.json',
    JSON.stringify({ environment, results }, null, 2),
  )
  console.log('All references and incomplete starters verified')
} finally {
  await temporary.cleanup()
}
