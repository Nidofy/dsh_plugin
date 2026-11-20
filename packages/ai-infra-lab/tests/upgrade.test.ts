import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { it } from 'node:test'
import { Engine } from '../src/engine.ts'

// Frozen schema and serialized values produced by v0.1.0 (145f85e).
// Keep this fixture independent of current Store constructors and serializers.
it('opens and reopens a populated v0.1.0 profile without rewriting learner records', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'infra-upgrade-'))
  const path = join(dir, 'ai-infra-lab.sqlite')
  const at = '2026-11-18T01:02:03.000Z'
  const exerciseId = 'A00-code'
  const id = 'bb52a3ac-0246-45f1-99ee-06804a56578a'
  const code = '# synthetic fixture\n'
  const run = { id, exerciseId, code, codeHash: createHash('sha256').update(code).digest('hex'),
    dataSource: 'cpu_measured', resourceProfile: 'scalar-cpu', contentVersion: '0.1.0', testVersion: '1',
    seed: 42, config: {}, attemptId: 'initial', environment: 'fixture', run_status: 'completed',
    check_status: 'passed', createdAt: at, finishedAt: at, log: '', help: 'none',
    events: [{ runId: id, seq: 1, type: 'check', name: 'greet_machine', passed: true }] }
  const evidence = { id: 'ba94ed52-2425-4ec8-9485-a28412de05bb', runId: id, attemptId: 'initial',
    exerciseId, concept: 'assertion', kind: 'implementation', dataSource: 'cpu_measured', source: 'program',
    help: 'none', result: 'passed', contentVersion: '0.1.0', testVersion: '1', at }
  const reviews = [{ exerciseId, lessonId: 'A00', reason: { zh: '复习', en: 'Review' }, due: at, runId: id }]
  try {
    const db = new DatabaseSync(path)
    db.exec(`CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE drafts(id TEXT PRIMARY KEY, code TEXT NOT NULL, revision INTEGER NOT NULL);
      CREATE TABLE runs(id TEXT PRIMARY KEY, exercise TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE history(seq INTEGER PRIMARY KEY, exercise TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL);
      PRAGMA application_id=1229734210; PRAGMA user_version=1;`)
    db.prepare('INSERT INTO runs VALUES(?,?,?)').run(id, exerciseId, JSON.stringify(run))
    db.prepare('INSERT INTO history VALUES(1,?,?,?,?)').run(exerciseId, 'evidence', JSON.stringify(evidence), at)
    for (const [key, value] of Object.entries({ reviews, currentLesson: 'A01', readLessons: ['A00','A01'],
      fastTrackedLessons: ['A01'], profileRevision: 2, profileScopeId: 'learner-fixture' })) {
      db.prepare('INSERT INTO kv VALUES(?,?)').run(key, JSON.stringify(value))
    }
    db.prepare('INSERT INTO drafts VALUES(?,?,?)').run(exerciseId, code, 7)
    db.prepare('INSERT INTO drafts VALUES(?,?,?)').run('note:'+exerciseId, '合成笔记 · fixture', 3)
    db.close()
    for (let cycle = 0; cycle < 2; cycle++) {
      const engine = await Engine.open(dir)
      try {
        const overview = engine.overview()
        const ws = engine.workspace(exerciseId)
        assert.deepEqual([ws.draft, ws.revision, ws.note, ws.noteRevision], [code, 7, '合成笔记 · fixture', 3])
        assert.deepEqual(ws.runs, [run])
        assert.deepEqual(overview.evidence, [evidence])
        assert.deepEqual(overview.reviews, reviews)
        assert.deepEqual(overview.readLessons, ['A00','A01'])
        assert.deepEqual(overview.fastTrackedLessons, ['A01'])
        assert.equal(overview.currentLesson, 'A01')
        assert.equal(overview.profileId, 'learner-fixture')
        assert.equal(overview.profileRevision, 2)
        assert.equal(engine.store.db.prepare('PRAGMA application_id').get()?.application_id, 1229734210)
      } finally { await engine.close() }
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})
