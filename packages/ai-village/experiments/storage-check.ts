import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { withWorldOwner, worldPath, readWorld, saveWorld } from './storage.ts'

// Both processes execute this same built file. All fixtures live in the ignored build directory.
if (process.argv[2] === 'contender') {
  try {
    const world = await withWorldOwner(process.argv[3]!, () => readWorld(process.argv[3]!))
    process.send?.({ acquired: true, revision: world?.revision })
  } catch (error) {
    process.send?.({ acquired: false, reason: String(error) })
  }
  process.disconnect?.()
} else {
  const root = await mkdtemp(join(process.argv[2]!, 'profiles-'))
  await Promise.all(['a', 'b'].map(name => mkdir(join(root, name))))
  const a = await worldPath({ dir: join(root, 'a') })
  const b = await worldPath({ dir: join(root, 'b') })
  assert.notEqual(a, b)
  const contender = () => new Promise<{ acquired: boolean; reason?: string; revision?: number }>((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'contender', a], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true })
    let result: { acquired: boolean; reason?: string; revision?: number } | undefined
    let stderr = ''
    const timeout = setTimeout(() => { child.kill(); reject(Error('Contender timeout')) }, 10000)
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('message', message => { result = message as typeof result })
    child.on('error', reject)
    child.on('exit', code => {
      clearTimeout(timeout)
      if (code !== 0 || !result) reject(Error(stderr || 'Contender did not report'))
      else resolve(result)
    })
  })
  await withWorldOwner(a, async () => {
    const blocked = await contender()
    assert.equal(blocked.acquired, false)
    assert.match(blocked.reason!, /timed out waiting/)
    assert.equal(await readWorld(a), null)
    await saveWorld(a, 0, { x: 180, y: 380 })
    const results = await Promise.allSettled([
      saveWorld(a, 1, { x: 200, y: 380 }),
      saveWorld(a, 1, { x: 250, y: 380 }),
    ])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal(results.filter(r => r.status === 'rejected').length, 1)
    assert.equal((await readWorld(a))!.revision, 2)
    assert.equal((await readWorld(a + '.previous'))!.revision, 1)
    await withWorldOwner(b, () => saveWorld(b, 0, { x: 80, y: 300 }))
    assert.equal((await readWorld(b))!.x, 80)
    const stable = await readFile(a)
    await assert.rejects(saveWorld(a, 2, { x: Number.NaN, y: 380 }), /INVALID_SAVE/)
    assert.deepEqual(await readFile(a), stable)
    for (const contents of ['{broken', JSON.stringify({ schemaVersion: 99 }), 'x'.repeat(20000)]) {
      await writeFile(a, contents)
      await assert.rejects(saveWorld(a, 2, { x: 1, y: 1 }))
      assert.equal(await readFile(a, 'utf8'), contents)
      assert.equal((await readWorld(a + '.previous'))!.revision, 1)
    }
    await writeFile(a, stable)
  })
  const restarted = await contender()
  assert.equal(restarted.acquired, true)
  assert.equal(restarted.revision, 2)
  assert.equal((await readWorld(a))!.revision, 2)
  await assert.rejects(worldPath({ dir: 'relative-profile' }), /PROFILE_DIRECTORY_REQUIRED/)
  console.log(JSON.stringify({ passed: true, fixtureRoot: root, checks: [
    'profile directory isolation', 'cross-process lifetime owner excludes contender',
    'owner released after shutdown', 'concurrent CAS accepts one writer', 'restart reads persisted revision',
    'previous snapshot retained', 'nonfinite position rejected', 'broken/future/oversize save never overwritten',
    'relative profile path refused', 'Windows synchronized file publication through existing durable utility',
  ], limitations: ['Not a Host HTTP integration test', 'No power-cut durability claim', 'No client lease/epoch or migration yet'] }, null, 2))
}
