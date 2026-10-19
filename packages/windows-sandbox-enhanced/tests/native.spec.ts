import { it, expect, describe } from 'vitest'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, mkdtemp, writeFile, mkdir, rm, symlink, link } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { scanNative, recoveryPlan } from '../src/audit.ts'

const base = resolve('.build/sandbox-enhanced/fixtures')
const executable = resolve('packages/windows-sandbox-enhanced/native/runtime/DshSandboxAudit.exe')
const options = async () => ({ executable, sha256: createHash('sha256').update(await readFile(executable)).digest('hex') })
async function fixture(run: (directory: string) => Promise<void>) {
  await mkdir(base, { recursive: true }); const directory = await mkdtemp(join(base, 'audit-'))
  try { await run(directory) } finally {
    if (!resolve(directory).startsWith(base + '\\')) throw Error('Fixture cleanup escaped test root')
    await rm(directory, { recursive: true, force: true })
  }
}
describe.skipIf(process.platform !== 'win32')('native read-only Windows audit', () => {
  it('reads descriptors and object identity without changing them', async () => fixture(async directory => {
    await writeFile(join(directory, 'sample.txt'), 'content')
    const first = await scanNative(await options(), directory), second = await scanNative(await options(), directory)
    expect(first.complete).toBe(true); expect(first.entries).toHaveLength(2)
    expect(first.entries.map(e => [e.identity, e.descriptorHash])).toEqual(second.entries.map(e => [e.identity, e.descriptorHash]))
    expect(recoveryPlan(first, second).items.every(i => i.disposition === 'unchanged')).toBe(true)
    expect(await readFile(join(directory, 'sample.txt'), 'utf8')).toBe('content')
  }))
  it('finds inherited Low labels in a disposable fixture only', async context => fixture(async directory => {
    // This test deliberately labels ONLY the fresh test directory, never the
    // repository, system Temp, or a user workspace. Cleanup removes this fixture.
    const before = await scanNative(await options(), directory)
    try { execFileSync('icacls.exe', [directory, '/setintegritylevel', '(OI)(CI)L'], { windowsHide: true, stdio: 'pipe' }) }
    catch (error) {
      // Strict qualification must fail. Local capability runs explicitly report
      // this as skipped, never as a successful Low IL reproduction.
      if (process.env.DSH_SANDBOX_REQUIRE_LABEL_TEST === '1') throw error
      context.skip('Windows refused labeling the fresh fixture; rerun strict qualification on the dedicated test machine')
    }
    await writeFile(join(directory, 'generated.txt'), 'fixture')
    const report = await scanNative(await options(), directory)
    expect(report.complete).toBe(true)
    expect(report.entries.find(e => e.path.endsWith('generated.txt'))?.integrityRid).toBe(4096)
    expect(report.entries.find(e => e.path === directory)?.labelInheritable).toBe(true)
    expect(before.entries[0]!.identity).toBe(report.entries[0]!.identity)
  }))
  it('does not traverse a junction outside the selected root', async () => fixture(async directory => {
    const inside = join(directory, 'inside'), outside = join(directory, 'outside')
    await mkdir(inside); await mkdir(outside); await writeFile(join(outside, 'secret.txt'), 'not scanned')
    await symlink(outside, join(inside, 'alias'), 'junction')
    const report = await scanNative(await options(), inside)
    expect(report.entries.some(e => e.path.endsWith('secret.txt'))).toBe(false)
    expect(report.entries.some(e => e.reparsePoint)).toBe(true)
  }))
  it('detects hardlink aliases and refuses automatic recovery', async () => fixture(async directory => {
    const path = join(directory, 'one.txt'); await writeFile(path, 'hardlink'); await link(path, join(directory, 'two.txt'))
    const report = await scanNative(await options(), directory)
    expect(report.entries.filter(e => !e.directory).every(e => e.links === 2)).toBe(true)
    expect(recoveryPlan(report, report).items.filter(e => e.path.endsWith('.txt')).every(e => e.reasons.includes('HARDLINK_ALIASES'))).toBe(true)
  }))
  it('reports bounded traversal as incomplete', async () => fixture(async directory => {
    await writeFile(join(directory, 'one.txt'), 'one'); await writeFile(join(directory, 'two.txt'), 'two')
    const report = await scanNative({ ...await options(), maxEntries: 1 }, directory)
    expect(report.complete).toBe(false); expect(report.entries).toHaveLength(1)
  }))
  it('refuses a modified helper and an already cancelled scan', async () => fixture(async directory => {
    await expect(scanNative({ executable, sha256: '0'.repeat(64) }, directory)).rejects.toThrow('HELPER_HASH_MISMATCH')
    const signal = AbortSignal.abort(); await expect(scanNative(await options(), directory, signal)).rejects.toThrow()
  }))
})

describe('isolated Windows worker qualification — environment required', () => {
  it.todo('EXE writes only its private Temp/AppData and exported artifacts have correct host IL')
  it.todo('parent FILE_DELETE_CHILD cannot delete outside workspace')
  it.todo('junction/hardlink replacement races cannot escape publication')
  it.todo('Terminal and PTC control pipes remain isolated under mode changes')
  it.todo('host/worker/broker crash drains all descendants and preserves pending publication')
  it.todo('external subagents and every executable path pass the same negative tests')
  it.todo('official Desktop file views agree with isolated workspace')
  it.todo('Plugins install/update/disable/uninstall leave no active execution')
})

it.skipIf(process.platform !== 'win32')('reports a junction root as incomplete rather than certifying its target', async () => fixture(async directory => {
  const real=join(directory,'real'), alias=join(directory,'alias');await mkdir(real)
  await writeFile(join(real,'not-scanned.txt'),'fixture');await symlink(real,alias,'junction')
  const report=await scanNative(await options(),alias)
  expect(report.complete).toBe(false)
  expect(report.failures.some(f=>f.code==='REPARSE_NOT_TRAVERSED')).toBe(true)
  expect(report.entries.some(e=>e.path.endsWith('not-scanned.txt'))).toBe(false)
}))
