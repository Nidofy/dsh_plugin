import { temporaryDirectory } from './temporary-directory.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { Store } from '../src/store.ts'
import { acquireOwner } from '../src/owner.ts'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
test('draft and note CAS survive reopening; interrupted tasks retain snapshots', async () => {
  const temporary = await temporaryDirectory('neural-store-')
  const dir = temporary.directory
  try {
    let store = new Store(join(dir, 'lab.db'))
    assert.equal(store.saveDraft('e', 'first', 0), 1)
    assert.throws(() => store.saveDraft('e', 'stale', 0), /conflict/)
    store.saveDraft('note:e', 'notes', 0)
    store.putRun({
      id: 'run',
      exerciseId: 'e',
      code: 'original',
      contentVersion: '0.1.0',
      testVersion: '1',
      seed: 42,
      config: {},
      environment: 'test',
      run_status: 'running',
      check_status: 'not_run',
      createdAt: new Date().toISOString(),
      events: [],
      log: 'log',
      help: 'none',
    })
    store.record('e', 'hint', 'answer')
    assert.equal(store.help('e'), 'answer')
    store.beginIndependent('e')
    assert.equal(store.help('e'), 'none')
    store.close()
    store = new Store(join(dir, 'lab.db'))
    assert.equal(store.draft('e')?.code, 'first')
    assert.equal(store.draft('note:e')?.code, 'notes')
    assert.equal(store.run('run').run_status, 'interrupted')
    assert.equal(store.run('run').code, 'original')
    assert.equal(store.run('run').contentVersion, '0.1.0')
    assert.equal(store.run('run').effectiveConfig, undefined)
    assert.equal(Object.hasOwn(store.run('run'), 'effectiveConfig'), false)
    assert.equal(JSON.parse(store.export()).schemaVersion, 1)
    store.close()
  } finally {
    await temporary.cleanup()
  }
})
test('active owner prevents competing startup', async () => {
  const temporary = await temporaryDirectory('neural-owner-')
  const dir = temporary.directory
  try {
    const release = await acquireOwner(join(dir, 'owner'))
    await assert.rejects(acquireOwner(join(dir, 'owner')), /active owner/)
    await release()
    await (
      await acquireOwner(join(dir, 'owner'))
    )()
  } finally {
    await temporary.cleanup()
  }
})
test('crashed ownership is recovered transactionally and foreign schemas are preserved', async () => {
  const temporary = await temporaryDirectory('neural-recovery-')
  const dir = temporary.directory
  try {
    const path = join(dir, 'owner')
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import {acquireOwner} from ${JSON.stringify(new URL('../src/owner.ts', import.meta.url).href)};await acquireOwner(${JSON.stringify(path)});`,
      ],
      { encoding: 'utf8', windowsHide: true },
    )
    assert.equal(child.status, 0, child.stderr)
    const release = await acquireOwner(path)
    await assert.rejects(acquireOwner(path), /active owner/)
    await release()
    const legacyStore = new Store(join(dir, 'legacy'))
    const old = {
      exerciseId: 'L01-code',
      kind: 'implementation',
      help: 'concept',
      result: 'passed',
      source: 'program',
      concept: 'L01',
      at: '2026-10-31',
    }
    legacyStore.record('L01-code', 'evidence', old)
    legacyStore.record('L01-code', 'hint', 'concept')
    legacyStore.close()
    const opened = new Store(join(dir, 'legacy'))
    try {
      assert.deepEqual(opened.history('L01-code', 'evidence'), [old])
      assert.deepEqual(opened.evidence(), [{ ...old, provenance: 'legacy' }])
      assert.deepEqual(JSON.parse(opened.export()).evidence, opened.evidence())
      assert.equal(opened.help('L01-code'), 'concept')
    } finally {
      opened.close()
    }
    const foreign = join(dir, 'foreign')
    let db = new DatabaseSync(foreign)
    db.exec("CREATE TABLE notes(body TEXT); INSERT INTO notes VALUES ('preserve me')")
    db.close()
    assert.throws(() => new Store(foreign), /unrecognized/)
    db = new DatabaseSync(foreign)
    assert.equal(db.prepare('SELECT body FROM notes').get()?.body, 'preserve me')
    db.close()
  } finally {
    await temporary.cleanup()
  }
})
