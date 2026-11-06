/** Real browser, Host, SQLite and Docker; repeat in an independent empty learning profile. */
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { serve } from './ui-serve.mjs'
const a = await serve()
let b, browser
try {
  const pnpm = join(a.source, 'node_modules/.pnpm')
  const pw = (await readdir(pnpm)).find((n) => n.startsWith('playwright@1.61.'))
  const { chromium } = await import(
    pathToFileURL(join(pnpm, pw, 'node_modules/playwright/index.mjs')).href
  )
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
  const shell = (await readdir(cache)).find((n) => n.startsWith('chromium_headless_shell-'))
  browser = await chromium.launch({
    executablePath: join(cache, shell, 'chrome-headless-shell-win64/chrome-headless-shell.exe'),
  })
  const p = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  const errors = []
  p.on('pageerror', (err) => errors.push(String(err)))
  const navigate = async (s, id) => {
    await p.goto(s.url)
    await p.getByRole('button', { name: /L12 / }).click()
    await p.getByRole('tab', { name: '练习 Exercise' }).click()
    await p.getByLabel('当前活动 Activity').selectOption(id)
    await p.getByLabel('PyTorch 可求导组件 / Project component').waitFor()
  }
  const editor = p.getByRole('textbox', { name: 'Python 编辑器 Editor' })
  const prediction = p.getByLabel('运行前预测 Prediction')
  const run = async () => {
    const posted = p.waitForResponse(
      (r) => r.request().method() === 'POST' && r.request().postDataJSON()?.method === 'start',
    )
    await p.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    const record = await (await posted).json()
    const output = p.locator('.nl-results[data-run-id="' + record.id + '"]').first()
    await output.locator('.nl-verdict-passed').waitFor({ timeout: 120000 })
    return record.id
  }
  const id = 'L12-assembly',
    ref = a.engine.exercise(id).reference
  await navigate(a, id)
  await editor.fill(ref)
  await prediction.fill('Predict masked attention preserves the prefix')
  await p.getByRole('button', { name: '保存 Save', exact: true }).click()
  await p.getByRole('tab', { name: '记录 Records' }).click()
  await navigate(a, id)
  assert.equal(await prediction.inputValue(), 'Predict masked attention preserves the prefix')
  const first = await run()
  await p
    .getByRole('button', { name: /Inspect attention.layer0.head0/ })
    .first()
    .click()
  const heat = p.getByRole('region', { name: 'attention.layer0.head0' }).first()
  await heat.getByText('Q / K').waitFor()
  const cell = heat.locator('td').first()
  assert.match(await cell.getAttribute('title'), new RegExp(first))
  const record = a.engine.run(first)
  const artifact = record.events.find((e) => e.artifactId)
  assert.ok(!artifact.data)
  assert.equal(
    Number(await cell.innerText()),
    a.engine.store.diagnostic(first, artifact.artifactId, record.codeHash)[0][0],
  )
  assert.throws(() => a.engine.store.diagnostic(first, artifact.artifactId, 'wrong'))
  await heat.getByRole('checkbox').check()
  await p.keyboard.press('Alt+e')
  await p.waitForFunction(() => document.activeElement?.classList.contains('nl-editorInput'))
  await p.getByLabel('我的解释 Reflection').fill('Step one: gradients changed; compare heads.')
  await p.getByRole('button', { name: /Save reflection/ }).click()
  const dl = p.waitForEvent('download')
  await p.getByRole('button', { name: /Export selected run/ }).click()
  const file = await (await dl).path()
  const bundle = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(bundle.runId, first)
  assert.equal(bundle.explanations.length, 1)
  await p.getByRole('button', { name: /Start transfer/ }).click()
  await p.getByRole('button', { name: /Reuse source snapshot/ }).waitFor()
  await p.getByLabel('PyTorch 可求导组件 / Project component').selectOption('attention')
  await p.getByRole('button', { name: /Load L12-assembly/ }).click()
  await p.getByRole('button', { name: /Apply component/ }).click()
  assert.match(await editor.inputValue(), /merge_heads/)
  await p.getByRole('button', { name: /Reuse source snapshot/ }).click()
  await prediction.fill('Changing head count should preserve shape, not individual probabilities')
  const transfer = await run()
  assert.equal(a.engine.run(transfer).variantOf, first)
  const due = a.engine.overview().reviews.find((r) => r.runId === transfer).due
  a.engine.snooze('L12-variant', transfer)
  assert.ok(a.engine.overview().reviews.find((r) => r.runId === transfer).due > due)

  b = await serve()
  await p.setViewportSize({ width: 640, height: 900 })
  await navigate(b, id)
  await p.locator('input[type=file]').setInputFiles(file)
  await p.getByRole('button', { name: /Load draft for review/ }).click()
  assert.equal(await editor.inputValue(), ref)
  assert.equal(b.engine.workspace(id).runs.length, 0)
  const second = await run()
  assert.notEqual(second, first)
  await p.getByRole('button', { name: /Verify replay/ }).click()
  await p.getByText('复现摘要一致（不验证导入来源） / Replay matched (import provenance unverified)').waitFor()
  await p.getByLabel('我的解释 Reflection').fill('A retained second-profile reflection')
  await navigate(b, id)
  assert.equal(
    await p.getByLabel('我的解释 Reflection').inputValue(),
    'A retained second-profile reflection',
  )
  await p.getByRole('button', { name: /Save reflection/ }).click()
  await p.getByRole('button', { name: /Finish review/ }).click()
  assert.ok(!b.engine.overview().reviews.some((r) => r.runId === second))
  assert.ok(a.engine.overview().reviews.some((r) => r.runId === first))
  assert.throws(
    () =>
      b.engine.inspectProject(id, JSON.stringify({ ...bundle, code: bundle.code + '# edited' })),
    /digest/,
  )
  assert.deepEqual(errors, [])
  await writeFile(
    join(a.out, 'projects-050.json'),
    JSON.stringify(
      {
        first,
        second,
        codeHash: record.codeHash,
        signature: bundle.signature,
        componentCount: bundle.components.length,
        image: bundle.image,
        errors,
      },
      null,
      2,
    ),
  )
  console.log(
    'PASS component reuse, indexed diagnostic, file preview, isolated replay, linked drafts and reviews',
    first,
    second,
  )
} finally {
  try {
    await browser?.close()
  } finally {
    try {
      await b?.close()
    } finally {
      await a.close()
    }
  }
}

