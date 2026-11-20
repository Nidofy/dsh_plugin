import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import { Workbench } from './workbench.tsx'
import { createApi } from './client-api.ts'

const ns = 'ai-infra-lab'
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ai-infra-lab': 'title'
  }
}

export const inject = ['slots', 'locale', 'layout']

export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.locale.register(ns, {
      zh: { title: 'AI Infra Lab · 算力与系统实验室' },
      en: { title: 'AI Infra Lab' },
    }),
  )
  const api = createApi()
  const panel = 'ai-infra-lab' as MainPanelId
  ctx.slots.inject('main', () =>
    ctx.slots.register(
      { name: 'main', key: panel, locale: ns, inject: () => ({ api }) },
      Workbench,
    ),
  )
  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      {
        name: 'sidebar.panellist',
        id: panel,
        order: 17,
        locale: ns,
        label: () => ctx.locale.bind(ns)('title'),
      },
      () => createElement('span', { 'aria-hidden': true }, '⚡'),
    ),
  )
}
