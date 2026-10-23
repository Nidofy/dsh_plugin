import { useEffect } from 'react'
import type { VillageRuntime } from './runtime.ts'

/** Uses the owner's verified first-frame gate. No independent animation clock or bypass. */
export function RegionTransitionOverlay({ runtime: r, cn, close }: { runtime: VillageRuntime; cn: boolean; close(): void }) {
  useEffect(() => {
    const reveal = () => { if (r.canRevealEntrance) r.finishEntrance() }
    const unsubscribe = r.subscribe(reveal)
    reveal()
    return unsubscribe
  }, [r])
  const bookhouse = r.controller?.world.region.active === 'bookhouse'
  const title = bookhouse ? (cn ? '正在准备 AI 书屋…' : 'Preparing AI Bookhouse…') : (cn ? '正在准备返回小院…' : 'Preparing the courtyard…')
  return <div className="village-region-transition" role="status" aria-live="polite" aria-label={cn ? '准备当前区域' : 'Preparing the current region'} style={{ position: 'absolute', inset: 0, zIndex: 25, display: 'grid', placeItems: 'center', padding: 20, background: 'var(--solid, #f4ecdc)', color: 'var(--ink, #514b3e)', pointerEvents: 'auto' }}>
    <div style={{ maxWidth: 320, textAlign: 'center' }}><h2>{title}</h2><p>{bookhouse ? (cn ? 'AI 书屋 · 开发样板' : 'AI Bookhouse · Development preview') : (cn ? '朋友们会一起回到小院。' : 'Everyone is returning to the courtyard together.')}</p><p>{cn ? '正在准备场景并确认第一幅画面。' : 'Preparing the scene and checking its first frame.'}</p><button onClick={close}>{cn ? '关闭小院' : 'Close village'}</button></div>
  </div>
}
