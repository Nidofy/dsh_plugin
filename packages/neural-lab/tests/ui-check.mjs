import { serve } from './ui-serve.mjs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readdir, writeFile, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { checkIndependentScrolling } from './scroll-check.mjs'
const s = await serve()
let browser
const errors = [],
  results = []
try {
  const pnpm = join(s.source, 'node_modules/.pnpm'),
    name = (await readdir(pnpm)).find((n) => n.startsWith('playwright@1.61.'))
  const { chromium } = await import(
    pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href
  )
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'),
    folder = (await readdir(cache)).find((n) => n.startsWith('chromium_headless_shell-'))
  browser = await chromium.launch({
    headless: true,
    executablePath: join(cache, folder, 'chrome-headless-shell-win64/chrome-headless-shell.exe'),
  })

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(s.url)
  await page.getByRole('heading', { name: 'Neural Lab', exact: true }).waitFor()
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  const editor = page.getByRole('textbox', { name: 'Python 编辑器 Editor' })
  let releaseSave
  const gate = new Promise((resolve) => {
    releaseSave = resolve
  })
  let enteredSave
  const entered = new Promise((resolve) => {
    enteredSave = resolve
  })
  const pauseSave = async (route) => {
    if (route.request().postDataJSON()?.method === 'saveDraft') {
      enteredSave()
      await gate
    }
    await route.continue()
  }
  await page.route('**/api/neural-lab/rpc', pauseSave)
  try {
    await editor.fill('# pending save race guard')
    await page.getByRole('button', { name: '保存 Save', exact: true }).click()
    await entered
    assert(await page.getByRole('button', { name: '重置 Reset', exact: true }).isDisabled())
    assert(await page.getByRole('button', { name: '保存 Save', exact: true }).isDisabled())
    assert(await page.getByLabel('当前活动 Activity').isDisabled())
    assert(await editor.evaluate((element) => element.readOnly))
    await editor.press('Tab')
    await editor.focus()
    await editor.press('Enter')
    assert.equal(await editor.inputValue(), '# pending save race guard')
  } finally {
    releaseSave()
  }
  await page.waitForFunction(() => !document.querySelector('.nl-editorInput')?.readOnly)
  await page.unroute('**/api/neural-lab/rpc', pauseSave)
  results.push(
    'pending real save locks reset, activity selection, repeated save and editor keyboard edits',
  )
  const areaBox = await page.locator('.nl-editorArea').boundingBox()
  const editorBox = await editor.boundingBox()
  assert(editorBox.width > areaBox.width - 2 && editorBox.height >= 300)
  await editor.fill('def example():')
  await editor.press('End')
  await editor.press('Enter')
  assert.equal(await editor.inputValue(), 'def example():\n    ')
  await editor.press('Tab')
  await editor.press('Control+z')
  assert.equal(await editor.inputValue(), 'def example():\n    ')
  assert.equal(await page.locator('.nl-gutter > div').count(), 2)
  const separator = page.getByRole('separator', {
    name: '阅读与代码分隔器 Reading and code divider',
  })
  await separator.focus()
  await separator.press('ArrowRight')
  assert.equal(await separator.getAttribute('aria-valuenow'), '42')
  const beforeDrag = await page.locator('.nl-description').boundingBox()
  const dividerBox = await separator.boundingBox()
  await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + 60)
  await page.mouse.down()
  await page.mouse.move(dividerBox.x + 55, dividerBox.y + 60, { steps: 5 })
  await page.mouse.up()
  const afterDrag = await page.locator('.nl-description').boundingBox()
  assert(afterDrag.width > beforeDrag.width + 30)
  const beforeComposition = await editor.inputValue()
  const composing = await editor.evaluate((area) => {
    area.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '中' }))
    const events = ['Enter', 'Tab'].map(
      (key) =>
        new KeyboardEvent('keydown', {
          key,
          ctrlKey: key === 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
    )
    for (const event of events) area.dispatchEvent(event)
    area.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中' }))
    return events.map((event) => event.defaultPrevented)
  })
  assert.deepEqual(composing, [false, false])
  assert.equal(await editor.inputValue(), beforeComposition)
  assert.equal(await page.locator('.nl-results').count(), 0)
  assert.equal(await page.getByRole('listbox', { name: '代码补全 Completions' }).count(), 0)
  results.push(
    'pointer divider resize and synthetic composition Enter/Tab protection (not an OS IME test)',
  )
  await page.screenshot({ path: join(s.out, 'workbench-editor.png'), fullPage: true })
  results.push('Learn editor line numbers, autoindent, native undo and keyboard pane resizing')
  await editor.fill('# persisted UI draft\n')
  await page.getByRole('button', { name: /L02 / }).click()
  await page.getByRole('button', { name: /L01 / }).click()
  await editor.waitFor()
  await page.waitForFunction(
    () => document.querySelector('.nl-editorInput')?.value === '# persisted UI draft\n',
  )
  await page.reload()
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  await page.waitForFunction(
    () => document.querySelector('.nl-editorInput')?.value === '# persisted UI draft\n',
  )
  results.push('draft survives immediate lesson switch and reload')
  await page.getByRole('button', { name: '查看答案 Answer', exact: true }).click()
  await page.getByRole('tab', { name: '记录 Records' }).click()
  await page.getByText('帮助前快照 / Before assistance', { exact: true }).waitFor()
  const snapshot = page.locator('details').filter({ hasText: 'answer-reveal' }).first()
  await snapshot.locator('summary').click()
  await snapshot.getByRole('button', { name: '恢复此代码 Restore code' }).click()
  await page.waitForFunction(
    () => document.querySelector('.nl-editorInput')?.value === '# persisted UI draft\n',
  )
  results.push('pre-answer snapshot is visible and restores original unrun draft')
  await page.getByRole('button', { name: '学习档案 Profile' }).click()
  assert.equal(
    await page
      .getByRole('tab', { name: '档案 Profile', exact: true })
      .getAttribute('aria-selected'),
    'true',
  )
  assert.equal(await page.getByRole('heading', { name: /L01 ·/ }).count(), 0)
  await page.getByRole('textbox', { name: '常见卡点 Difficulties' }).fill('shape tracking')
  await page.getByRole('button', { name: '保存档案 Save profile' }).click()
  await page.getByRole('status').filter({ hasText: '档案已保存' }).waitFor()
  assert.equal(s.engine.overview().profile.difficulties, 'shape tracking')
  results.push('profile persisted through real HTTP/SQLite')
  await page.getByRole('button', { name: /L03 / }).click()
  await page.getByRole('tab', { name: '实验 Experiment' }).click()
  await page.waitForFunction(() =>
    document.querySelector('select')?.selectedOptions[0]?.textContent.includes('experiment'),
  )
  results.push('experiment tab selects real experiment')
  await page.getByRole('button', { name: '概念 Concept', exact: true }).click()
  await page.getByRole('textbox', { name: '提问 Question' }).fill('解释本课')
  await page.getByRole('button', { name: '询问导师 Ask mentor' }).click()
  await page
    .getByText('验证 profile 未配置模型 / No model configured', { exact: false })
    .first()
    .waitFor()
  results.push('hint and unavailable mentor remain usable')
  await page.getByRole('tab', { name: '记录 Records' }).click()
  await page.getByRole('textbox', { name: '学习笔记 Notes' }).fill('gradient notes')
  await page.getByRole('button', { name: '保存笔记 Save note' }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(s.out, 'regular.png'), fullPage: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.getByRole('tab', { name: '讲义 Lecture' }).click()
  await page.screenshot({ path: join(s.out, 'wide.png'), fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  results.push('1366 and 1920 layouts, no document horizontal overflow')
  if (process.env.NEURAL_UI_CPU === '1') {
    const lesson = s.engine.catalog.lessons.find((l) => l.id === 'L08'),
      exercise = lesson.exercises.find((e) => e.kind === 'experiment')
    await page.getByRole('button', { name: /L08 / }).click()
    await page.getByRole('tab', { name: '实验 Experiment' }).click()
    await page.waitForFunction(() =>
      document.querySelector('select')?.selectedOptions[0]?.textContent.includes('experiment'),
    )
    await page
      .getByRole('textbox', { name: 'Python 编辑器 Editor' })
      .fill("def configure():\n    return {'dim': 4, 'scale': False}\n")
    await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    await page.waitForFunction(
      () =>
        ['completed', 'failed', 'cancelled', 'timed_out'].some((status) =>
          document.querySelector('.nl-results')?.textContent.includes(status),
        ),
      {},
      { timeout: 120000 },
    )
    const rid = await page.locator('.nl-results').getAttribute('data-run-id')
    assert.equal(s.engine.run(rid).check_status, 'passed', JSON.stringify(s.engine.run(rid)))
    assert.deepEqual(s.engine.run(rid).effectiveConfig, { dim: 4, scale: false })
    assert.deepEqual(s.engine.run(rid).config, { seed: 42 })
    assert.equal(await page.getByRole('spinbutton', { name: /学习率|Steps/ }).count(), 0)
    await page.getByRole('table').first().waitFor()
    await page.locator('.nl-stat').first().waitFor()
    await page.screenshot({ path: join(s.out, 'actual-attention.png'), fullPage: true })
    await page.locator('.nl-results figure').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(s.out, 'actual-attention-results.png'), fullPage: true })
    results.push('real Docker attention run passed with traceable heatmap and metric curve')
    await page
      .getByRole('textbox', { name: 'Python 编辑器 Editor' })
      .fill('# changed after run\n' + exercise.reference)
    await page
      .getByText(
        '代码已修改；以下为先前快照结果，请重新运行。/ Code changed; previous snapshot result.',
      )
      .waitFor()
    await page.getByRole('textbox', { name: 'Python 编辑器 Editor' }).fill('while True: pass\n')
    await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    await page.getByRole('button', { name: '取消 Cancel', exact: true }).click()
    await page.waitForFunction(() =>
      document.querySelector('.nl-results')?.textContent.includes('cancelled'),
    )
    results.push('cancel actual run; stale result visibly labelled after edits')
    const training = s.engine.catalog.lessons
      .find((l) => l.id === 'L04')
      .exercises.find((e) => e.kind === 'experiment')
    await page.getByRole('button', { name: /L04 / }).click()
    await page.getByRole('tab', { name: '实验 Experiment' }).click()
    await page.waitForFunction(() =>
      document.querySelector('select')?.selectedOptions[0]?.textContent.includes('experiment'),
    )
    await page
      .getByRole('textbox', { name: 'Python 编辑器 Editor' })
      .fill("def configure():\n    return {'steps': 8, 'lr': 0.01}\n")
    await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    await page.waitForFunction(
      () =>
        ['completed', 'failed', 'cancelled', 'timed_out'].some((status) =>
          document.querySelector('.nl-results')?.textContent.includes(status),
        ),
      {},
      { timeout: 120000 },
    )
    const trainingId = await page.locator('.nl-results').getAttribute('data-run-id')
    assert.equal(
      s.engine.run(trainingId).check_status,
      'passed',
      JSON.stringify(s.engine.run(trainingId)),
    )
    assert(s.engine.run(trainingId).events.filter((e) => e.type === 'metric').length > 10)
    await page.locator('.nl-results figure').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(s.out, 'actual-training-curve.png'), fullPage: true })
    assert.deepEqual(s.engine.run(trainingId).effectiveConfig, { steps: 8, lr: 0.01 })
    assert.equal(
      await page.getByRole('img', { name: '共享 Loss 曲线 Shared loss chart' }).count(),
      1,
    )
    assert.equal(
      await page
        .getByRole('img', { name: '共享 Loss 曲线 Shared loss chart' })
        .locator('[data-series]')
        .count(),
      4,
    )
    await page
      .getByRole('textbox', { name: 'Python 编辑器 Editor' })
      .fill("def configure():\n    return {'steps': 12, 'lr': 0.02}\n")
    await page.getByRole('button', { name: '运行 / 提交 Run & check' }).click()
    await page.waitForFunction(
      () =>
        ['completed', 'failed'].some((status) =>
          document.querySelector('.nl-results')?.textContent.includes(status),
        ),
      {},
      { timeout: 120000 },
    )
    const changedId = await page.locator('.nl-results').getAttribute('data-run-id')
    assert.notEqual(changedId, trainingId)
    assert.equal(s.engine.run(changedId).check_status, 'passed')
    assert.deepEqual(s.engine.run(changedId).effectiveConfig, { steps: 12, lr: 0.02 })
    assert.deepEqual(s.engine.run(trainingId).effectiveConfig, { steps: 8, lr: 0.01 })
    results.push(
      'configure-only parameters preserved in immutable runs; changed steps/lr actually applied; loss shares one chart',
    )
  }
  await page.getByRole('tab', { name: '讲义 Lecture' }).click()
  const originalHash = new URL(page.url()).hash
  await page.locator('.nl-anchors button').first().click()
  assert.equal(new URL(page.url()).hash, originalHash)
  results.push('profile selected tab and lecture anchors preserve host URL hash')
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  for (const width of [900, 640]) {
    await page.setViewportSize({ width, height: 900 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    assert.equal(await page.getByRole('separator').isVisible(), false)
    const description = await page.locator('.nl-description').boundingBox(),
      editorPane = await page.locator('.nl-code-pane').boundingBox()
    assert(editorPane.y >= description.y + description.height - 1)
    await page.screenshot({ path: join(s.out, `workbench-${width}.png`), fullPage: true })
  }
  results.push('900px and 640px panes stack without horizontal overflow')
  results.push(
    ...(await checkIndependentScrolling(page, (width) => join(s.out, `scroll-${width}.png`))),
  )
  await page.setViewportSize({ width: 1366, height: 1000 })
  await page.goto(s.url + '/?component=chart-fixture')
  await page.getByRole('heading', { name: 'Component fixture — not a learner run' }).waitFor()
  assert.equal(await page.locator('.nl-stat svg').count(), 0)
  assert.equal(await page.locator('.nl-stat strong').getAttribute('title'), '1.234567890123')
  assert.equal(await page.getByRole('img', { name: '共享 Loss 曲线 Shared loss chart' }).count(), 1)
  assert.equal(
    await page
      .getByRole('img', { name: '共享 Loss 曲线 Shared loss chart' })
      .locator('[data-series]')
      .count(),
    2,
  )
  const ys = await page
    .getByRole('img', { name: 'constant 曲线' })
    .locator('circle')
    .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute('cy'))))
  assert(ys.every((y) => Math.abs(y - 85) < 0.001))
  await page.screenshot({ path: join(s.out, 'chart-component-fixture.png'), fullPage: true })
  results.push(
    'isolated chart fixture: exact scalar, shared loss axes and centered constant series',
  )
  await page.goto(s.url + '/?component=readonly-editor')
  const readonly = page.getByRole('textbox', { name: 'Readonly editor' })
  await readonly.focus()
  await readonly.press('Tab')
  await readonly.focus()
  await readonly.press('Enter')
  await readonly.press('Control+Enter')
  assert.equal(await readonly.inputValue(), 'x = 1')
  assert.equal(await page.getByLabel('Fixture run count').textContent(), '0')
  results.push('readonly editor ignores indentation and run shortcuts without changing draft')
  assert.deepEqual(errors, [])
  await writeFile(
    join(s.out, process.env.NEURAL_UI_CPU === '1' ? 'validation-cpu.json' : 'validation-ui.json'),
    JSON.stringify(
      {
        pluginVersion: JSON.parse(
          await readFile(join(import.meta.dirname, '../package.json'), 'utf8'),
        ).version,
        profile: s.profile,
        results,
        errors,
        limits: [
          'Real engine and HTTP adapter, not full DSH client loader',
          'No live model credentials',
          ...(process.env.NEURAL_UI_CPU === '1'
            ? []
            : ['CPU runs not included in this invocation']),
        ],
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ results, errors, out: s.out }, null, 2))
} finally {
  try {
    await browser?.close()
  } finally {
    await s.close()
  }
}
