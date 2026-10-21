// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import { attachFloatingLayout as village, type FloatingGeometry } from '../src/client/floating-layout.ts'
import { attachFloatingLayout as git } from '../../source-control/src/client/floating-layout.ts'
it('stacks Git above the village, shares one width, restores either panel and releases markers', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  document.body.innerHTML = '<div data-rightbar-collapsed><main><div data-conversation-content></div></main><div data-rightbar-col></div><div data-shell-overlay><div id="game" data-nidofy-village-open></div><div id="git" data-nidofy-vcs-overlay></div></div></div>'
  const frame = document.body.firstElementChild!, chat = frame.querySelector('[data-conversation-content]')!
  frame.querySelector('main')!.getBoundingClientRect = () => ({ right: 1300, width: 1000 } as DOMRect)
  chat.getBoundingClientRect = () => ({ top: 70, height: 800 } as DOMRect)
  let game: FloatingGeometry | null = null, vcs: FloatingGeometry | null = null
  const values = { game: () => game!, git: () => vcs! }
  const stopGame = village(document.getElementById('game')!, g => { game = g })
  const stopGit = git(document.getElementById('git')!, g => { vcs = g })
  try {
    expect(values.game().top).toBe(values.git().top + values.git().height + 12)
    expect(values.game().left).toBe(values.git().left)
    expect(values.game().height + values.git().height + 12).toBe(776)
    expect(document.querySelectorAll('[data-nidofy-ai-village-space],[data-nidofy-vcs-space]')).toHaveLength(1)
    document.getElementById('game')!.removeAttribute('data-nidofy-village-open'); await Promise.resolve()
    expect(values.git().height).toBe(776)
    document.getElementById('game')!.setAttribute('data-nidofy-village-open', ''); await Promise.resolve()
    document.getElementById('git')!.remove(); await Promise.resolve()
    expect(values.game().top).toBe(82); expect(values.game().height).toBe(776)
    frame.removeAttribute('data-rightbar-collapsed'); await Promise.resolve()
    expect(game).toBeNull(); expect(vcs).toBeNull()
  } finally { stopGame(); stopGit(); document.body.replaceChildren(); vi.unstubAllGlobals() }
})
