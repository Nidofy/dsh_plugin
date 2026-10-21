import assert from 'node:assert/strict'
import { copyFile } from 'node:fs/promises'
import { join } from 'node:path'
export async function browserCheck(browser, server, qa, videoDirectory) {
  const errors = [], external = [], runs = []
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 920 }, deviceScaleFactor: dpr })
    await context.route('**/*', route => {
      const url = route.request().url()
      if (url.startsWith(server.url + '/') || url.startsWith('blob:')) return route.continue()
      external.push(url); return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    const inspect = () => page.evaluate(() => window.__village.inspect())
    const ready = async () => {
      await page.waitForFunction(() => window.__village?.inspect().ready || window.__village?.inspect().error)
      assert.equal((await inspect()).error, '')
      await page.waitForFunction(() => !window.__village.inspect().saving)
    }
    await page.goto(server.url); await ready()
    if ((await inspect()).world.userPaused) await page.locator('#pause').click()
    const frame = () => page.frames().find(f => f.url().endsWith('/frame'))
    const info = await frame().evaluate(() => {
      let isolated = false
      try { void parent.document.body } catch { isolated = true }
      return { isolated, canvas: { width: document.querySelector('canvas').width, height: document.querySelector('canvas').height },
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content }
    })
    assert.ok(info.isolated && info.csp.includes("connect-src 'none'") && !info.csp.includes('unsafe-eval'))
    const coords = async p => {
      const box = await page.locator('iframe').boundingBox(), scale = Math.min(box.width / 360, box.height / 480)
      return { x: box.x + (box.width - 360 * scale) / 2 + p.x * scale, y: box.y + (box.height - 480 * scale) / 2 + p.y * scale }
    }
    const drag = async (target, finish = true) => {
      const actor = (await inspect()).world.actor, start = await coords({ x: actor.position.x, y: actor.position.y - 45 })
      const end = await coords({ x: target.x, y: target.y - 45 })
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 })
      if (finish) await page.mouse.up()
      await page.waitForTimeout(100) // Cross-frame postMessage delivery is asynchronous.
    }
    await page.screenshot({ path: join(qa, `initial-dpr${dpr}.png`) })
    for (const hotspot of server.scene.hotspots) {
      await drag(hotspot.anchor)
      await page.waitForFunction(id => window.__village.inspect().world.actor.behavior === id, hotspot.id)
      await page.waitForTimeout(1100)
      const state = await inspect()
      assert.deepEqual(state.world.actor.position, hotspot.anchor); assert.equal(state.drag, null); assert.equal(state.error, '')
      await page.screenshot({ path: join(qa, `${hotspot.id}-dpr${dpr}.png`) })
      await page.locator('#scene-container').screenshot({ path: join(qa, `${hotspot.id}-scene-dpr${dpr}.png`) })
    }
    const beforeBad = (await inspect()).world.actor.position
    await drag({ x: -50, y: 100 }); assert.deepEqual((await inspect()).world.actor.position, beforeBad)
    assert.equal((await inspect()).placement, 'rejected')
    await drag({ x: 170, y: 360 }, false)
    assert.ok((await inspect()).drag?.active)
    await page.keyboard.press('Escape'); await page.mouse.up()
    await page.waitForFunction(() => !window.__village.inspect().drag)
    assert.equal((await inspect()).drag, null); assert.deepEqual((await inspect()).world.actor.position, beforeBad)
    await drag({ x: 170, y: 360 }, false)
    await page.evaluate(() => window.__village.hide(true)); await page.mouse.up()
    const hidden = await inspect(); assert.equal(hidden.drag, null); assert.equal(page.frames().length, 1)
    await page.waitForTimeout(300); assert.deepEqual((await inspect()).world, hidden.world)
    await page.evaluate(() => window.__village.hide(false)); await ready()
    await page.locator('#pause').click()
    const paused = (await inspect()).world
    await frame().waitForFunction(() => window.__sceneMetrics().paused)
    const stopped = await frame().evaluate(() => window.__sceneMetrics())
    await page.waitForTimeout(300)
    assert.equal((await frame().evaluate(() => window.__sceneMetrics())).frames, stopped.frames)
    assert.equal(stopped.tickerStarted, false)
    await page.locator('#toggle').click(); await page.locator('#toggle').click(); await ready()
    await page.waitForTimeout(300); assert.deepEqual((await inspect()).world, paused)
    assert.ok((await inspect()).pauses.includes('user'))
    if (dpr === 1) {
      for (let i = 0; i < 10; i++) {
        const oldToken = (await inspect()).token
        await page.evaluate(() => window.__village.hide(true))
        assert.equal(await page.locator('iframe').count(), 0)
        await page.evaluate(() => window.__village.hide(false)); await ready()
        assert.notEqual((await inspect()).token, oldToken)
        assert.equal(await page.locator('iframe').count(), 1)
        const metrics = await frame().evaluate(() => window.__sceneMetrics())
        assert.equal(metrics.textures, 34); assert.equal(metrics.tickerStarted, false)
        assert.deepEqual((await inspect()).world, paused)
      }
    }
    await page.evaluate(() => window.__village.flush())
    const saved = await inspect()
    await page.reload(); await ready()
    assert.deepEqual((await inspect()).world, saved.world); assert.equal((await inspect()).revision, saved.revision)
    const second = await context.newPage(); await second.goto(server.url)
    await second.waitForFunction(() => !!window.__village?.inspect().error)
    assert.match(await second.evaluate(() => window.__village.inspect().error), /WORLD_IN_USE/)
    assert.equal(await second.locator('iframe').count(), 0); await second.close(); await page.bringToFront(); await ready()
    await page.locator('#pause').click()
    for (const width of ['300', '480']) {
      await page.locator('#size').selectOption(width)
      await page.waitForTimeout(150)
      const x = width === '300' ? 173 : 183
      await drag({ x, y: 365 })
      assert.equal((await inspect()).world.actor.behavior, 'put_down', JSON.stringify(await inspect()))
      assert.ok(Math.abs((await inspect()).world.actor.position.x - x) < 1)
      await page.waitForTimeout(650)
    }
    await page.evaluate(() => { const c = document.getElementById('scene-container'); c.style.width = '420px'; c.style.height = '480px'; c.style.aspectRatio = 'auto' })
    await page.waitForTimeout(150)
    await drag(server.scene.hotspots[0].anchor)
    assert.equal((await inspect()).world.actor.behavior, 'work')
    // Drop an acknowledgement after the host commits; client must observe operationId, not replay.
    let dropped = 0
    await page.route('**/api/state', async route => {
      if (route.request().method() === 'POST' && dropped++ === 0) { await route.fetch(); await route.abort() }
      else await route.continue()
    })
    await page.evaluate(() => window.__village.flush())
    assert.equal((await inspect()).error, ''); assert.ok(dropped >= 1)
    await page.unroute('**/api/state')
    await page.locator('#language').click(); assert.equal(await page.locator('h1').innerText(), 'A little day in the courtyard')
    await page.locator('#language').click()
    await page.evaluate(() => window.__village.flush())
    await page.locator('#pause').click(); await page.waitForFunction(() => !window.__village.inspect().saving)
    const metrics = await frame().evaluate(() => window.__sceneMetrics())
    runs.push({ dpr, isolation: info, renderMetrics: metrics, status: 'passed', checks: ['three activity drops', 'outside capture and rejection', 'Escape cancellation', 'hidden drag rollback',
      'hidden stops simulation', 'user pause survives remount', 'reload restores exact saved world', 'second tab rejected', '300/480px and letterbox coordinates', 'uncertain ACK readback', 'bilingual UI'] })
    // Explicit test teardown: invoke page cleanup while its routed context is still alive.
    // Abrupt context destruction can discard keepalive and correctly retain the 15s lease.
    const released = page.waitForResponse(response => response.url() === server.url + '/api/release' && response.status() === 200)
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await released
    await page.close(); await context.close()
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  await recordDemo(browser, server, qa, videoDirectory)
  return { runs, errors, external }
}

