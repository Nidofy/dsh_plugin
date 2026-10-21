// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import * as Plugin from '../src/client/index.ts'
import * as Git from '../../source-control/src/client/index.ts'

it('registers only the overlay and launcher, coexists with Git, and revokes all registrations on repeated disable', async () => {
  const ctx = new Context()
  const corner = document.createElement('div'); corner.dataset.conversationHeaderCorner = ''; document.body.append(corner)
  try {
    await ctx.plugin(SlotRegistry)
    ctx.provide('connection', { state: { subscribe: () => () => {}, getSnapshot: () => 'connected' } })
    ctx.provide('uiSession', { adapter: { current: { subscribe: () => () => {}, getSnapshot: () => ({ key: undefined }) } } } as never)
    const dictionaries = new Map<string, Record<string, Record<string, string>>>()
    ctx.provide('locale', {
      register(ns: string, dict: Record<string, Record<string, string>>) { dictionaries.set(ns, dict); return () => { dictionaries.delete(ns) } },
      bind(ns: string) { return (key: string) => dictionaries.get(ns)?.en?.[key] ?? key },
    } as never)
    ctx.slots.register({ name: 'root', children: {
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      'shell.overlay': { kind: 'list', scope: 'root' },
      'settings.section': { kind: 'list', scope: 'root' },
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
    } }, () => null)
    for (let i = 0; i < 2; i++) {
      const git = await ctx.plugin(Git), plugin = await ctx.plugin(Plugin)
      expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(0)
      expect(ctx.slots.entries('shell.overlay')).toHaveLength(4)
      for (const [index, entry] of ctx.slots.entries('shell.overlay').filter(entry => entry.options.id?.endsWith('-launcher')).entries()) {
        const ns = index === 1 ? 'nidofy.live2d' : 'nidofy.source-control'
        render(createElement(entry.component as ComponentType<{ t(key: string): string }>, { t: key => dictionaries.get(ns)!.en![key]! }))
      }
      const liveButton = screen.getByRole('button', { name: 'Open Live2D companion' }), gitButton = screen.getByRole('button', { name: 'Open Git / Hg tools' })
      fireEvent.click(liveButton); expect(liveButton.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(gitButton); expect(liveButton.getAttribute('aria-pressed')).toBe('true')
      expect(gitButton.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(liveButton); expect(gitButton.getAttribute('aria-pressed')).toBe('true')
      expect(liveButton.getAttribute('aria-pressed')).toBe('false')
      fireEvent.click(liveButton); expect(liveButton.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(liveButton); expect(liveButton.getAttribute('aria-pressed')).toBe('false')
      cleanup(); await plugin.dispose(); await git.dispose()
      expect(ctx.slots.entries('shell.overlay')).toHaveLength(0)
      expect(ctx.slots.entries('conversation.session.header.utilities')).toHaveLength(0)
      expect(dictionaries.size).toBe(0)
    }
  } finally { cleanup(); corner.remove(); await ctx.fiber.dispose() }
})
