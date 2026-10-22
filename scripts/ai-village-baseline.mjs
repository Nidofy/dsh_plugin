import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import * as tar from 'tar'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = join(root, '.build/ai-village-v0.4-qa/m01'), fixtures = join(pkg, 'tests/fixtures/legacy')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(out, { recursive: true })
if (process.argv[2] === 'freeze') {
  // Only previous test profiles in .build; never inspect a user's Desktop profile.
  const chosen = new Map()
  for (const directory of ['ai-village-phase3', 'ai-village-phase4', 'ai-village-v0.3-qa']) {
    const base = join(root, '.build', directory)
    for (const relative of await readdir(base, { recursive: true })) if (/snapshots[\\/].+\.json$/.test(relative)) {
      const bytes = await readFile(join(base, relative))
      let value; try { value = JSON.parse(bytes) } catch { continue }
      if (![1, 2, 3].includes(value.world?.schemaVersion) || value.world.sceneVersion !== 1 || value.world.worldId !== 'bluewhale-courtyard') continue
      if (Object.keys(value).some(k => !['revision', 'operationId', 'world'].includes(k))) continue
      const schema = value.world.schemaVersion, count = 1 + (value.world.companions?.length ?? 0)
      if (count > (chosen.get(schema)?.count ?? 0)) chosen.set(schema, { bytes, count, source: '.build/' + directory + '/' + relative.replaceAll('\\', '/') })
    }
  }
  assert.equal(chosen.size, 3, 'Historical test snapshots for all three schemas are required')
  await mkdir(fixtures, { recursive: true })
  const manifest = []
  for (const [schema, row] of [...chosen].sort()) {
    const file = `saved-schema${schema}.json`
    await writeFile(join(fixtures, file), row.bytes, { flag: 'wx' })
    manifest.push({ file, sha256: sha(row.bytes), source: row.source, actors: row.count, provenance: 'Prior isolated browser/storage acceptance profile; exact snapshot bytes, no user profile' })
  }
  const bytes = await readFile(join(pkg, 'assets/scenes/courtyard/scene.json'))
  await writeFile(join(fixtures, 'scene-v1.json'), bytes, { flag: 'wx' })
  manifest.push({ file: 'scene-v1.json', sha256: sha(bytes), source: 'packages/ai-village/assets/scenes/courtyard/scene.json at baseline 301cc0f' })
  await writeFile(join(fixtures, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
}
const manifest = JSON.parse(await readFile(join(fixtures, 'manifest.json'), 'utf8'))
for (const row of manifest) assert.equal(sha(await readFile(join(fixtures, row.file))), row.sha256, row.file)
const info = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'))
const archive = join(root, 'dist', `nidofy-dsh-ai-village-${info.version}.tgz`), archiveBytes = await readFile(archive)
const entryHashes = new Map()
await tar.t({ file: archive, onReadEntry(entry) {
  if (entry.type !== 'File') return
  const hash = createHash('sha256')
  entry.on('data', bytes => hash.update(bytes)); entry.on('end', () => entryHashes.set(entry.path.replace(/^package\//, ''), hash.digest('hex')))
} })
const identity = []
for (const file of ['lib/index.js', 'lib/client.js', 'lib/frame.js', 'assets/scenes/courtyard/scene.json']) {
  const localHash = sha(await readFile(join(pkg, file))), archiveHash = entryHashes.get(file)
  identity.push({ file, localHash, archiveHash, matches: localHash === archiveHash })
}
const report = { capturedAt: new Date().toISOString(), head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  package: { name: info.name, version: info.version, dsh: info.engines.dsh },
  installedDesktop: 'Not inspected; an existing dist archive is not evidence of the installed package',
  archive: { file: 'dist/' + archive.split(/[\\/]/).pop(), bytes: archiveBytes.length, sha256: sha(archiveBytes) }, identity, fixtures: manifest }
await writeFile(join(out, 'baseline.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