/** A separate review recording keeps rapid lifecycle stress checks out of the visual demo. */
export async function recordDemo(browser, server, qa, videoDirectory) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 920 }, deviceScaleFactor: 1,
    recordVideo: { dir: videoDirectory, size: { width: 1200, height: 920 } } })
  const page = await context.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', route => route.request().url().startsWith(server.url + '/') || route.request().url().startsWith('blob:')
    ? route.continue() : route.abort())
  try {
    await page.goto(server.url)
    await page.waitForFunction(() => window.__village?.inspect().ready || window.__village?.inspect().error)
    assert.equal(await page.evaluate(() => window.__village.inspect().error), '')
    if (await page.evaluate(() => window.__village.inspect().world.userPaused)) await page.locator('#pause').click()
    const drag = async (point, held = false) => {
      const actor = await page.evaluate(() => window.__village.inspect().world.actor.position)
      const box = await page.locator('iframe').boundingBox()
      await page.mouse.move(box.x + actor.x, box.y + actor.y - 45)
      await page.mouse.down()
      await page.mouse.move(box.x + point.x, box.y + point.y - 45, { steps: 30 })
      if (!held) await page.mouse.up()
      await page.waitForTimeout(120)
    }
    await drag({ x: 173, y: 365 }); await page.waitForTimeout(1800)
    for (const hotspot of server.scene.hotspots) {
      await drag(hotspot.anchor)
      await page.waitForFunction(id => window.__village.inspect().world.actor.behavior === id, hotspot.id)
      await page.waitForTimeout(3500)
    }
    await drag({ x: 174, y: 337 }, true); await page.waitForTimeout(1800)
    await page.mouse.up(); await page.waitForTimeout(2500)
    await page.locator('#pause').click(); await page.evaluate(() => window.__village.flush())
    assert.deepEqual(errors, [])
  } finally {
    const video = page.video()
    await page.close(); await context.close()
    await copyFile(await video.path(), join(qa, 'scene-demo.webm'))
  }
}
