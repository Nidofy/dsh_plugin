// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { attachFloatingLayout, type FloatingGeometry } from '../src/client/floating-layout.ts'
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })
it('reserves only the main chat, yields to sidebar, restores, handles resize/navigation and disposes', async () => {
 let resize = () => {}
 const disconnect = vi.fn()
 vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} unobserve() {} disconnect = disconnect })
 document.body.innerHTML = '<div data-rightbar-collapsed><div></div><main><div data-conversation-content></div></main><div data-rightbar-col><div data-conversation-content></div></div><div data-shell-overlay><div id="anchor"></div></div></div>'
 const frame = document.body.firstElementChild!, center = frame.querySelector('main')!, chat = center.firstElementChild!
 let width = 1200
 center.getBoundingClientRect = () => ({ right: 1500, width } as DOMRect)
 const rect = () => ({ top: 76, height: 800 } as DOMRect)
 chat.getBoundingClientRect = rect
 const values: (FloatingGeometry | null)[] = []
 const dispose = attachFloatingLayout(document.getElementById('anchor')!, g => values.push(g))
 expect(values.at(-1)).toEqual({ left: 1148, top: 88, height: 776 })
 expect(chat.hasAttribute('data-nidofy-vcs-space')).toBe(true)
 expect(frame.querySelector('[data-rightbar-col] [data-nidofy-vcs-space]')).toBeNull()
 frame.removeAttribute('data-rightbar-collapsed'); await Promise.resolve()
 expect(values.at(-1)).toBeNull(); expect(chat.hasAttribute('data-nidofy-vcs-space')).toBe(false)
 frame.setAttribute('data-rightbar-collapsed', ''); await Promise.resolve()
 expect(values.at(-1)).not.toBeNull()
 width = 600; resize(); expect(values.at(-1)).toBeNull()
 width = 1200; resize(); expect(values.at(-1)).not.toBeNull()
 const next = document.createElement('div'); next.setAttribute('data-conversation-content', ''); next.getBoundingClientRect = rect
 center.replaceChildren(next); await Promise.resolve()
 expect(chat.hasAttribute('data-nidofy-vcs-space')).toBe(false)
 expect(next.hasAttribute('data-nidofy-vcs-space')).toBe(true)
 frame.setAttribute('data-rightbar-fullscreen', ''); await Promise.resolve(); expect(values.at(-1)).toBeNull()
 frame.removeAttribute('data-rightbar-fullscreen'); await Promise.resolve()
 dispose(); expect(next.hasAttribute('data-nidofy-vcs-space')).toBe(false); expect(disconnect).toHaveBeenCalledOnce()
})
it('leaves unsupported host layouts untouched', () => {
 const anchor = document.createElement('div'), publish = vi.fn()
 attachFloatingLayout(anchor, publish)()
 expect(publish).toHaveBeenCalledExactlyOnceWith(null)
})
