import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { temporaryDirectory } from './temporary-directory.mjs'

const base = resolve(import.meta.dirname, '..')
const stage = await temporaryDirectory('upgrade-020-', join(base, '.build'))
const root = join(stage.directory, 'profile')
async function open(version) {
  const path = join(stage.directory, version)
  const archive = join(base, 'dsh-plugin-neural-lab-' + version + '.tgz')
  for (const file of [
    'lib/index.js',
    'content/catalog.json',
    'content/lectures.json',
    'package.json',
  ]) {
    await mkdir(dirname(join(path, file)), { recursive: true })
    await writeFile(
      join(path, file),
      execFileSync('tar', ['-xOf', archive, 'package/' + file], { windowsHide: true }),
    )
  }
  const { Engine } = await import(pathToFileURL(join(path, 'lib/index.js')).href)
  return Engine.open(root)
}
let engine
try {
  engine = await open('0.1.3')
  const activity = engine.catalog.lessons
    .flatMap((l) => l.exercises)
    .find((e) => e.kind === 'numeric')
  engine.saveDraft(activity.id, 'before upgrade', 0)
  engine.saveNote(activity.id, 'persistent note', 0)
  engine.hint(activity.id, 'concept')
  engine.answer(activity.id, activity.answer)
  engine.saveProfile({ goal: 'learn training' })
  const before = engine.workspace(activity.id)
  const previous = engine.overview()
  await engine.close()
  engine = undefined
  engine = await open('0.2.0')
  assert.deepEqual(engine.workspace(activity.id), before)
  for (const key of ['evidence', 'reviews', 'profile'])
    assert.deepEqual(engine.overview()[key], previous[key])
  assert.equal(engine.workspace('L04-train').revision, 0)
  assert.equal(engine.catalog.version, '0.2.0')
  engine.saveDraft('L04-train', 'my prior MLP', 0)
  engine.saveNote('L04-train', 'holdout note', 0)
  engine.store.putRun({
    id: 'upgrade-mlp',
    exerciseId: 'L04-train',
    contentVersion: '0.2.0',
    testVersion: '1',
    code: 'my prior MLP',
    prediction: 'lower error',
    seed: 42,
    config: { learningRate: 0.05 },
    help: 'none',
    environment: 'fixture',
    createdAt: new Date().toISOString(),
    events: [],
    log: '',
    run_status: 'completed',
    check_status: 'passed',
  })
  engine.answer('L04-train', 'prediction explained', 'upgrade-mlp')
  const oldMLP = engine.workspace('L04-train')
  const oldOverview = engine.overview()
  await engine.close()
  engine = undefined
  engine = await open('0.2.1')
  assert.deepEqual(engine.workspace('L04-train'), oldMLP)
  assert.deepEqual(engine.workspace(activity.id), before)
  for (const key of ['evidence', 'reviews', 'profile'])
    assert.deepEqual(engine.overview()[key], oldOverview[key])
  assert.equal(engine.workspace('L12-transformer').revision, 0)
  console.log('PASS packaged 0.2.0 to 0.2.1 preserves MLP run, prediction, reflection and review')
  console.log(
    'PASS 0.1.3 packaged host to 0.2.0 packaged host; SQLite draft, note, answer, help, reviews, profile and evidence preserved',
  )
} finally {
  try {
    await engine?.close()
  } finally {
    await stage.cleanup()
  }
}
