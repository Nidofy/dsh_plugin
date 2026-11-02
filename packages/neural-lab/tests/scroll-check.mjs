import assert from 'node:assert/strict'

/** Real wheel input against both scroll panes, also used inside the official host. */
export async function checkIndependentScrolling(page, screenshot) {
  const sidebar = page.locator('.nl-sidebar')
  const content = page.locator('.nl-center')
  const top = (locator) => locator.evaluate((element) => element.scrollTop)
  const wheel = async (locator, delta) => {
    const box = await locator.boundingBox()
    await page.mouse.move(box.x + 8, box.y + Math.min(80, box.height / 2))
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(180)
  }
  const results = []
  for (const width of [1366, 1920, 900, 640]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('tab', { name: '讲义 Lecture', exact: true }).click()
    await page.getByRole('button', { name: /^L01 / }).click()
    await page.getByRole('heading', { name: 'L01 · 张量与广播', exact: true }).waitFor()
    await sidebar.evaluate((element) => element.scrollTo(0, 0))
    await content.evaluate((element) => element.scrollTo(0, 0))
    assert(await sidebar.evaluate((element) => element.scrollHeight > element.clientHeight))
    assert(await content.evaluate((element) => element.scrollHeight > element.clientHeight))

    await wheel(content, 340)
    await page.waitForFunction(() => document.querySelector('.nl-center').scrollTop > 0)
    assert.equal(await top(sidebar), 0, 'Reading must not move the curriculum')
    const readingPosition = await top(content)
    await wheel(sidebar, 430)
    await page.waitForFunction(() => document.querySelector('.nl-sidebar').scrollTop > 0)
    assert.equal(await top(content), readingPosition, 'Curriculum wheel must not move reading')

    await sidebar.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    await wheel(sidebar, 600)
    assert.equal(await top(content), readingPosition, 'Sidebar boundary must not chain to reading')
    const sidebarPosition = await top(sidebar)
    await content.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    await wheel(content, 600)
    assert.equal(await top(sidebar), sidebarPosition, 'Reading boundary must not move the sidebar')
    assert.equal(await page.locator('.neural-lab').evaluate((element) => element.scrollTop), 0)
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), 0)

    const nextLesson = page.getByRole('button', { name: /^L12 / })
    await nextLesson.scrollIntoViewIfNeeded()
    const beforeNavigation = await top(sidebar)
    await nextLesson.click()
    await page.getByRole('heading', { name: /L12 ·/ }).waitFor()
    assert.equal(await top(content), 0, 'New lesson starts at the top')
    assert.equal(
      await top(sidebar),
      beforeNavigation,
      'Lesson navigation retains curriculum position',
    )

    await wheel(content, 300)
    await page.waitForFunction(() => document.querySelector('.nl-center').scrollTop > 0)
    const hash = new URL(page.url()).hash
    await page.locator('.nl-anchors button').last().click()
    await page.waitForTimeout(350)
    assert.equal(new URL(page.url()).hash, hash)
    assert.equal(await top(sidebar), beforeNavigation, 'Lecture anchors scroll only reading')
    await page.getByRole('tab', { name: '练习 Exercise', exact: true }).click()
    assert.equal(await top(content), 0, 'New tab starts at the top')
    await page.getByRole('textbox', { name: 'Python 编辑器 Editor' }).waitFor()
    await content.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    await page.getByLabel('当前活动 Activity').selectOption('L12-check')
    await page.getByRole('textbox', { name: '我的作答 Answer' }).waitFor()
    assert.equal(await top(content), 0, 'New activity starts at the top after async loading')

    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    if (screenshot) await page.screenshot({ path: screenshot(width), fullPage: true })
    results.push(
      `${width}px: independent wheel and boundary scrolling, lesson/tab/activity reset, anchors`,
    )
  }
  await page.setViewportSize({ width: 1366, height: 900 })
  return results
}
