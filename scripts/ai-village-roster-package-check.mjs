/** Read-only archive comparison against a recorded production QA snapshot (no install). */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { resolve, join, relative } from 'node:path'
import { createHash } from 'node:crypto'
import * as tar from 'tar'
import { resources } from '../packages/ai-village/src/definitions.ts'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const option = name => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3)
const label = option('label'); assert.match(label ?? '', /^[a-zA-Z0-9][a-zA-Z0-9-]{0,80}$/)
const archive = resolve(root, option('archive') ?? 'dist/nidofy-dsh-ai-village-0.10.0-preview.1.tgz')
const qa = option('qa') ? resolve(root, option('qa')) : null
const output = join(pkg, 'art/QA/roster-production/package-' + label)
assert.equal(await stat(output).then(() => true).catch(() => false), false, 'Keep previous package evidence')
await mkdir(output, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const entries = new Map(), jobs = []
await tar.t({ file: archive, onentry(entry) {
  if (entry.type !== 'File') return
  const name = entry.path.replace(/^package\//, ''), chunks = [], digest = createHash('sha256')
  jobs.push(new Promise((done, reject) => {
    entry.on('data', bytes => { digest.update(bytes); if (name.endsWith('.json')) chunks.push(bytes) })
    entry.on('error', reject)
    entry.on('end', () => { assert.ok(!entries.has(name), 'Duplicate archive file: ' + name); entries.set(name, { bytes: entry.size, sha256: digest.digest('hex'), ...(chunks.length ? { json: Buffer.concat(chunks).toString('utf8') } : {}) }); done() })
  }))
} })
await Promise.all(jobs)
const metadata = JSON.parse(entries.get('package.json').json)
const source = qa ? JSON.parse(await readFile(join(qa, 'build.json'), 'utf8')) : null
const validation = qa ? JSON.parse(await readFile(join(qa, 'validation.json'), 'utf8')) : null
if (source) assert.equal(metadata.version, source.version, 'Archive version differs from recorded browser QA')
const assets = source?.assetHashes ?? Object.fromEntries(await Promise.all((await readdir(join(pkg, 'assets'), { recursive: true })).filter(file => /\.(png|json)$/.test(file)).map(async file => [file.replaceAll('\\', '/'), hash(await readFile(join(pkg, 'assets', file)))])))
for (const [file, sha256] of Object.entries(assets)) assert.equal(entries.get('assets/' + file)?.sha256, sha256, file)
for (const resource of resources) {
  const entry = entries.get('assets/' + resource.file)
  assert.equal(entry?.sha256, resource.sha256, resource.key); assert.equal(entry.bytes, resource.bytes, resource.key)
}
const characters = []
for (const id of ['seedance', 'glm', 'minimax', 'llama', 'mistral']) {
  const prefix = `assets/characters/${id}/`, manifest = JSON.parse(entries.get(prefix + 'manifest.json').json)
  assert.equal(manifest.approvedForRelease, true); assert.equal(manifest.parts.length, 16)
  for (const part of [...manifest.parts, ...manifest.definitions]) assert.equal(entries.get(prefix + part.file)?.sha256, part.sha256, id + '/' + part.file)
  for (const part of manifest.parts) assert.equal(entries.get(prefix + part.file)?.sha256, hash(await readFile(join(pkg, 'art/deliverables/roster-expansion/characters', id, part.file))))
  characters.push({ id, parts: manifest.parts.length, definitions: manifest.definitions.length, portrait: entries.get(`assets/portraits/${id}.png`)?.sha256 })
}
const bundles = {}
for (const file of ['index.js', 'client.js', 'frame.js']) {
  const expected = validation?.bundles[file] ?? hash(await readFile(join(pkg, 'lib', file)))
  bundles[file] = { sha256: entries.get('lib/' + file)?.sha256, matches: entries.get('lib/' + file)?.sha256 === expected }
  if (qa) assert.equal(bundles[file].matches, true, 'Archive differs from recorded browser bundle: ' + file)
}
const bytes = await readFile(archive)
const result = { recordedAt: new Date().toISOString(), archive: relative(root, archive).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes), version: metadata.version, totalFiles: entries.size,
  comparedAssets: Object.keys(assets).length, runtimeResources: resources.length, characters, bundles,
  qa: qa && relative(root, qa).replaceAll('\\', '/'), scope: qa ? 'Exact asset and three runtime bundle matches to the recorded browser QA snapshot' : 'Current workspace asset closure only; no browser QA identity claim', installTest: false }
await writeFile(join(output, 'validation.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
