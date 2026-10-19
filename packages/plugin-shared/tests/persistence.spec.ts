import { expect, it, onTestFinished } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PreferenceStore } from '../src/state.ts'
import { writeFileDurable, ensureDurableDirectory } from '../src/durable-file.ts'

it('serializes independent preference owners and refuses stale revisions or missing committed state', async () => {
  const home = await mkdtemp(join(tmpdir(), 'plugin-preferences-cas-'))
  const a = new PreferenceStore(home), b = new PreferenceStore(home)
  onTestFinished(async () => { await a.close(); await b.close(); await rm(home, { recursive: true, force: true }) })
  await Promise.all([a.open(), b.open()])
  const results = await Promise.allSettled([a.save({ ...a.value, pets: true }), b.save({ ...b.value, pets: false })])
  expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter(row => row.status === 'rejected')).toHaveLength(1)
  const cold = new PreferenceStore(home); await cold.open()
  expect(cold.value.revision).toBe(1)
  await rm(join(home, 'preferences.json'))
  await expect(cold.save(cold.value)).rejects.toThrow('PREFERENCES_MISSING')
  expect(await readdir(home)).not.toContain('preferences.json')
})

it('publishes complete durable replacements and removes temporary siblings', async () => {
  const home = await mkdtemp(join(tmpdir(), 'plugin-durable-file-'))
  onTestFinished(() => rm(home, { recursive: true, force: true }))
  const nested = join(home, 'new', 'v2')
  await ensureDurableDirectory(nested)
  await ensureDurableDirectory(nested)
  const path = join(nested, 'current.json')
  await writeFileDurable(path, 'first')
  await writeFileDurable(path, 'second')
  expect(await readFile(path, 'utf8')).toBe('second')
  expect(await readdir(nested)).toEqual(['current.json'])
  expect(await readdir(join(home, 'new'))).toEqual(['v2'])
})
