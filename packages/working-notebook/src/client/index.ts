import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { createElement } from 'react'
import { apply as enhanced } from './registration.tsx'
import { StandardPanel, standardLocales, standardRequest } from './StandardPanel.tsx'
export const name = 'nidofy-working-notebook-client'
export const inject = ['slots', 'locale', 'uiWorkspace', 'uiSession', 'conversation', 'connection']
interface StandardInjected { hooks: { generation: ConnectionHandle['generation'] } }
function StandardSettings({ useGeneration, t }: InjectFace<StandardInjected> & PropsLocale<'nidofy.notebook-standard'>) {
  const generation = useGeneration(value => value)
  return generation ? createElement(StandardPanel, { key: generation.id, t }) : null
}
/** Select the UI from the active Host mode, never by guessing which desktop APIs exist. */
export async function apply(ctx: Context): Promise<void> {
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  const settings = await standardRequest<{ mode?: string }>('settings', {}, lifetime.signal)
  if (settings.mode === 'enhanced') { enhanced(ctx); return }
  ctx.effect(() => ctx.locale.register('nidofy.notebook-standard', standardLocales))
  const t = ctx.locale.bind('nidofy.notebook-standard')
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'nidofy-notebook', order: 45,
    locale: 'nidofy.notebook-standard', label: () => t('title'), inject: (): StandardInjected => ({ hooks: { generation: connection.generation } }) }, StandardSettings))
}
