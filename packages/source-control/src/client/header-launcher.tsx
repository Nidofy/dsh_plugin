/** DSH 0.2.1 header adapter, kept identical in the three independently installable plugins. */
import { useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Keep one launcher beside the official sidebar control, including blank sessions. */
export function HeaderLauncher({ id, order, children }: { id: string; order: number; children: ReactNode }) {
  const [host] = useState(() => document.createElement('span'))
  useLayoutEffect(() => {
    host.dataset.nidofyHeaderLauncher = id
    Object.assign(host.style, { display: 'inline-flex', alignItems: 'center', marginRight: '8px', order: String(order) })
    host.style.setProperty('-webkit-app-region', 'no-drag')
    const attach = () => {
      // Public slot is single-owner (sidebar); only add our own DOM child, never replace its owner.
      const corner = document.querySelector('[data-conversation-header-corner]')
      if (corner && host.parentElement !== corner) {
        const before = [...corner.children].find(node => !(node instanceof HTMLElement) || !node.dataset.nidofyHeaderLauncher || Number(node.style.order) > order)
        corner.insertBefore(host, before ?? null)
      }
      else if (!corner && host.parentElement) host.remove()
    }
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    attach()
    return () => { observer.disconnect(); host.remove() }
  }, [host, id, order])
  return createPortal(children, host)
}
