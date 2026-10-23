/** Promote the reviewed art delivery into runtime assets without changing source pixels. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const pkg = resolve(import.meta.dirname, '../packages/ai-village')
const ids = ['seedance', 'glm', 'minimax', 'llama', 'mistral']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const portraitPath = join(pkg, 'assets/portraits/manifest.json')
const portraits = JSON.parse(await readFile(portraitPath, 'utf8'))
for (const id of ids) {
  const source = join(pkg, 'art/deliverables/roster-expansion/characters', id)
  const target = join(pkg, 'assets/characters', id)
  const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'))
  assert.equal(manifest.id, id); assert.equal(manifest.status, 'art-reviewed'); assert.equal(manifest.parts.length, 16)
  await mkdir(join(target, 'parts'), { recursive: true })
  for (const entry of [...manifest.parts, ...manifest.definitions]) {
    assert.match(entry.file, /^(parts\/[a-z-]+\.png|character\.json|animations\.json|activities\.json)$/)
    assert.equal(hash(await readFile(join(source, entry.file))), entry.sha256)
    await copyFile(join(source, entry.file), join(target, entry.file))
  }
  manifest.approvedForRelease = true
  manifest.integration = 'Production roster integration; original art review and source hashes retained. See tests/roster-expansion.spec.ts and scripts/ai-village-roster-production-check.mjs.'
  manifest.artReview.evidence = `../../../art/QA/roster-expansion/validation.json`
  await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  const portrait = await readFile(join(source, 'portrait-128.png'))
  const file = `portraits/${id}.png`
  await writeFile(join(pkg, 'assets', file), portrait)
  portraits.files = portraits.files.filter(entry => entry.key !== file)
  portraits.files.push({ key: file, file, bytes: portrait.length, sha256: hash(portrait) })
}
await writeFile(portraitPath, JSON.stringify(portraits, null, 2) + '\n')
console.log('Integrated five reviewed rigs, 80 unchanged parts and five portraits.')
