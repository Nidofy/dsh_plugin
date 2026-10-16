/** Independent settings registration; native windows are owned by the Electron adapter. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { createElement, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

const en = { title: 'Desktop pets', open: 'Manage desktop pets', close: 'Close', preview: 'Pet preview', description: 'Preview your pet and manage appearance, interactions and resources. Floating windows require an Electron carrier.' }
const zh = { title: '桌宠', open: '管理桌宠', close: '关闭', preview: '桌宠预览', description: '预览桌宠并管理外观、互动与资源。桌面悬浮窗口需接入 Electron 适配器。' }
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'nidofy.desktop-pets': keyof typeof en }
}
function Settings({ t }: PropsLocale<'nidofy.desktop-pets'>) {
  const [open, setOpen] = useState(false)
  const locale = t('title') === zh.title ? 'zh-CN' : 'en'
  return createElement('section', null,
    createElement('p', null, t('description')),
    createElement(Button, { onClick: () => setOpen(true) }, t('open')),
    createElement(Modal, { open, onClose: () => setOpen(false), title: t('title'), closeLabel: t('close'),
      children: open ? createElement('div', null,
        createElement('iframe', { title: t('preview'), src: '/api/nidofy-pets/assets/pet/index.html?id=1',
          style: { width: '100%', height: 240, border: 0 } }),
        createElement('iframe', { title: t('title'), src: '/api/nidofy-pets/ui?locale=' + locale,
          style: { width: '100%', height: '50vh', border: 0 } })) : null }))
}
export const name = 'nidofy-desktop-pets-client'
export const inject = ['slots', 'locale']
/** Mount settings with the same lifetime as the plugin. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('nidofy.desktop-pets', { en, zh }))
  const t = ctx.locale.bind('nidofy.desktop-pets')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'nidofy-desktop-pets',
    order: 46, locale: 'nidofy.desktop-pets', label: () => t('title') }, Settings))
}
