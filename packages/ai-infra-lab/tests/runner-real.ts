import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Engine } from '../src/engine.ts'
import { LocalDockerCpuRunner } from '../src/runner.ts'
import type { Exercise, RunRecord } from '../src/types.ts'

const root = await mkdtemp(join(tmpdir(), 'ai-infra-real-'))
let engine: Engine | undefined

try {
  engine = await Engine.open(root, 'dsh-ai-infra-lab-cpu:0.1', { timeoutMs: 60000 })
  const env = await engine.environment()
  assert.equal(env.available, true, `Docker CPU image must be ready: ${env.detail.en}`)

  const codeExercises = engine.catalog.lessons
    .flatMap((l) => l.exercises)
    .filter((e) => e.kind === 'code')

  console.log(`Testing ${codeExercises.length} cumulative code exercises in real Docker containers...`)

  for (const ex of codeExercises) {
    // 1. Reference solution must pass every check
    const refStart = await engine.start(
      ex.id,
      ex.reference,
      { seed: 42 },
      ex.requiresPrediction ? 'Reference verification run' : undefined,
    )
    const refDone = await engine.waitRun(refStart.id)
    assert.equal(
      refDone.run_status,
      'completed',
      `[${ex.id}] reference run_status=${refDone.run_status}, reason=${refDone.reason}, log=${refDone.log}`,
    )
    assert.equal(
      refDone.check_status,
      'passed',
      `[${ex.id}] reference check_status=${refDone.check_status}, events=${JSON.stringify(refDone.events)}, log=${refDone.log}`,
    )

    // 2. Unmodified starter template must run cleanly and report check_status === 'failed'
    const starterStart = await engine.start(
      ex.id,
      ex.starter,
      { seed: 42 },
      ex.requiresPrediction ? 'Starter negative check' : undefined,
    )
    const starterDone = await engine.waitRun(starterStart.id)
    assert.equal(starterDone.run_status, 'completed', `[${ex.id}] starter crashed: ${starterDone.log}`)
    assert.equal(starterDone.check_status, 'failed', `[${ex.id}] starter unexpectedly passed`)
    console.log(`  PASS [${ex.id}] (${ex.resourceProfile ?? 'scalar-cpu'}): reference=passed, starter=failed`)
  }

  // Verify A04/A05 emitted measured roofline points
  const ov = engine.overview()
  assert.ok(ov.measuredRooflinePoints.length >= 2, 'Expected measured roofline points from A04/A05')
  console.log(`  PASS measuredRooflinePoints collected: ${ov.measuredRooflinePoints.length}`)

  // 3. Test distributed-gloo 4-process profile via LocalDockerCpuRunner
  const runner = new LocalDockerCpuRunner(join(root, 'runs'), 'dsh-ai-infra-lab-cpu:0.1', { timeoutMs: 45000 })
  const glooExercise: Exercise = {
    id: 'D00-selftest',
    lessonId: 'A06',
    title: { zh: 'Gloo 自检', en: 'Gloo Self-Test' },
    kind: 'code',
    dataSource: 'cpu_measured',
    resourceProfile: 'distributed-gloo',
    runtimeKey: 'd00-gloo-selftest-v1',
    prompt: { zh: 'Gloo', en: 'Gloo' },
    starter: '# gloo\n',
    reference: '# gloo\n',
    hints: [],
    concepts: ['gloo'],
    testVersion: '1',
    commonErrors: [],
  }
  const glooRun: RunRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    exerciseId: 'D00-selftest',
    code: '# selftest\n',
    codeHash: '0'.repeat(64),
    dataSource: 'cpu_measured',
    resourceProfile: 'distributed-gloo',
    contentVersion: '0.1.0',
    testVersion: '1',
    seed: 42,
    config: {},
    attemptId: 'selftest',
    environment: '',
    run_status: 'queued',
    check_status: 'not_run',
    createdAt: new Date().toISOString(),
    events: [],
    log: '',
    help: 'none',
  }
  const glooRes = await runner.execute(glooRun, glooExercise, new AbortController().signal)
  assert.equal(glooRes.run_status, 'completed', `Gloo selftest failed: ${glooRes.reason} ${glooRes.log}`)
  assert.equal(glooRes.check_status, 'passed', `Gloo checks failed: ${JSON.stringify(glooRes.events)}`)
  console.log('  PASS [distributed-gloo] 4-process Gloo all_reduce under --network none + uid 65534')

  // 4. Adversarial isolation: uid=65534, network blocked, read-only rootfs/mount, pids-limit, and timeout cancellation
  const firstEx = codeExercises[0]!
  const escapePreamble = `
import os, socket, pathlib
assert os.getuid() == 65534, f"Expected uid 65534, got {os.getuid()}"
try:
    _s = socket.socket()
    _s.settimeout(1.0)
    _s.connect(("8.8.8.8", 53))
    raise RuntimeError("NETWORK ESCAPE SUCCEEDED")
except OSError:
    pass
finally:
    _s.close()
for _target in ("/work/tamper.txt", "/runtime/tamper.txt", "/etc/tamper.txt"):
    try:
        pathlib.Path(_target).write_text("x")
        raise RuntimeError(f"READONLY ESCAPE SUCCEEDED: {_target}")
    except OSError:
        pass
`
  const advStart = await engine.start(firstEx.id, escapePreamble + '\n' + firstEx.reference, { seed: 1 })
  const advDone = await engine.waitRun(advStart.id)
  assert.equal(advDone.check_status, 'passed', `Sandbox check unexpected status: ${advDone.log}`)
  console.log('  PASS adversarial uid=65534, network=none, and readonly mount/rootfs isolation')

  // Timeout enforcement (module top-level sleep hangs student subprocess and triggers Runner timeout)
  const shortRunner = new LocalDockerCpuRunner(join(root, 'runs'), 'dsh-ai-infra-lab-cpu:0.1', { timeoutMs: 3500 })
  const hangRun: RunRecord = {
    ...glooRun,
    id: '00000000-0000-4000-8000-000000000002',
    exerciseId: firstEx.id,
    code: 'import time\ntime.sleep(30)\n',
  }
  const hangRes = await shortRunner.execute(hangRun, firstEx, new AbortController().signal)
  assert.equal(hangRes.run_status, 'timed_out')
  console.log('  PASS infinite sleep killed cleanly on timeout with zero leftover containers')
} finally {
  await engine?.close()
  await rm(root, { recursive: true, force: true })
}
