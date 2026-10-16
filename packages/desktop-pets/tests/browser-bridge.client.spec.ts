// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
// Browser assets are plain ESM and shipped without TypeScript.
// @ts-expect-error JavaScript asset has no declaration file.
import { installBrowserBridge } from '../assets/pet/browser-bridge.js'
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Reflect.deleteProperty(window, 'nidofyPet') })

it('uses authenticated pet routes, refuses native-only actions and aborts on disposal', async () => {
  vi.useFakeTimers()
  const fetch = vi.fn(async (_url: string, _input: RequestInit) => Response.json({ settings: { id: '1' }, state: { items: [] } }))
  vi.stubGlobal('fetch', fetch)
  const stop = installBrowserBridge()
  const bridge = (window as Window & { nidofyPet: { invoke(method: string, input?: object): Promise<unknown>; listen(name: string, cb: (event: unknown) => void): Promise<() => void> } }).nidofyPet
  await bridge.invoke('pet_snapshot')
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/nidofy-pets/pet/snapshot')
  const signal = fetch.mock.calls[0]?.[1].signal
  await expect(bridge.invoke('pet_action', { action: 'navigate' })).rejects.toThrow('PET_DESKTOP_REQUIRED')
  await bridge.invoke('pet_action', { action: 'drag', target: { x: 3, y: 5 } })
  expect(fetch).toHaveBeenCalledTimes(1)
  const events = vi.fn(); await bridge.listen('pet-state', events)
  await vi.advanceTimersByTimeAsync(1500)
  expect(events).toHaveBeenCalledTimes(1)
  stop()
  expect(signal?.aborted).toBe(true)
  const count = fetch.mock.calls.length
  await vi.advanceTimersByTimeAsync(6000)
  expect(fetch).toHaveBeenCalledTimes(count)
})
