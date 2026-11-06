// Run only against an already started, isolated official Host with the candidate installed.
// No fixture server, mocked RPC, automatic dependency installation, or skipped core assertions.
import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'

const base = resolve(import.meta.dirname, '..')
const out = join(base, '.build/ui')
await mkdir(out, { recursive: true })
const report = { rpcTrace: [], editorTrace: [], startedAt: new Date().toISOString(), runtime: 'official DSH 0.2.1-rc.5', checks: [], errors: [], runs: [], groups: [], screenshots: [], tutor: { requested: process.env.NEURAL_LIVE_TUTOR === '1', semanticReview: 'Not performed; raw replies require human review' } }
const evidence = (name) => join(out, name)
let browser, page
const ownedGroups = new Set()
let hostPanelRecoveries=0
const terminal = (status) => !['queued', 'running'].includes(status)
async function rpc(method, args) {
  return page.evaluate(async ({ method, args }) => {
    const response = await fetch('/api/neural-lab/rpc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, args }) })
    const value = await response.json()
    if (!response.ok || value?.error) throw Error(method + ': ' + JSON.stringify(value))
    return value
  }, { method, args })
}
async function until(fn, predicate, label, timeout = 180000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await fn()
    if (predicate(value)) return value
    await page.waitForTimeout(500)
  }
  throw Error('Timed out: ' + label)
}
async function uiActivity(exercise) {
  await page.getByRole('button', { name: new RegExp('^' + exercise.lessonId + ' ') }).click()
  await page.getByRole('tab', { name: '练习 Exercise', exact: true }).click()
  const select = page.getByLabel('当前活动 Activity')
  await select.waitFor()
  if(await select.inputValue() !== exercise.id) {
    const ready=page.waitForResponse(r=>r.url().endsWith('/api/neural-lab/rpc')&&r.request().postDataJSON()?.method==='workspace'&&r.request().postDataJSON()?.args?.[0]===exercise.id)
    await select.selectOption(exercise.id)
    const workspace=await (await ready).json()
    await page.waitForFunction(({id,code})=>{
      const editors=[...document.querySelectorAll('.nl-editorInput')]
      const selected=[...document.querySelectorAll('select')].some(s=>s.value===id)
      return selected&&editors.length===1&&editors[0].value===code&&!editors[0].readOnly
    },{id:exercise.id,code:workspace.draft})
  }
  await until(async()=>page.getByLabel('运行前预测 Prediction').count(),n=>n===1,'one settled activity prediction editor',30000)
  await page.getByRole('textbox', { name: 'Python 编辑器 Editor', exact: true }).waitFor()
}
async function ensureLab(exercise) {
  if(await page.getByRole('heading',{name:'Neural Lab',exact:true}).isVisible())return
  assert.equal(hostPanelRecoveries++,0,'Repeated host panel navigation must be investigated')
  const before=await rpc('workspace',[exercise.id])
  const groupsBefore=await rpc('groups',[exercise.id])
  report.checks.push('One host panel change while awaiting CPU; explicitly reopened Neural Lab and verified saved draft/run/group identities')
  await page.getByText(/^Neural Lab(?: · 神经网络实验室)?$/).first().click()
  await page.getByRole('heading',{name:'Neural Lab',exact:true}).waitFor()
  await uiActivity(exercise)
  const after=await rpc('workspace',[exercise.id])
  const groupsAfter=await rpc('groups',[exercise.id])
  assert.equal(after.draft,before.draft)
  assert.deepEqual(after.runs.map(r=>r.id).sort(),before.runs.map(r=>r.id).sort())
  assert.deepEqual(groupsAfter.map(g=>({id:g.id,codeHash:g.codeHash,imageId:g.imageId})),groupsBefore.map(g=>({id:g.id,codeHash:g.codeHash,imageId:g.imageId})))
}
async function submit(exercise, code, configuration = {}) {
  await uiActivity(exercise)
  const editor=page.getByRole('textbox', { name: 'Python 编辑器 Editor', exact: true })
  report.editorTrace.push({at:'before-fill',id:exercise.id,editors:await editor.count(),valueLength:(await editor.inputValue()).length,readonly:await editor.getAttribute('readonly')})
  await editor.fill(code)
  report.editorTrace.push({at:'after-fill',id:exercise.id,valueLength:(await editor.inputValue()).length,expectedLength:code.length})
  await page.waitForFunction(source=>document.querySelector('.nl-editorInput')?.value===source,code)
  assert.equal(await editor.inputValue(),code)
  await page.getByLabel('运行前预测 Prediction').fill('UI060: changing B/T/H preserves contracts; compare only frozen run evidence.')
  for (const key of ['batchSize', 'context', 'heads']) if (configuration[key] !== undefined) await page.getByLabel('Run ' + key, { exact: true }).selectOption(String(configuration[key]))
  if (configuration.steps !== undefined) await page.getByLabel('Observation steps', { exact: true }).fill(String(configuration.steps))
  const response = page.waitForResponse((r) => r.url().endsWith('/api/neural-lab/rpc') && r.request().postDataJSON()?.method === 'start')
  await page.getByRole('button', { name: '运行 / 提交 Run & check', exact: true }).click()
  const started = await (await response).json()
  assert.ok(started.id, JSON.stringify(started))
  const run = await until(() => rpc('run', [started.id]), (r) => terminal(r.run_status), 'CPU run ' + started.id)
  assert.equal(run.run_status, 'completed', run.reason)
  assert.equal(run.exerciseId, exercise.id)
  assert.equal(run.code, code)
  assert.ok(run.resolvedImageId)
  assert.ok(run.codeHash)
  assert.ok(run.events.every((event) => event.runId === run.id))
  for (const [key, value] of Object.entries(configuration)) assert.equal(run.config[key], value, 'frozen config ' + key)
  report.runs.push(run)
  await page.locator('.nl-results[data-run-id="' + run.id + '"]').waitFor()
  return run
}
async function shot(name) {
  const path = evidence(name)
  await page.screenshot({ path, fullPage: true, animations:'disabled',caret:'hide',timeout:60000 })
  report.screenshots.push(path)
}
try {
  assert.ok(process.env.NEURAL_WEB_URL, 'NEURAL_WEB_URL must identify the existing isolated official Host')
  const source = process.env.DSH_SOURCE ?? resolve(base, '../../../../.build/official-source-rc5')
  const pnpm = join(source, 'node_modules/.pnpm')
  const packageName = (await readdir(pnpm)).find((name) => name.startsWith('playwright@1.61.'))
  assert.ok(packageName, 'Prepared official Playwright 1.61 dependency required')
  const { chromium } = await import(pathToFileURL(join(pnpm, packageName, 'node_modules/playwright/index.mjs')).href)
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
  const folder = (await readdir(cache)).find((name) => name.startsWith('chromium_headless_shell-'))
  assert.ok(folder, 'Prepared Chromium headless shell required')
  browser = await chromium.launch({ headless: true, executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe') })
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', colorScheme: 'light' })
  page.setDefaultTimeout(30000)
  page.on('pageerror', (error) => report.errors.push(error.message))
  page.on('console',message=>{if(/same key|unique.*key|duplicate.*key/i.test(message.text()))report.errors.push(message.text())})
  page.on('request', request=>{
    if(!request.url().endsWith('/api/neural-lab/rpc'))return
    const body=request.postDataJSON()
    if(['workspace','selectLesson','saveDraft'].includes(body?.method))report.rpcTrace.push({at:Date.now(),method:body.method,id:body.args?.[0],length:typeof body.args?.[1]==='string'?body.args[1].length:undefined})
  })
  await page.goto(process.env.NEURAL_WEB_URL)
  const welcome = page.getByRole('button', { name: /^(继续|Continue)$/ })
  await page.waitForTimeout(1200)
  if (await welcome.count()) await welcome.click()
  await page.waitForTimeout(1200)
  const close = page.getByRole('button', { name: /^(关闭|Close)$/ })
  if (await close.count()) await close.last().click()
  await page.getByText(/^Neural Lab(?: · 神经网络实验室)?$/).first().click()
  await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  const catalog = JSON.parse(await readFile(join(base, 'content/catalog.json'), 'utf8'))
  const exercises = catalog.lessons.flatMap((lesson) => lesson.exercises)
  const two = exercises.find((e) => e.runtimeKey === 'project-char-two-v1')
  const observe = exercises.find((e) => e.runtimeKey === 'project-char-observe-v1')
  assert.ok(two && observe, '0.6.0 registered protocols required')
  const environment = await rpc('environment', [])
  assert.equal(environment.available, true, environment.detail)
  report.environment = environment

  const run = await submit(two, two.reference, { batchSize: 1, context: 2, heads: 6 })
  assert.equal(run.check_status, 'passed')
  assert.equal(run.mode, 'check')
  assert.equal(Math.max(...run.events.filter((e) => e.name === 'validation_loss').map((e) => e.step)), 4)
  const debug = page.getByRole('region', { name: '组件调试工作台 / Component debug workbench', exact: true })
  await debug.waitFor()
  assert.ok((await debug.innerText()).includes(run.id))
  assert.ok((await debug.innerText()).includes(run.codeHash))
  const attention = debug.locator('button[data-debug-component="attention"]')
  await attention.click()
  await attention.focus()
  await page.keyboard.press('ArrowRight')
  const nextName = two.components[two.components.findIndex((c) => c.name === 'attention') + 1].name
  assert.equal(await debug.locator('button[data-debug-component="' + nextName + '"]').getAttribute('aria-pressed'), 'true')
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-debug-component')), nextName)
  await attention.click()
  for (const layer of [0, 1]) {
    await debug.getByLabel('层 / Layer').selectOption(String(layer))
    for (const type of ['shape', 'metric']) {
      const event = run.events.find((e) => e.component === 'attention' && e.layer === layer && e.type === type && (type !== 'metric' || e.name === 'gradient_norm'))
      assert.ok(event, `attention layer ${layer} ${type} must be sampled`)
      const row = debug.getByRole('row').filter({ hasText: '#' + event.seq + ' ' + event.name }).first()
      await row.waitFor()
      const cells = await row.locator('td').allTextContents()
      assert.equal(cells[1], type === 'shape' ? '[' + event.shape.join(', ') + ']' : String(event.value))
      assert.equal(cells[2], event.source)
      assert.equal(cells[3], String(event.step))
      assert.equal(cells[4], String(layer))
    }
  }
  const sourceText = await debug.locator('details').filter({ has: page.locator('summary', { hasText: 'Frozen component source' }) }).locator('pre').innerText()
  const sourceSlice = run.code.split('# %% attention\n')[1]?.split(/^# %% /m)[0]
  assert.ok(sourceSlice?.trim())
  assert.equal(sourceText.trim(), sourceSlice.trim())
  report.checks.push('real CPU two-layer check, nondefault B/T/H frozen; per-layer shape/gradient/source/step/value and codeHash match run', 'actual keyboard component navigation moves selection and focus')

  const colors = {}
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    await page.getByRole('button', { name: '账号菜单', exact: true }).click()
    await page.getByRole('menuitem', { name: '设置', exact: true }).click()
    const settings = page.getByRole('dialog', { name: '设置', exact: true })
    await settings.getByRole('button', { name: '通用设置', exact: true }).click()
    await settings.getByRole('button', { name: theme === 'dark' ? '深色' : '浅色', exact: true }).click()
    await page.waitForFunction((dark) => document.body.hasAttribute('data-ds-dark-theme') === dark, theme === 'dark')
    await page.keyboard.press('Escape')
    await settings.waitFor({ state: 'hidden' })
    await debug.scrollIntoViewIfNeeded()
    colors[theme] = await debug.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, foreground: getComputedStyle(element).color }))
    await shot('v060-debug-' + theme + '.png')
  }
  assert.notDeepEqual(colors.light, colors.dark, 'Light and dark rendering must differ')
  report.themeColors = colors
  await page.setViewportSize({ width: 780, height: 1000 })
  await shot('v060-debug-narrow.png')
  assert.equal(await page.locator('.nl-layout').evaluate((e) => e.scrollWidth <= e.clientWidth + 2), true, 'Workspace must not overflow horizontally')
  await page.setViewportSize({ width: 1440, height: 1000 })
  report.checks.push('real browser light/dark styles differ; screenshots at wide and narrow viewports')

  const panel = page.getByRole('region', { name: '分组实验 / Experiment groups', exact: true })
  await panel.getByLabel('种子列表 / Seeds', { exact: true }).fill('42,43')
  await panel.getByLabel('学习率列表 / Learning rates', { exact: true }).fill('0.05,0.1')
  await panel.getByLabel('总预算（秒） / Total seconds', { exact: true }).fill('600')
  await panel.getByLabel('实验假设 / Hypothesis').fill('UI060: compare held-out losses over two seeds per learning rate; four frozen sequential runs.')
  async function startGroupUI() {
    const response = page.waitForResponse((r) => r.url().endsWith('/api/neural-lab/rpc') && r.request().postDataJSON()?.method === 'startGroup')
    await panel.getByRole('button', { name: '启动分组实验（冻结当前代码） / Start group with frozen code', exact: true }).click()
    const group = await (await response).json()
    assert.ok(group.id, JSON.stringify(group)); ownedGroups.add(group.id)
    return group
  }
  const startedGroup = await startGroupUI()
  assert.equal(startedGroup.code, run.code)
  assert.equal(startedGroup.items.length, 4)
  const completed = await until(() => rpc('groups', [two.id]), (groups) => terminal(groups.find((g) => g.id === startedGroup.id)?.status ?? 'queued'), 'four-run group completion', 650000)
  const group = completed.find((g) => g.id === startedGroup.id)
  assert.equal(group.status, 'completed', JSON.stringify(group.items))
  const groupedRuns = await Promise.all(group.items.map((item) => rpc('run', [item.runId])))
  for (let i = 0; i < groupedRuns.length; i++) {
    const r = groupedRuns[i]
    assert.equal(r.check_status, 'passed'); assert.equal(r.groupId, group.id); assert.equal(r.codeHash, group.codeHash); assert.equal(r.resolvedImageId, group.imageId)
    if (i) assert.ok(Date.parse(groupedRuns[i - 1].finishedAt) <= Date.parse(r.createdAt), 'Next run starts only after previous completion')
  }
  await ensureLab(two)
  const groupButton = panel.getByRole('button').filter({ hasText: group.id })
  await until(async () => groupButton.innerText(), (value) => value.includes('completed'), 'group UI terminal refresh')
  await groupButton.click()
  const summary = panel.getByRole('table', { name: '程序验证损失，按学习率统计 / Program validation loss by learning rate', exact: true })
  for (const rate of [0.05, 0.1]) {
    const values = groupedRuns.filter((r) => r.config.learningRate === rate).map((r) => r.events.filter((e) => e.runId === r.id && e.name === 'validation_loss' && e.type === 'metric' && e.source === 'program').at(-1)?.value)
    assert.equal(values.length, 2); assert.ok(values.every(Number.isFinite))
    const mean = (values[0] + values[1]) / 2, sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0))
    const row = summary.getByRole('row').filter({ has: page.getByRole('cell', { name: String(rate), exact: true }) })
    await until(async () => row.locator('td').allTextContents(), (cells) => cells[1] === '2 / 2', 'group sample count')
    const cells = await row.locator('td').allTextContents()
    assert.ok(Math.abs(Number(cells[2]) - mean) < 1e-12); assert.ok(Math.abs(Number(cells[3]) - sd) < 1e-12)
    assert.deepEqual(cells.slice(4), ['0', '0', '0'])
  }
  assert.match(await panel.innerText(), /Queue completion does not establish mastery/)
  await panel.getByLabel('实验结论 / Conclusion').fill('Observed means differ by learning rate in this frozen four-run group.')
  await panel.getByLabel('局限与不确定性 / Limitations').fill('Only two seeds per rate and a tiny synthetic dataset; this does not prove causality or mastery.')
  const conclusionResponse = page.waitForResponse((r) => r.url().endsWith('/api/neural-lab/rpc') && r.request().postDataJSON()?.method === 'concludeGroup')
  await panel.getByRole('button', { name: '保存结论与局限 / Save conclusion and limitations', exact: true }).click()
  const concluded = await (await conclusionResponse).json()
  assert.ok(concluded.revision > group.revision); assert.ok(concluded.conclusion && concluded.limitations)
  report.groups.push({ group: concluded, runs: groupedRuns })
  await shot('v060-group-statistics.png')
  report.checks.push('UI explicitly starts real four-run group; timestamps prove serial order; UI mean and sample SD equal independent recomputation; conclusion/limitations CAS saved')

  await ensureLab(two)
  assert.equal(await panel.getByLabel('实验假设 / Hypothesis').count(),1)
  await panel.getByLabel('实验假设 / Hypothesis').fill('UI060 cancellation: preserve completed evidence and stop queued runs.')
  const cancelGroup = await startGroupUI()
  await panel.getByRole('button', { name: '取消此实验组 / Cancel this group', exact: true }).click()
  const cancelledList = await until(() => rpc('groups', [two.id]), (groups) => groups.find((g) => g.id === cancelGroup.id)?.status === 'cancelled', 'group cancellation')
  const cancelled = cancelledList.find((g) => g.id === cancelGroup.id)
  assert.ok(cancelled.items.some((item) => item.status === 'cancelled'))
  assert.ok(cancelled.items.every((item) => terminal(item.status)))
  await until(async () => panel.innerText(), (value) => value.includes('cancelled') && value.includes('Undefined (n < 2)'), 'cancelled group missing metrics UI')
  report.groups.push({ group: cancelled })
  report.checks.push('group UI cancels real in-flight queue, terminal cancelled items retained and insufficient-sample SD undefined')

  const observation = await submit(observe, observe.reference, { batchSize: 1, context: 2, heads: 1, steps: 8 })
  assert.equal(observation.check_status, 'passed'); assert.equal(observation.mode, 'observe')
  assert.equal(Math.max(...observation.events.filter((e) => e.name === 'validation_loss').map((e) => e.step)), 8)
  assert.match(await page.locator('fieldset').filter({ hasText: 'Run specification' }).innerText(), /Observation only, not implementation mastery/)
  const overview = await rpc('overview', [])
  const evidenceRows = overview.evidence.filter((e) => e.runId === observation.id)
  assert.ok(evidenceRows.length); assert.ok(evidenceRows.every((e) => e.kind === 'observation'))
  assert.ok(overview.evidence.some((e) => e.runId === run.id && e.kind === two.evidenceKind && e.kind !== 'observation'))
  assert.ok((await debug.innerText()).includes(observation.id)); assert.ok(!(await debug.innerText()).includes(run.id))
  report.checks.push('eight-step observation has actual observation-only evidence; four-step check has its declared transfer evidence; debug panel switches run identity')
  await shot('v060-observation.png')

  if (process.env.NEURAL_LIVE_TUTOR === '1') {
    const needle = 'return causal_mask(scores).softmax(-1)'
    assert.equal(two.reference.split(needle).length, 2, 'Failure mutation must match once')
    const failed = await submit(two, two.reference.replace(needle, 'return scores.softmax(-1)'), { batchSize: 1, context: 2, heads: 2 })
    assert.equal(failed.check_status, 'failed')
    const check = failed.events.find((e) => e.type === 'check' && e.passed === false && e.component)
    assert.ok(check, 'A component-scoped failed check is required for live tutor context')
    const context = { runId: failed.id, component: check.component, check: check.name }
    const replies = []
    for (const question of [
      '只根据这个运行、组件和失败检查解释观察事实。区分最早失败与后续症状，不要把时间顺序当因果；只给一个单变量诊断步骤，不给整份答案。',
      '继续核对上一轮诊断：指出本次运行中实际存在的 shape、layer、step 或检查证据，说明一个尚不能断定的原因，并给出最小复测建议；不要声称未执行的修复已通过。',
    ]) {
      const reply = await rpc('tutor', [two.id, question, '', 'concept', context])
      replies.push({ question, context, reply })
      await writeFile(evidence('v060-live-tutor-replies.json'), JSON.stringify({ failedRun: failed, replies, semanticReview: 'Pending manual review; successful transport is not semantic correctness' }, null, 2))
      assert.equal(reply.status, 'completed', reply.text); assert.ok(reply.text.trim())
      const workspace = await rpc('workspace', [two.id])
      assert.ok(workspace.hints.includes('unknown'), 'Real mentor delivery must record unknown help')
    }
    report.tutor = { ...report.tutor, completedReplies: replies.length, help: 'unknown', path: evidence('v060-live-tutor-replies.json') }
    report.checks.push('two real tutor deliveries completed with failed-run component/check context; unknown help recorded; semantic review remains manual')
  }
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
  console.log('PASS official UI060 CPU, debugger, group lifecycle/statistics and observation evidence')
} catch (error) {
  report.status = 'failed'; report.errors.push(String(error?.stack ?? error))
  if(page)report.editorTrace.push({at:'error',editors:await page.locator('.nl-editorInput').evaluateAll(nodes=>nodes.map(node=>({length:node.value.length,readonly:node.readOnly})))})
  if (page) await shot('v060-official-error.png').catch((e) => report.errors.push(String(e)))
  process.exitCode = 1
} finally {
  if (page) for (const id of ownedGroups) await rpc('cancelGroup', [id]).catch((e) => report.errors.push('cleanup ' + id + ': ' + String(e)))
  await browser?.close()
  report.finishedAt = new Date().toISOString()
  if (report.errors.length) { report.status = 'failed'; process.exitCode = 1 }
  await writeFile(evidence('v060-official-validation.json'), JSON.stringify(report, null, 2))
}
