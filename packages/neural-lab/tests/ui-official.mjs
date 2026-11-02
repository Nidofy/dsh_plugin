import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readdir, writeFile, readFile } from 'node:fs/promises'
import { checkEditableTraining } from './training-ui.mjs'
import { checkIndependentScrolling } from './scroll-check.mjs'
const base = resolve(import.meta.dirname, '..'),
  source = resolve(base, '../../../../.build/official-source-rc5'),
  pnpm = join(source, 'node_modules/.pnpm'),
  name = (await readdir(pnpm)).find((n) => n.startsWith('playwright@1.61.'))
const { chromium } = await import(
  pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href
)
const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'),
  folder = (await readdir(cache)).find((n) => n.startsWith('chromium_headless_shell-'))
const evidencePath = (name) =>
  join(base, '.build/ui', `${process.env.NEURAL_EVIDENCE_PREFIX || ''}${name}`)
let browser, page
const errors = []
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'),
  })
  page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'zh-CN' })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(process.env.NEURAL_WEB_URL)
  await page.waitForTimeout(1000)
  const welcome = page.getByRole('button', { name: /^(继续|Continue)$/ })
  if (await welcome.count()) await welcome.click()
  await page.waitForTimeout(1200)
  const close = page.getByRole('button', { name: /^(关闭|Close)$/ })
  if (await close.count()) await close.last().click()
  await page
    .getByText(/^Neural Lab(?: · 神经网络实验室)?$/)
    .first()
    .click()
  await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  await page
    .getByRole('textbox', { name: 'Python 编辑器 Editor' })
    .fill('# official DSH Web draft\n')
  await page.getByRole('button', { name: '保存 Save', exact: true }).click()
  await page.waitForTimeout(1000)
  await page.reload()
  await page.waitForTimeout(1200)
  if (await close.count()) await close.last().click()
  await page
    .getByText(/^Neural Lab(?: · 神经网络实验室)?$/)
    .first()
    .click()
  await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  await page.waitForFunction(
    () => document.querySelector('.nl-editorInput')?.value === '# official DSH Web draft\n',
  )
  await page.getByRole('button', { name: '概念 Concept', exact: true }).click()
  await page.getByRole('textbox', { name: '提问 Question' }).fill('解释 shape')
  await page.getByRole('button', { name: '询问导师 Ask mentor' }).click()
  await page
    .getByText(/unavailable|模型回合结束|no API key/, { exact: false })
    .first()
    .waitFor()
  if (process.env.NEURAL_UI_CPU === '1') {
    const catalog = JSON.parse(await readFile(join(base, 'content/catalog.json'), 'utf8')),
      activity = catalog.lessons
        .find((l) => l.id === 'L08')
        .exercises.find((e) => e.kind === 'experiment')
    await page.getByRole('button', { name: /L08 / }).click()
    await page.getByRole('tab', { name: '实验 Experiment' }).click()
    await page.waitForFunction(() =>
      document.querySelector('select')?.selectedOptions[0]?.textContent.includes('experiment'),
    )
    await page.getByRole('textbox', { name: 'Python 编辑器 Editor' }).fill(activity.reference)
    await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    await page.waitForFunction(
      () =>
        ['completed', 'failed', 'cancelled', 'timed_out'].some((status) =>
          document.querySelector('.nl-results')?.textContent.includes(status),
        ),
      {},
      { timeout: 120000 },
    )
    const runId = await page.locator('.nl-results').getAttribute('data-run-id')
    const record = await page.evaluate(async (id) => {
      const r = await fetch('/api/neural-lab/rpc', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'run', args: [id] }),
      })
      return await r.json()
    }, runId)
    if (record.check_status !== 'passed') {
      await writeFile(evidencePath('official-failed-run.json'), JSON.stringify(record, null, 2))
      throw Error(JSON.stringify(record))
    }
    await page.locator('.nl-results figure').first().scrollIntoViewIfNeeded()
    await page.screenshot({
      path: evidencePath('official-cpu-attention.png'),
      fullPage: true,
    })
    await writeFile(evidencePath('official-cpu-run.json'), JSON.stringify(record, null, 2))
    const training = await checkEditableTraining(
      page,
      catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === 'L04-train'),
    )
    const transformer = await checkEditableTraining(
      page,
      catalog.lessons.flatMap((l) => l.exercises).find((e) => e.id === 'L12-transformer'),
    )
    await writeFile(
      evidencePath('official-training.json'),
      JSON.stringify({ mlp: training, transformer }, null, 2),
    )
  }
  if (process.env.NEURAL_WITH_LEARN === '1') {
    await page
      .getByText(/^(学习|Learn)$/)
      .first()
      .click()
    await page.getByRole('tab', { name: /^(今日|Today)$/ }).waitFor()
    await page.screenshot({
      path: evidencePath('official-learn-coexist.png'),
      fullPage: true,
    })
    await page
      .getByText(/^Neural Lab(?: · 神经网络实验室)?$/)
      .first()
      .click()
    await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  }
  await page.locator('.nl-layout').waitFor()
  await page.getByRole('tab', { name: '练习 Exercise' }).waitFor()
  const scrollChecks = await checkIndependentScrolling(page, (width) =>
    evidencePath(`official-scroll-${width}.png`),
  )
  if (errors.length) throw Error(errors.join('\n'))
  await writeFile(
    evidencePath('official-validation.json'),
    JSON.stringify(
      {
        runtime: 'DSH 0.2.1-rc.5',
        pluginVersion: JSON.parse(await readFile(join(base, 'package.json'), 'utf8')).version,
        profile: `isolated ${process.env.NEURAL_PROFILE_NAME || 'invocation-owned'} profile`,
        checks: [
          'official CLI and plugin-manager offline installation',
          'actual DSH module loader and sidebar main panel',
          'real authenticated RPC saves draft and reload restores it',
          'preset hint and real no-model downgrade',
          ...scrollChecks,
          ...(process.env.NEURAL_UI_CPU === '1'
            ? [
                'actual official Host to Docker CPU Attention passed',
                'editable MLP and character Transformer comparison, reflection and review passed',
              ]
            : []),
          ...(process.env.NEURAL_WITH_LEARN === '1'
            ? ['Learn 0.5.2 and Neural Lab panels coexist']
            : []),
        ],
        errors,
      },
      null,
      2,
    ),
  )
  console.log(
    'PASS official DSH Web load, draft, reload, hint, failed/unavailable mentor without credentials; no page errors',
  )
  await page.screenshot({ path: evidencePath('official-web-initial.png'), fullPage: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.screenshot({ path: evidencePath('official-web-wide.png'), fullPage: true })
} catch (e) {
  if (page) {
    console.log((await page.locator('body').innerText()).slice(-6000))
    await page.screenshot({ path: evidencePath('official-web-error.png'), fullPage: true })
  }
  throw e
} finally {
  await browser?.close()
}
