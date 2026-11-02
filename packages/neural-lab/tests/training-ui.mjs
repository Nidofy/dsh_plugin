import assert from 'node:assert/strict'
export async function checkEditableTraining(page, exercise) {
  await page.getByRole('button', { name: new RegExp('^' + exercise.lessonId + ' ') }).click()
  await page.getByRole('tab', { name: '练习 Exercise' }).click()
  await page.getByLabel('当前活动 Activity').selectOption(exercise.id)
  const editor = page.getByRole('textbox', { name: 'Python 编辑器 Editor' })
  const prediction = page.getByLabel('运行前预测 Prediction')
  await prediction.waitFor()
  const start = page.getByRole('button', { name: '运行 / 提交 Run & check' })
  assert(await start.isDisabled())
  const runs = []
  for (const rate of ['0.05', '0.2']) {
    await editor.fill(exercise.reference + (runs.length ? '\n# compare rates\n' : ''))
    await prediction.fill('Prediction at rate ' + rate)
    await page.getByLabel('学习率 Learning rate').fill(rate)
    const started = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/neural-lab/rpc') && r.request().postDataJSON()?.method === 'start',
    )
    await start.click()
    const current = await (await started).json()
    assert.ok(current.id && current.prediction.includes(rate))
    await page
      .locator('.nl-results[data-run-id="' + current.id + '"] .nl-verdict-passed')
      .waitFor({ timeout: 120000 })
    if (exercise.runtimeKey === 'train-char-v1')
      assert.match(
        await page
          .locator('.nl-results[data-run-id="' + current.id + '"] p')
          .filter({ hasText: 'Generated text' })
          .innerText(),
        /[abcde]{17}/,
      )
    runs.push(current.id)
  }
  const comparison = page.getByRole('region', { name: '同种子运行对照 Run comparison' })
  assert.equal(await comparison.locator('svg [data-series]').count(), 4)
  assert.deepEqual(
    new Set([
      await comparison.getByLabel('目标运行 A').inputValue(),
      await comparison.getByLabel('比较运行 B').inputValue(),
    ]),
    new Set(runs),
  )
  assert.match(await comparison.getByLabel('代码差异 Code diff').textContent(), /compare rates/)
  await page.getByLabel('解释对应运行 Run').selectOption(runs[0])
  await page
    .getByLabel('我的解释 Reflection')
    .fill('The held-out MSE tests my prediction independently.')
  await page.getByRole('button', { name: /Save reflection/ }).click()
  await page
    .getByText('先前解释 / Reflection: The held-out MSE tests my prediction independently.')
    .waitFor()
  await page.getByRole('tab', { name: '记录 Records' }).click()
  const answer = page
    .locator('details')
    .filter({
      has: page.getByText('The held-out MSE tests my prediction independently.', { exact: true }),
    })
    .last()
  await answer.locator('summary').click()
  await answer.getByText('Run ' + runs[0], { exact: true }).waitFor()
  await page
    .getByRole('button', { name: new RegExp('Revisit prediction and explanation.*' + runs[0]) })
    .click()
  assert.equal(await page.getByLabel('解释对应运行 Run').inputValue(), runs[0])
  await page.getByRole('button', { name: /Finish review/ }).click()
  await page.getByRole('button', { name: /Finish review/ }).waitFor({ state: 'hidden' })
  return {
    runs,
    checks: [
      'prediction',
      'two independently checked runs',
      'code/config and four curves',
      'linked reflection',
      'review completed',
    ],
  }
}
