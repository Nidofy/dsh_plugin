// @vitest-environment jsdom
/** Actual pinned rc.3 header + Menu, with controlled session/slot inputs.
 * This is component/lifecycle coverage, not browser geometry or Desktop acceptance.
 * rc.2 keeps its existing registration lane and explicitly skips this rc.3-only fixture.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { HeaderLauncher } from '../src/client/header-launcher.tsx'

// Restrict the barrel to the real primitives this header uses. The full source
// barrel also imports unrelated Markdown/highlighter tooling absent from the
// runtime distribution. These exports retain their actual official behavior.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const base = join(process.env.DSH_SANDBOX_OFFICIAL!, 'packages/client/ui-primitives/src')
  const [button, menu, tooltip, icons] = await Promise.all([
    import(pathToFileURL(join(base, 'Button.tsx')).href),
    import(pathToFileURL(join(base, 'Menu.tsx')).href),
    import(pathToFileURL(join(base, 'Tooltip.tsx')).href),
    import(pathToFileURL(join(base, 'icons/index.tsx')).href),
  ])
  return { Button: button.Button, Menu: menu.Menu, Tooltip: tooltip.Tooltip, IconEllipsisOutlineRegular: icons.IconEllipsisOutlineRegular }
})

const official = process.env.DSH_SANDBOX_OFFICIAL
const version = official ? JSON.parse(readFileSync(join(official, 'package.json'), 'utf8')).version : undefined
let Header: ComponentType<Record<string, unknown>>

describe.skipIf(version !== '0.2.1-rc.3')('pinned rc.3 ConversationSessionHeader and Village portal', () => {
  beforeAll(async () => {
    // Load the lane-selected official source, never a copied/reimplemented Header.
    const module = await import(pathToFileURL(join(official!, 'packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx')).href)
    Header = module.ConversationSessionHeader
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  function header(sessionId: string, blank = false) {
    return createElement(Header, {
      sessionId, hideChrome: blank,
      useConversationViews: (select: (tabs: unknown[]) => unknown) => select([
        { id: 'chat', label: 'Chat' }, { id: 'trajectory', label: 'History' },
      ]),
      useStore: (select: (state: { view: string }) => unknown) => select({ view: 'chat' }),
      useSessions: (select: (state: unknown) => unknown) => select({ byId: {
        [sessionId]: { id: sessionId, displayTitle: sessionId },
      } }),
      useEntryPins: (select: (pins: string[]) => unknown) => select([]),
      useEntryActions: (select: (registered: boolean) => unknown) => select(true),
      open: vi.fn(), selectView: vi.fn(), setPinned: vi.fn(),
      t: (key: string) => key === 'session.moreViews' ? 'More views' : key,
      renderSlot: (key: string, owner: { onDismiss?: () => void }) => {
        if (key === 'conversation.session.header.corner') return createElement('button', { 'aria-label': 'Sidebar' }, 'Sidebar')
        if (key === 'conversation.session.header.views.actions') return createElement('button', {
          role: 'menuitem', onClick: owner.onDismiss,
        }, 'View menu entry')
        return null
      },
    })
  }
  const launcher = () => createElement(HeaderLauncher, {
    id: 'ai-village', order: -10,
    children: createElement('button', { 'data-nidofy-village-launcher': '', 'aria-label': 'Open AI Village' }, 'Village'),
  })

  it('keeps More outside the corner and restores its focus without moving or duplicating Village', async () => {
    render(header('existing-session'))
    render(launcher())
    const village = await screen.findByRole('button', { name: 'Open AI Village' })
    const corner = village.closest('[data-conversation-header-corner]')!
    const more = screen.getByRole('button', { name: 'More views' })
    expect(corner).not.toBeNull()
    expect(corner.contains(more)).toBe(false)
    expect(corner.querySelectorAll('[data-nidofy-header-launcher="ai-village"]')).toHaveLength(1)
    expect(corner.lastElementChild).toBe(screen.getByRole('button', { name: 'Sidebar' }))
    more.focus()
    fireEvent.click(more)
    const menu = await screen.findByRole('menuitem', { name: 'View menu entry' })
    await waitFor(() => expect(document.activeElement).toBe(menu))
    expect(document.querySelectorAll('[data-nidofy-village-launcher]')).toHaveLength(1)
    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull())
    expect(document.activeElement).toBe(more)
    expect(village.closest('[data-conversation-header-corner]')).toBe(corner)
  })

  it('moves the same launcher across real blank/existing header remounts and fully releases each enable cycle', async () => {
    let surface = render(header('blank-session', true))
    for (let cycle = 0; cycle < 3; cycle++) {
      const portal = render(launcher())
      const village = await screen.findByRole('button', { name: 'Open AI Village' })
      const initialCorner = village.closest('[data-conversation-header-corner]')!
      expect(initialCorner).not.toBeNull()
      surface.unmount()
      await waitFor(() => expect(document.querySelector('[data-nidofy-village-launcher]')).toBeNull())
      surface = render(header('existing-' + cycle))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Open AI Village' })).toBe(village))
      expect(village.closest('[data-conversation-header-corner]')).not.toBe(initialCorner)
      expect(screen.getAllByRole('button', { name: 'Open AI Village' })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'More views' })).toBeTruthy()
      portal.unmount()
      await waitFor(() => expect(document.querySelector('[data-nidofy-header-launcher]')).toBeNull())
      surface.unmount()
      surface = render(header('blank-' + cycle, true))
      expect(document.querySelector('[data-nidofy-header-launcher]')).toBeNull()
      expect(screen.queryByRole('button', { name: 'More views' })).toBeNull()
      expect(screen.getByRole('button', { name: 'Sidebar' })).toBeTruthy()
    }
  })
})
