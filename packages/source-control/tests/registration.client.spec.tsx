// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import * as Plugin from '../src/client/index.ts'
class Transport extends Service { constructor(ctx: Context) { super(ctx, 'connection') } }
it('owns only an additive overlay; toggles without a sidebar service and cleans up repeated loads', async () => {
 const ctx = new Context()
 try {
  await ctx.plugin(Transport); await ctx.plugin(SlotRegistry)
  ctx.provide('uiSession', { adapter: { current: { subscribe: () => () => {}, getSnapshot: () => ({ key: undefined }) } } } as never)
  const dictionaries = new Map<string, Record<string, Record<string, string>>>()
  ctx.provide('locale', {
   register(ns: string, dict: Record<string, Record<string, string>>) { dictionaries.set(ns, dict); return () => { dictionaries.delete(ns) } },
   bind(ns: string) { return (key: string) => dictionaries.get(ns)?.en?.[key] ?? key },
  } as never)
  ctx.slots.register({ name: 'root', children: {
   'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
   'settings.section': { kind: 'list', scope: 'root' },
   'shell.overlay': { kind: 'list', scope: 'root' },
   'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
  } }, () => null)
  for (let i = 0; i < 2; i++) {
   const fiber = await ctx.plugin(Plugin)
   for (const key of ['conversation.session.header.utilities','settings.section','shell.overlay'] as const) expect(ctx.slots.entries(key)).toHaveLength(1)
   expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(0)
   const Launcher = ctx.slots.entries('conversation.session.header.utilities')[0]!.component as ComponentType<{t: (key: string) => string}>
   render(createElement(Launcher, { t: key => dictionaries.get('nidofy.source-control')!.en![key]! }))
   const button = screen.getByRole('button', { name: 'Open Git / Hg tools' })
   fireEvent.click(button); expect(button.getAttribute('aria-pressed')).toBe('true')
   fireEvent.click(button); expect(button.getAttribute('aria-pressed')).toBe('false')
   expect(screen.queryByRole('dialog')).toBeNull()
   cleanup(); await fiber.dispose()
   for (const key of ['conversation.session.header.utilities','settings.section','shell.overlay'] as const) expect(ctx.slots.entries(key)).toHaveLength(0)
   expect(dictionaries.size).toBe(0)
  }
 } finally { cleanup(); await ctx.fiber.dispose() }
})
