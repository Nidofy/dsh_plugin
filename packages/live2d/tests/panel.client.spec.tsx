// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Floating, initialPresentation } from '../src/client/Floating.tsx'
import { staticPortraitGeometry, rasterSize } from '../src/client/presentation.ts'

vi.mock('../src/client/floating-layout.ts', () => ({ attachFloatingLayout: (_: unknown, publish: (value: unknown) => void) => { publish({ left: 800, top: 80, height: 700 }); return () => {} } }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
it('bounds corrupt preferences and obeys reduced motion on first use', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  expect(initialPresentation().animation).toBe(false)
  localStorage.setItem('nidofy.live2d.presentation.v1', '{"camera":99,"panX":-9,"panY":"bad","animation":false}')
  expect(initialPresentation()).toEqual({ camera: 1, panX: -.15, panY: 0, animation: false })
  expect(rasterSize(8000, 8000, 3).width ** 2).toBeLessThanOrEqual(4_000_000)
  expect(staticPortraitGeometry(340, 400, { camera: 0, panX: 0, panY: 0, animation: false })).toEqual(staticPortraitGeometry(340, 400, { camera: .5, panX: 0, panY: 0, animation: false }))
})
it('shows a non-modal card, changes framing without replacing the iframe, and releases it when animation stops', () => {
  const close = vi.fn()
  render(<Floating locale="en" status="working" onClose={close} />)
  const frame = document.querySelector('iframe')!
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByText('Working')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
  fireEvent.click(screen.getByRole('button', { name: 'Portrait' }))
  expect(document.querySelector('iframe')).toBe(frame)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Animation' }))
  expect(document.querySelector('iframe')).toBeNull()
  fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' }); expect(close).toHaveBeenCalledOnce()
})
