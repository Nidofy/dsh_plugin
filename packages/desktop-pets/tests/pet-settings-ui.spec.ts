// @vitest-environment jsdom
/** Pet master switch uses the rendered management document and an isolated settings store. */
import { Script } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import { extrasHtml } from '../src/ui.ts'
import { defaults } from '../src/state.ts'

afterEach(() => { document.body.replaceChildren() })

it.each([false, true])('saves the master switch without a second visit and preserves other settings (Chinese=%s)', async (chinese) => {
  let saved = defaults(), fail = false
  const writes: unknown[] = []
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ preferences: saved, features: {} })
    if (url.endsWith('/preferences')) {
      if (fail) return Response.json({ error: 'SAVE_FAILED' }, { status: 500 })
      if (typeof init.body !== 'string') throw Error('JSON required')
      saved = JSON.parse(init.body) as typeof saved; writes.push(saved)
      return Response.json(saved)
    }
    if (url.endsWith('/models') || url.endsWith('/diagnostics/list')) return Response.json([])
    if (url.endsWith('/pet/packages')) return Response.json({ items: [{ id: 'xiaojing', displayName: 'Pet' }] })
    return Response.json({ records: [] })
  })
  const page = extrasHtml(chinese), script = page.match(/<script>([\s\S]*)<\/script>/)?.[1]
  if (!script) throw Error('Missing management script')
  document.body.innerHTML = page.replace(/<script>[\s\S]*<\/script>/, '')
  new Script(script).runInNewContext({ document, fetch, location: { search: '?tab=pets' }, URLSearchParams,
    setInterval: () => 1, clearInterval: () => {}, window, crypto: {}, structuredClone })
  await vi.waitFor(() => { expect(document.querySelector('#petinstance option')).not.toBeNull() })
  const toggle = document.querySelector<HTMLInputElement>('[data-feature=pets]')!
  const initial = structuredClone(saved)
  toggle.click()
  expect(toggle.disabled).toBe(true)
  await vi.waitFor(() => { expect(writes).toHaveLength(1); expect(toggle.disabled).toBe(false) })
  expect(saved).toEqual({ ...initial, pets: !initial.pets })
  fail = true; toggle.click()
  await vi.waitFor(() => { expect(toggle.disabled).toBe(false) })
  expect(toggle.checked).toBe(saved.pets)
  expect(document.getElementById('status')?.textContent).toBe('SAVE_FAILED')
  fail = false; toggle.click()
  await vi.waitFor(() => { expect(writes).toHaveLength(2) })
  expect(saved).toEqual(initial)
})
