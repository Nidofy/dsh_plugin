import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const base = resolve(import.meta.dirname, '..')
const full = process.argv.includes('--full')
const node = process.execPath
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const steps = [
  ['strict build and unit/behavior tests', npm, ['test']],
  ['candidate package tarball', npm, ['pack', '--ignore-scripts', '--cache', '.build/npm-cache']],
  ['dual-baseline (rc.2 + rc.5) empty-cache offline installation', node, ['tests/install-check.mjs']],
]

if (full) {
  steps.push([
    'real Docker CPU reference/starter/Gloo/adversarial runs',
    node,
    ['--experimental-transform-types', 'tests/runner-real.ts'],
  ])
}

await mkdir(join(base, '.build'), { recursive: true })
const reportPath = join(base, '.build/gate-v010.json')
const report = { startedAt: new Date().toISOString(), full, steps: [], status: 'running' }

try {
  for (const [name, command, args] of steps) {
    console.log(`\n=== GATE: ${name} ===`)
    const t0 = Date.now()
    const code = await new Promise((res, rej) => {
      const npmCli = command === npm ? process.env.npm_execpath : undefined
      const child = spawn(npmCli ? node : command, npmCli ? [npmCli, ...args] : args, {
        cwd: base,
        env: { ...process.env },
        stdio: 'inherit',
        windowsHide: true,
        shell: !npmCli && command === npm && process.platform === 'win32',
      })
      child.once('error', rej)
      child.once('exit', (c) => res(c ?? 1))
    })
    report.steps.push({ name, code, elapsedMs: Date.now() - t0 })
    await writeFile(reportPath, JSON.stringify(report, null, 2))
    if (code !== 0) throw Error(`Gate failed (${code}): ${name}`)
  }
  report.status = 'passed'
  console.log('\nALL GATES PASSED')
} catch (error) {
  report.status = 'failed'
  report.error = String(error)
  process.exitCode = 1
  console.error(error)
} finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(reportPath, JSON.stringify(report, null, 2))
}
