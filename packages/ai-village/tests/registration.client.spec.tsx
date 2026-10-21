// @vitest-environment jsdom
import { it, expect } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import * as Village from '../src/client/index.ts'
import * as Live2D from '../../live2d/src/client/index.ts'
import * as Git from '../../source-control/src/client/index.ts'
it('three real plugins arbitrate launchers and revoke every slot/listener across repeated unload', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(SlotRegistry)
    ctx.provide('connection', { state: { subscribe: () => () => {}, getSnapshot: () => 'disconnected' } })
    ctx.provide('uiSession', { adapter: { current: { subscribe: () => () => {}, getSnapshot: () => ({ key: undefined }) } } } as never)
    const dictionaries = new Map<string, Record<string, Record<string, string>>>()
    ctx.provide('locale', { register(ns: string, d: Record<string, Record<string, string>>) { dictionaries.set(ns, d); return () => dictionaries.delete(ns) },
      bind(ns: string) { return (key: string) => dictionaries.get(ns)?.en?.[key] ?? key } } as never)
    ctx.slots.register({ name: 'root', children: { 'shell.overlay': { kind: 'list', scope: 'root' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' }, 'conversation.hero.options': { kind: 'list', scope: 'session' }, 'settings.section': { kind: 'list', scope: 'root' },
      'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' } } }, () => null)
    for (let cycle = 0; cycle < 3; cycle++) {
      const plugins = [await ctx.plugin(Git), await ctx.plugin(Live2D), await ctx.plugin(Village)]
      expect(ctx.slots.entries('shell.overlay')).toHaveLength(3)
      expect(ctx.slots.entries('conversation.hero.options')).toHaveLength(3)
      expect(ctx.slots.entries('sidebar.right.pane.tab')).toHaveLength(0)
      for (const [i, entry] of ctx.slots.entries('conversation.session.header.utilities').entries()) {
        const ns = ['nidofy.source-control', 'nidofy.live2d', 'nidofy.ai-village'][i]!
        render(createElement(entry.component as ComponentType<{ t(key: string): string }>, { t: key => dictionaries.get(ns)!.en![key]! }))
      }
      const buttons = ['Open Git / Hg tools', 'Open Live2D companion', 'Open AI Village'].map(name => screen.getByRole('button', { name }))
      const wanted = [false, false, false]
      for (const next of [2, 0, 1, 2, 1, 0, 2]) {
        const opening = !wanted[next]
        if (opening) { if (next === 1) { wanted[0] = false; wanted[2] = false } else wanted[1] = false }
        wanted[next] = opening
        fireEvent.click(buttons[next]!)
        for (const [i, button] of buttons.entries()) expect(button.getAttribute('aria-pressed')).toBe(String(wanted[i]))
      }
      cleanup(); for (const plugin of plugins.reverse()) await plugin.dispose()
      expect(ctx.slots.entries('shell.overlay')).toHaveLength(0); expect(dictionaries.size).toBe(0)
      expect(ctx.slots.entries('conversation.hero.options')).toHaveLength(0)
    }
  } finally { cleanup(); await ctx.fiber.dispose() }
})
