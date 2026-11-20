import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { Engine } from '../src/engine.ts'
import { acquireOwner } from '../src/owner.ts'
import { resolveResourceEnvelope, type RunnerBackend } from '../src/runner.ts'
import { Store } from '../src/store.ts'
import type { EnvironmentStatus, Exercise, RunRecord } from '../src/types.ts'

class MockRunner implements RunnerBackend {
  readonly runnerProfile = 'cpu' as const
  async environment(): Promise<EnvironmentStatus> {
    return {
      stage: 'ready',
      available: true,
      image: 'mock-image:0.1',
      resolvedImageId: 'sha256:' + 'a'.repeat(64),
      hostCpus: 8,
      estimatedImageSizeGb: 1.34,
      prepareCommand: 'echo ready',
      detail: { zh: '就绪', en: 'Ready' },
    }
  }
  async execute(run: RunRecord, exercise: Exercise): Promise<RunRecord> {
    return {
      ...run,
      run_status: 'completed',
      check_status: 'passed',
      finishedAt: new Date().toISOString(),
      events: [
        {
          runId: run.id,
          seq: 1,
          type: 'check',
          name: 'mock_step',
          step: exercise.steps?.[0]?.name ?? 'step1',
          passed: true,
          detail: 'ok',
        },
        {
          runId: run.id,
          seq: 2,
          type: 'roofline_point',
          name: 'Mock Dot Product',
          arithmeticIntensity: 0.25,
          gflops: 12.4,
          bandwidthGBps: 49.6,
        },
      ],
    }
  }
  async recover(): Promise<void> {}
}

describe('Store, Owner lock, ResourceProfile, and Engine workflow', () => {
  it('rejects foreign SQLite databases and prevents concurrent owners', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-infra-store-'))
    try {
      const foreignPath = join(dir, 'foreign.sqlite')
      const foreign = new DatabaseSync(foreignPath)
      foreign.exec('PRAGMA application_id=1313620290; PRAGMA user_version=1;')
      foreign.close()
      assert.throws(() => new Store(foreignPath), /belongs to another application/)

      const lockPath = join(dir, 'owner.sqlite')
      const release = await acquireOwner(lockPath)
      await assert.rejects(() => acquireOwner(lockPath), /already has an active owner/)
      await release()
      const release2 = await acquireOwner(lockPath)
      await release2()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('computes distinct container resource envelopes for scalar, multicore, and distributed-gloo', () => {
    const scalar = resolveResourceEnvelope('scalar-cpu', 12, 4)
    assert.equal(scalar.cpus, 1)
    assert.equal(scalar.pidsLimit, 64)
    assert.equal(scalar.shmMb, undefined)

    const multi = resolveResourceEnvelope('multicore-cpu', 12, 4)
    assert.equal(multi.cpus, 4)
    assert.equal(multi.pidsLimit, 128)

    const gloo = resolveResourceEnvelope('distributed-gloo', 12, 4)
    assert.equal(gloo.cpus, 4)
    assert.equal(gloo.pidsLimit, 256)
    assert.equal(gloo.shmMb, 256)
    assert.ok(gloo.extraEnv.includes('GLOO_SOCKET_IFNAME=lo'))
  })

  it('validates predictions, CAS revisions, fast-track skip, simulator completion, roofline projection, and archive roundtrip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ai-infra-engine-'))
    let engine: Engine | undefined
    try {
      engine = await Engine.open(dir, 'mock-image:0.1', {}, new MockRunner())
      const ov = engine.overview()
      assert.ok(ov.catalog.lessons.length >= 8)

      // Draft CAS revision enforcement
      const firstCodeEx = ov.catalog.lessons.flatMap((l) => l.exercises).find((e) => e.kind === 'code')!
      const rev1 = engine.saveDraft(firstCodeEx.id, '# edit 1\n', 0)
      assert.equal(rev1, 1)
      assert.throws(() => engine!.saveDraft(firstCodeEx.id, '# stale edit\n', 0), /Draft conflict/)

      // Prediction requirement enforcement on prediction-gated exercises
      const predEx = ov.catalog.lessons
        .flatMap((l) => l.exercises)
        .find((e) => e.kind === 'code' && e.requiresPrediction)!
      await assert.rejects(() => engine!.start(predEx.id, predEx.starter, {}), /prediction/i)

      const started = await engine.start(predEx.id, predEx.starter, { seed: 7 }, 'Vectorized will be >10x faster')
      const finished = await engine.waitRun(started.id)
      assert.equal(finished.check_status, 'passed')
      assert.equal(engine.overview().measuredRooflinePoints.length, 1)

      // A01 Fast-track quiz unlocks fastTrackedLessons
      const fastQuiz = engine.catalog.lessons
        .flatMap((l) => l.exercises)
        .find((e) => e.kind === 'quiz' && e.fastTrackSkipLesson)!
      const quizRes = engine.answer(fastQuiz.id, fastQuiz.quiz!.correctOptionId)
      assert.equal(quizRes.status, 'passed')
      assert.ok(engine.overview().fastTrackedLessons.includes(fastQuiz.lessonId))

      // Simulator completion check
      const bitSim = engine.catalog.lessons
        .flatMap((l) => l.exercises)
        .find((e) => e.kind === 'simulator' && e.simulator?.widget === 'bit-layout')!
      assert.equal(
        engine.completeSimulator(bitSim.id, JSON.stringify({ formatsVisited: ['fp16'], bitFlips: 0 })).status,
        'failed',
      )
      assert.equal(
        engine.completeSimulator(bitSim.id, JSON.stringify({ formatsVisited: ['fp16', 'bf16'], bitFlips: 2 }))
          .status,
        'passed',
      )

      // Export & import into fresh dataRoot
      const archive = engine.exportData()
      await engine.close()
      engine = undefined

      const dir2 = await mkdtemp(join(tmpdir(), 'ai-infra-import-'))
      try {
        const engine2 = await Engine.open(dir2, 'mock-image:0.1', {}, new MockRunner())
        const imported = engine2.importData(archive)
        assert.ok(imported.importedRuns >= 1)
        assert.ok(imported.importedEvidence >= 2)
        await engine2.close()
      } finally {
        await rm(dir2, { recursive: true, force: true })
      }
    } finally {
      await engine?.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})
