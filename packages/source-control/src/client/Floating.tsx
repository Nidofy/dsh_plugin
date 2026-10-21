import { useLayoutEffect, useRef, useState } from 'react'
import { RepositoryPanel } from './Panel.tsx'
import { attachFloatingLayout, type FloatingGeometry } from './floating-layout.ts'

export function FloatingPanel({ projectRoot, locale, onClose }: { projectRoot: string | null; locale: string; onClose: () => void }) {
  const anchor = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null)
  useLayoutEffect(() => anchor.current ? attachFloatingLayout(anchor.current, setGeometry) : undefined, [])
  return <div ref={anchor} data-nidofy-vcs-overlay="">
    <style>{`[data-nidofy-vcs-space]{margin-right:364px!important}
      .vcs-floating{position:absolute;width:340px;pointer-events:auto;overflow:auto;scrollbar-width:thin;border-radius:16px}
      .vcs-floating .vcs-content{max-height:none}
      [data-shell-overlay] .vcs-floating .vcs-panel{box-shadow:0 8px 28px #0002}`}</style>
    {geometry && <aside className="vcs-floating" data-stacked={geometry.stacked || undefined} aria-label={locale === 'zh' ? '版本控制浮窗' : 'Version control card'}
      style={{ left: geometry.left, top: geometry.top, maxHeight: geometry.height }}
      onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose() } }}>
      <RepositoryPanel projectRoot={projectRoot} locale={locale} onClose={onClose} />
    </aside>}
  </div>
}
