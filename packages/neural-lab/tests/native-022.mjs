// Run against an explicitly selected official rc.5 executable and an isolated desktop profile.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { temporaryDirectory } from './temporary-directory.mjs'

const base = resolve(import.meta.dirname, '..')
const version = JSON.parse(await readFile(join(base, 'package.json'), 'utf8')).version
const exe = process.env.NEURAL_DESKTOP_EXE
assert.ok(exe, 'Set NEURAL_DESKTOP_EXE to official DeepSeek Harness.exe')
const cli = join(
  dirname(exe),
  'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js',
)
const repo = resolve(base, '../../../..')
const pnpm = join(repo, '.build/official-source-rc5/node_modules/.pnpm')
const pw = (await readdir(pnpm)).find((n) => n.startsWith('playwright@1.61.'))
const { _electron } = await import(
  pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href
)
const tmp = await temporaryDirectory('neural-desktop-')
const home = join(tmp.directory, 'home'),
  data = join(tmp.directory, 'electron')
const env = {
  ...process.env,
  DSH_HOME: home,
  DSH_AGENTS_HOME: join(tmp.directory, 'agents'),
  DEEPSEEK_API_KEY: '',
  npm_config_offline: 'true',
}
const runCli = async (...args) =>
  (
    await promisify(execFile)(exe, ['--expose-internals', cli, ...args], {
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      timeout: 120000,
    })
  ).stdout.trim()
const archive = join(base, 'dsh-plugin-neural-lab-' + version + '.tgz')
const code = 'import numpy as np\ndef solve(x,w,b):\n    return np.asarray(x) @ np.asarray(w) + b\n'
let app, page
async function launch() {
  app = await _electron.launch({
    executablePath: exe,
    args: ['--user-data-dir=' + data],
    env,
    timeout: 90000,
  })
  page = await app.firstWindow({ timeout: 90000 })
  assert.equal(resolve(await app.evaluate(({ app }) => app.getPath('userData'))), resolve(data))
}
async function openLab() {
  const entry = page.getByText(/^Neural Lab(?: · 神经网络实验室)?$/).first()
  const deadline = Date.now() + 60000
  while (!(await entry.isVisible())) {
    for (const action of [/^(继续|Continue)$/, /^(关闭|Close)$/]) {
      const button = page.getByRole('button', { name: action }).last()
      if (await button.isVisible()) await button.click({ timeout: 1500 }).catch(() => {})
    }
    if (Date.now() > deadline)
      throw Error(
        'Missing Neural Lab launcher: ' + (await page.locator('body').innerText()).slice(0, 1500),
      )
    await page.waitForTimeout(200)
  }
  await entry.click()
  await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
}
try {
  assert.equal(await runCli('--version'), '0.2.1-rc.5')
  await launch()
  // Wait for Desktop itself to bootstrap its own default profile.
  await page.waitForFunction(() => document.body.innerText.trim().length > 40, null, {
    timeout: 90000,
  })
  await app.close()
  app = undefined
  await runCli(
    'plugin',
    '--profile',
    'desktop',
    'add',
    archive,
    '--offline',
    '--store-dir',
    join(repo, '.pnpm-store'),
  )
  await launch()
  await openLab()
  await page.getByRole('textbox', { name: 'Python 编辑器 Editor' }).fill(code)
  await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
  await page.locator('.nl-results .nl-verdict-passed').waitFor({ timeout: 120000 })
  const id = await page.locator('.nl-results').getAttribute('data-run-id')
  await page.getByRole('button', { name: /L02 / }).click()
  await page.getByRole('button', { name: /L01 / }).click()
  await app.close()
  app = undefined
  await launch()
  await openLab()
  await page.waitForFunction(
    (source) => document.querySelector('.nl-editorInput')?.value === source,
    code,
  )
  assert.equal(await page.locator('.nl-results').getAttribute('data-run-id'), id)
  const catalog = JSON.parse(await readFile(join(base, 'content/catalog.json'), 'utf8'))
  const project = catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === 'L12-two')
  await page.getByRole('button', { name: /L12 / }).click()
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  await page.getByLabel('当前活动 Activity').selectOption(project.id)
  await page.getByRole('textbox', { name: 'Python 编辑器 Editor' }).fill(project.reference)
  await page
    .getByLabel('运行前预测 Prediction')
    .fill('Two causal layers should preserve earlier outputs')
  await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
  const output = page.locator('.nl-results').first()
  await output.locator('.nl-verdict-passed').waitFor({ timeout: 120000 })
  await output.getByRole('button', { name: /Inspect attention.layer1.head1/ }).click()
  await output.getByText('Q / K').waitFor()
  const debug = page.getByRole('region', {name:'组件调试工作台 / Component debug workbench'})
  await debug.waitFor()
  await debug.locator('button[data-debug-component="attention"]').click()
  await debug.getByLabel('层 / Layer').selectOption('1')
  assert.match(await debug.innerText(), /gradient_norm/)
  const first = debug.locator('button[data-debug-component]').first()
  await first.focus()
  await page.keyboard.press('ArrowRight')
  assert.notEqual(await page.evaluate(()=>document.activeElement?.getAttribute('data-debug-component')), await first.getAttribute('data-debug-component'))
  await mkdir(join(base, '.build/ui'), { recursive: true })
  await page.screenshot({path:join(base,'.build/ui/native-060.png')})
  const log = {
    projectRun: await output.getAttribute('data-run-id'),
    version,
    host: 'official rc.5 Electron',
    sha256: createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    runId: id,
    checks: [
      'two-layer transfer, CPU training and layer1/head1 indexed heatmap',
      'native component debugger, layer1 gradient and keyboard focus',
      'isolated install',
      'visible editor',
      'Docker CPU passed',
      'lesson switch',
      'full restart restored code and run',
    ],
  }
  await mkdir(join(base, '.build/ui'), { recursive: true })
  await writeFile(join(base, '.build/ui/native-050.json'), JSON.stringify(log, null, 2))
  console.log(JSON.stringify(log))
} finally {
  try {
    await app?.close()
  } finally {
    await tmp.cleanup()
  }
}
