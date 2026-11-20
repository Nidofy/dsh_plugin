import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
  steps.push(['distributed process limits, missing rank, output budget and hot unload',
    node, ['--experimental-transform-types', 'tests/runner-distributed-adversarial.ts']])
  steps.push(['historical v0.1.0 through v0.6.0 database upgrade and six archive replays',
    node, ['--experimental-transform-types', 'tests/upgrade-chain.mjs']])
  steps.push(['real browser: seven simulators, eight display configurations and neutral feedback',
    node, ['tests/ui-browser-real.mjs']])
  steps.push(['seven installed packages on the official rc.5 Host and web client',
    node, ['tests/coexistence-rc5.mjs']])
}

await mkdir(join(base, '.build'), { recursive: true })
const { version } = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'))
const reportPath = join(base, `.build/gate-v${version}.json`)
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
  if (full) {
    const remaining = execFileSync('docker', ['ps', '-aq', '--filter', 'name=ai-infra-lab-'], {encoding:'utf8',windowsHide:true}).trim()
    if (remaining) throw Error('Lab containers remain after the gate: '+remaining)
    report.remainingContainers = 0
    console.log('PASS no remaining lab containers (including stopped containers)')
  }
  const tarball = `dsh-plugin-ai-infra-lab-${version}.tgz`
  const bytes = await readFile(join(base, tarball))
  report.artifact = { tarball, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
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
