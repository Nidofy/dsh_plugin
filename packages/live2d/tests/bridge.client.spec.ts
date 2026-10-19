// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { attachFrame } from '../src/client/bridge.ts'
import { channel } from '../src/protocol.ts'

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('ignores unrelated documents, times out stalled loads, and cancels requests on disposal', async () => {
  vi.useFakeTimers()
  const frame = document.createElement('iframe'); document.body.append(frame)
  const failed = vi.fn(), rendered = vi.fn(), signals: AbortSignal[] = []
  const fetch = vi.fn((_url: string, options: RequestInit) => {
    signals.push(options.signal!); return new Promise<Response>(() => {})
  })
  vi.stubGlobal('fetch', fetch)
  const bridge = attachFrame(frame, rendered, failed)
  const message = (source: Window | null, origin = 'null') => window.dispatchEvent(new MessageEvent('message', { source, origin, data: { channel, type: 'ready' } }))
  message(window); message(frame.contentWindow, 'https://elsewhere.invalid')
  expect(fetch).not.toHaveBeenCalled()
  message(frame.contentWindow); message(frame.contentWindow)
  expect(fetch).toHaveBeenCalledTimes(3)
  bridge.dispose(); expect(signals.every(signal => signal.aborted)).toBe(true)
  vi.advanceTimersByTime(30000); expect(failed).not.toHaveBeenCalled(); expect(rendered).not.toHaveBeenCalled()
  const second = attachFrame(frame, rendered, failed)
  vi.advanceTimersByTime(20000); expect(failed).toHaveBeenCalledOnce(); second.dispose()
})
it('reports context loss even after rendering and ignores late notifications after teardown', () => {
  const frame = document.createElement('iframe'); document.body.append(frame)
  const rendered = vi.fn(), failed = vi.fn(), bridge = attachFrame(frame, rendered, failed)
  const notify = (type: string) => window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, origin: 'null', data: { channel, type } }))
  notify('rendered'); expect(rendered).toHaveBeenCalledOnce()
  notify('failed'); expect(failed).toHaveBeenCalledOnce()
  bridge.dispose(); notify('rendered'); expect(rendered).toHaveBeenCalledOnce()
})
