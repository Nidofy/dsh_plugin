// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EntranceOverlay } from '../src/client/EntranceOverlay.tsx'
import { EntranceCoordinator } from '../src/client/entrance-state.ts'
import type { VillageRuntime } from '../src/client/runtime.ts'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function fixture(ready = false, reduced = false) {
  const entrance = new EntranceCoordinator(); entrance.open(); entrance.metadata = true; entrance.verified = 1; entrance.decoded = 1
  const listeners = new Set<() => void>()
  const runtime = { entrance, canRevealEntrance: ready, preferences: { reducedMotion: reduced }, softwareRendering: true,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
    skipEntrance: () => entrance.skip(), finishEntrance: vi.fn() }
  const view = () => <EntranceOverlay runtime={runtime as unknown as VillageRuntime} cn close={() => {}}/>
  const ui = render(view())
  const update = async () => { await act(async () => { ui.rerender(view()); listeners.forEach(fn => fn()) }) }
  const fills = () => [...ui.container.querySelectorAll<HTMLImageElement>('.entrance-portrait img+img')].map(img => {
    const match = /^inset\(0 ([-\d.]+)% 0 0\)$/.exec(img.style.clipPath)
    expect(match, 'Only the right edge clips color; no vertical fill').not.toBeNull()
    return 1 - Number(match![1]) / 100
  })
  return { runtime, ui, update, fills }
}
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

it('shows all seven portraits in left-to-right order even when verified progress starts at 95%', async () => {
  const { runtime, fills, update } = fixture()
  expect(fills()).toEqual(Array(7).fill(0))
  const seen = new Set<number>()
  for (let i=0;i<40;i++) {
    await advance(20); const values = fills()
    for(let j=0;j<7;j++) if(values[j]!>0&&values[j]!<1) {
      seen.add(j); expect(values.slice(0,j).every(n=>n===1)).toBe(true); expect(values.slice(j+1).every(n=>n===0)).toBe(true)
    }
    expect(values.reduce((a,b)=>a+b,0)/7).toBeLessThanOrEqual(.95+1e-9)
  }
  expect([...seen]).toEqual([0,1,2,3,4,5,6]); expect(runtime.finishEntrance).not.toHaveBeenCalled()
  runtime.canRevealEntrance = true; await update(); await advance(100)
  expect(fills()).toEqual(Array(7).fill(1)); expect(runtime.finishEntrance).toHaveBeenCalledOnce()
})
it('keeps the curtain until a fast ready load has visibly filled all portraits, and cancels on unmount', async () => {
  const { runtime, ui, fills } = fixture(true)
  await advance(300); expect(runtime.finishEntrance).not.toHaveBeenCalled(); expect(fills()[6]).toBe(0)
  ui.unmount(); await advance(1000); expect(runtime.finishEntrance).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
})
it.each(['reduced','skip'] as const)('%s bypasses visual catch-up but never bypasses first-frame readiness', async mode => {
  const { runtime, update, fills } = fixture(false, mode==='reduced')
  if(mode==='skip'){runtime.entrance.skip();await update()}
  expect(fills().slice(0,6)).toEqual(Array(6).fill(1)); expect(fills()[6]).toBeCloseTo(.65)
  await advance(1000); expect(runtime.finishEntrance).not.toHaveBeenCalled()
  runtime.canRevealEntrance = true; await update(); expect(runtime.finishEntrance).toHaveBeenCalledOnce()
})
