import { useEffect, useRef, useState } from 'react'
import { attachFrame } from './bridge.ts'
import { cameraValue, rasterSize, staticPortraitGeometry, type CharacterPresentation } from './presentation.ts'
import type { DisplayStatus } from '../protocol.ts'
import { en, zh } from './messages.ts'

export function Portrait({ presentation, status, locale, failed, retry, onFailure }: {
  presentation: CharacterPresentation; status: DisplayStatus; locale: string; failed: boolean; retry: number; onFailure(): void
}) {
  const t = locale === 'zh' ? zh : en
  const stage = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null)
  const bridge = useRef<ReturnType<typeof attachFrame> | null>(null)
  const [size, setSize] = useState({ width: 340, height: 400 })
  const [rendered, setRendered] = useState(false), [imageFailed, setImageFailed] = useState(false)
  const failure = useRef(onFailure); failure.current = onFailure
  const animated = presentation.animation && !failed
  useEffect(() => {
    const element = stage.current!
    const update = () => { const { width, height } = element.getBoundingClientRect(); setSize({ width, height }) }
    const observer = new ResizeObserver(update); observer.observe(element); update()
    window.addEventListener('resize', update)
    return () => { observer.disconnect(); window.removeEventListener('resize', update) }
  }, [])
  useEffect(() => {
    setRendered(false)
    if (!animated || !iframe.current) return
    const connection = attachFrame(iframe.current, () => setRendered(true), () => { setRendered(false); failure.current() })
    bridge.current = connection
    return () => { connection.dispose(); bridge.current = null }
  }, [animated, retry])
  useEffect(() => {
    bridge.current?.update({ ...rasterSize(size.width, size.height, window.devicePixelRatio || 1),
      camera: cameraValue(presentation), panX: presentation.panX, panY: presentation.panY }, status)
  }, [presentation, size, status, animated, retry])
  const geometry = staticPortraitGeometry(size.width, size.height, presentation)
  return <div className="live2d-stage" ref={stage} data-capability={rendered ? 'animated' : imageFailed ? 'none' : 'static'}>
    {!imageFailed && <img src="/api/nidofy-live2d/assets/upperbody.png" alt={t.title} draggable={false} hidden={rendered}
      style={geometry} onError={() => setImageFailed(true)} />}
    {imageFailed && !rendered && <p role="status">{t.unavailable}</p>}
    {animated && <iframe key={retry} ref={iframe} src="/api/nidofy-live2d/frame" title={t.animated}
      sandbox="allow-scripts" referrerPolicy="no-referrer" tabIndex={-1} aria-hidden="true" style={{ opacity: rendered ? 1 : 0 }} />}
  </div>
}
