import { expect, it } from 'vitest'
import { renderResolution } from '../src/frame/quality.ts'
it('supersamples 100% screens and limits backing pixels on large canvases',()=>{
  expect(renderResolution(1,340,480)).toBe(2)
  expect(renderResolution(2,340,480)).toBe(2)
  expect(renderResolution(3,340,480)).toBe(3)
  const ratio=renderResolution(4,1920,1080)
  expect(1920*1080*ratio*ratio).toBeLessThanOrEqual(4_000_001)
})
