import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { attachFloatingLayout, type FloatingGeometry } from './floating-layout.ts'
import { Portrait } from './Portrait.tsx'
import { cameraForFrame, cameraValue, type CharacterPresentation, type FramePreset } from './presentation.ts'
import { en, zh } from './messages.ts'
import { css } from './style.ts'
import type { DisplayStatus } from '../protocol.ts'

const preferenceKey = 'nidofy.live2d.presentation.v1'
export function initialPresentation(): CharacterPresentation {
  const defaults = { camera: .5, panX: 0, panY: 0, animation: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) ?? 'null') as Partial<CharacterPresentation> | null
    if (!value || typeof value !== 'object') return defaults
    const bound = (n: unknown, lo: number, hi: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback
    return { camera: bound(value.camera, 0, 1, .5), panX: bound(value.panX, -.15, .15, 0), panY: bound(value.panY, -.15, .15, 0),
      animation: typeof value.animation === 'boolean' ? value.animation : defaults.animation }
  } catch { return defaults }
}

export function Floating({ locale, status, onClose, active = true }: { locale: string; status: DisplayStatus | 'unknown'; onClose(): void; active?: boolean }) {
  const t = locale === 'zh' ? zh : en
  const anchor = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null)
  const [presentation, setPresentation] = useState(initialPresentation)
  const [settings, setSettings] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [visible, setVisible] = useState(!document.hidden)
  useLayoutEffect(() => {
    if (!active) { setGeometry(null); return }
    return anchor.current ? attachFloatingLayout(anchor.current, setGeometry) : undefined
  }, [active])
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => { try { localStorage.setItem(preferenceKey, JSON.stringify(presentation)) } catch { /* Memory-only settings remain usable. */ } }, [presentation])
  const change = (value: Partial<CharacterPresentation>) => setPresentation(current => ({ ...current, ...value }))
  const retryAnimation = () => { setFailed(false); setRetry(value => value + 1) }
  return <div ref={anchor} data-nidofy-live2d-overlay="" className="dsh-live2d">
    <style>{css}</style>
    {active && geometry && visible && <aside className="live2d-card" aria-label={t.title}
      style={{ left: geometry.left, top: geometry.top, height: Math.min(680, geometry.height) }}
      onKeyDown={event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose() } }}>
      <header className="live2d-header"><strong>{t.title}</strong>
        <button aria-label={t.settings} aria-expanded={settings} onClick={() => setSettings(value => !value)}>{t.settings}</button>
        <button aria-label={t.close} onClick={onClose}>×</button>
      </header>
      <div className="live2d-status" role="status">{t[status]}</div>
      <Portrait presentation={presentation} status={status === 'unknown' ? 'idle' : status} locale={locale}
        failed={failed} retry={retry} onFailure={() => setFailed(true)} />
      {settings && <div className="live2d-controls">
        <div>{(['full', 'half', 'portrait'] as FramePreset[]).map(frame => <button key={frame}
          aria-pressed={cameraValue(presentation) === cameraForFrame(frame)} onClick={() => change({ camera: cameraForFrame(frame) })}>{t[frame]}</button>)}</div>
        <label>{t.camera}<input type="range" min="0" max="1" step="0.01" value={cameraValue(presentation)} onChange={event => change({ camera: Number(event.target.value) })} /></label>
        <label>{t.panX}<input type="range" min="-0.15" max="0.15" step="0.01" value={presentation.panX} onChange={event => change({ panX: Number(event.target.value) })} /></label>
        <label>{t.panY}<input type="range" min="-0.15" max="0.15" step="0.01" value={presentation.panY} onChange={event => change({ panY: Number(event.target.value) })} /></label>
        <label><input type="checkbox" checked={presentation.animation} onChange={event => { change({ animation: event.target.checked }); if (event.target.checked) retryAnimation() }} />{t.animation}</label>
        <button onClick={() => change({ camera: .5, panX: 0, panY: 0 })}>{t.reset}</button>
      </div>}
      {failed && presentation.animation ? <div className="live2d-footer" role="status">{t.failed} <button onClick={retryAnimation}>{t.retry}</button></div>
        : !presentation.animation ? <div className="live2d-footer">{t.static}</div> : null}
    </aside>}
  </div>
}
