/** AI Village alone selects this lane; the repository-wide rc.2 baseline is immutable. */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const root = resolve(import.meta.dirname, '..')
export function villageCompatibility(lane = process.env.DSH_VILLAGE_COMPAT ?? (JSON.parse(readFileSync(join(root, 'packages/ai-village/package.json'), 'utf8')).engines.dsh === '0.2.1-rc.3' ? 'rc3' : 'rc2')) {
  assert.ok(['rc2', 'rc3'].includes(lane), 'Unknown AI Village compatibility lane')
  const config = JSON.parse(readFileSync(join(root, lane === 'rc2' ? 'compatibility.json' : 'tools/compatibility/ai-village-rc3.json'), 'utf8'))
  const baseline = JSON.parse(readFileSync(join(root, lane === 'rc2' ? '.build/sandbox-enhanced/baseline.json' : '.build/ai-village-rc3-source/baseline.json'), 'utf8'))
  assert.equal(baseline.revision, config.originalRevision, 'Official source revision mismatch')
  assert.equal(baseline.archiveHash, config.officialArchiveSha256, 'Official source archive mismatch')
  assert.equal(JSON.parse(readFileSync(join(baseline.source, 'package.json'), 'utf8')).version, config.dshVersion)
  const runtime = join(root, lane === 'rc2' ? '.build/official-runtime' : '.build/official-runtime-rc3')
  assert.equal(JSON.parse(readFileSync(join(runtime, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8')).version, config.dshVersion, 'Official runtime mismatch')
  if (lane === 'rc3') {
    for (const file of ['package.json', 'package-lock.json']) assert.deepEqual(readFileSync(join(root, 'tools/official-runtime-rc3', file)), readFileSync(join(runtime, file)), 'Run prepare-runtime-rc3 after changing the runtime lock')
    const identity = JSON.parse(readFileSync(join(runtime, 'identity.json'), 'utf8'))
    assert.equal(identity.lockSha256, createHash('sha256').update(readFileSync(join(runtime, 'package-lock.json'))).digest('hex'), 'Runtime verification identity is stale')
    for (const [name, pkg] of Object.entries(identity.packages)) assert.equal(JSON.parse(readFileSync(join(runtime, 'node_modules', name, 'package.json'), 'utf8')).version, pkg.version, 'Runtime package changed: ' + name)
  }
  return { lane, config, baseline, runtime, out: join(root, lane === 'rc2' ? '.build/ai-village-phase4' : '.build/ai-village-rc3-build') }
}
