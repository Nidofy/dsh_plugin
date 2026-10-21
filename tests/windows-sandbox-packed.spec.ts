import { it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import * as tar from 'tar'
import { composeEntries, loadOverlayPatches, initProfile, loadProfile, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'

it('loads packaged Bundles through the official profile composer and keeps diagnostics separate from refusal', async () => {
  const parent = resolve('.build/sandbox-enhanced'); await mkdir(parent, { recursive: true })
  const home = await mkdtemp(join(parent, 'profile-smoke-')), profileDir = resolveProfileDir('qualification', home)
  const names = ['windows-sandbox-enhanced', 'windows-sandbox-guard']
  try {
    initProfile(profileDir, names.map(name => '@dsh-extensions/' + name))
    for (const name of names) {
      const directory = join(profileDir, 'node_modules/@dsh-extensions', name); await mkdir(directory, { recursive: true })
      await tar.x({ file: resolve(`dist/dsh-extensions-${name}-0.1.0-alpha.2.tgz`), cwd: directory, strip: 1 })
    }
    const anchor = join(home, 'installation/package.json'); await mkdir(join(home, 'installation'), { recursive: true })
    await writeFile(anchor, JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.2.1-rc.2', type: 'module' }))
    const profile = loadProfile('test', 'qualification', anchor, home)
    expect(profile.skippedBundles).toEqual([])
    expect(profile.layers.map(layer => layer.packageName)).toEqual(names.map(name => '@dsh-extensions/' + name))
    const warnings: string[] = []
    const base = loadOverlayPatches('test', join(process.env.DSH_SANDBOX_OFFICIAL!, 'packages/bundle/base/cordis.patch.yml'))
    const flatten = (entries: any[]): any[] => entries.flatMap(e => [e, ...Array.isArray(e.config) ? flatten(e.config) : []])
    const entries = flatten(composeEntries([base, ...profile.layers.map(layer => layer.patches)], message => warnings.push(message)))
    expect(warnings.every(w => w.includes('filesystem'))).toBe(true)
    expect(entries.find(e => e.id === 'agent-loop')?.inject).toContain('windowsSandboxGuardReady')
    for (const id of ['sandbox', 'subprocess', 'fs-sandbox']) expect(entries.find(e => e.id === id)?.disabled).toBeTruthy()
    expect(entries.some(e => e.id === 'windows-sandbox-guard')).toBe(true)
    const diagnosticOnly = composeEntries([profile.layers[0]!.patches])
    expect(diagnosticOnly.map(e => e.id)).toEqual(['windows-sandbox-enhanced'])
    const cli = join(profileDir, 'node_modules/@dsh-extensions/windows-sandbox-enhanced/lib/cli.js')
    const doctor = JSON.parse(execFileSync(process.execPath, [cli, 'doctor'], { encoding: 'utf8', windowsHide: true }))
    expect(doctor).toMatchObject({ protected: false, nativeHelper: 'verified' })
    const scanRoot = join(home, 'empty-project'); await mkdir(scanRoot)
    const output = join(home, 'before.json')
    execFileSync(process.execPath, [cli, 'scan', scanRoot, '--out', output], { windowsHide: true })
    const report = JSON.parse(await readFile(output, 'utf8')); expect(report.complete).toBe(true)
    const plan = JSON.parse(execFileSync(process.execPath, [cli, 'recovery-plan', output, output], { encoding: 'utf8', windowsHide: true }))
    expect(plan.executable).toBe(false)
    expect(() => execFileSync(process.execPath, [cli, 'doctor', '--out', output], { stdio: 'pipe', windowsHide: true })).toThrow()
    expect(JSON.parse(await readFile(output, 'utf8')).root).toBe(scanRoot)
  } finally {
    if (!resolve(home).startsWith(parent + '\\')) throw Error('Test cleanup root mismatch')
    await rm(home, { recursive: true, force: true })
  }
})
