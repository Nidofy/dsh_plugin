/** Hash-verified official source in a new directory; never extracts over rc.2 or a working tree. */
import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile, symlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import * as tar from 'tar'
const root = resolve(import.meta.dirname, '..')
const config = JSON.parse(await readFile(join(root, 'tools/compatibility/ai-village-rc3.json'), 'utf8'))
const archive = process.env.DSH_VILLAGE_RC3_ARCHIVE
assert.ok(archive, 'Set DSH_VILLAGE_RC3_ARCHIVE to the official commit codeload archive')
assert.equal(createHash('sha256').update(await readFile(archive)).digest('hex'), config.officialArchiveSha256, 'Official archive digest mismatch')
const runtime = join(root, '.build/official-runtime-rc3')
assert.equal(JSON.parse(await readFile(join(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8')).version, config.dshVersion, 'Prepare the rc.3 runtime first')
const out = join(root, '.build/ai-village-rc3-source')
await mkdir(out, { recursive: true })
const source = await mkdtemp(join(out, 'official-'))
await tar.x({ file: archive, cwd: source, strip: 1 })
assert.equal(JSON.parse(await readFile(join(source, 'package.json'), 'utf8')).version, config.dshVersion)
await symlink(join(runtime, 'node_modules'), join(source, 'node_modules'), 'junction')
const baseline = { source, revision: config.originalRevision, archiveHash: config.officialArchiveSha256 }
await writeFile(join(out, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n')
console.log(JSON.stringify(baseline, null, 2))
