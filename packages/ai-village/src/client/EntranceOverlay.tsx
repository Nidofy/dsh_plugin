import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { characterIds, characterNames } from '../core/roster.ts'
import { portraitFill } from './entrance-state.ts'
import { EntranceMotion } from './entrance-motion.ts'
import { entranceLayout, entranceArt, entranceArtStatus } from './entrance-theme.ts'

function Portrait({ id, fill }: { id: typeof characterIds[number]; fill: number }) {
  const [failed, setFailed] = useState(false)
  return <span className="entrance-portrait" title={characterNames[id]}>
    {failed ? <span aria-hidden="true">○</span> : <>
      <img src={`/api/nidofy-ai-village/assets/portraits/${id}.png`} alt="" onError={() => setFailed(true)} />
      <img src={`/api/nidofy-ai-village/assets/portraits/${id}.png`} alt="" style={{ clipPath: `inset(${(1 - fill) * 100}% 0 0)` }} onError={() => setFailed(true)} />
    </>}
  </span>
}
export function EntranceOverlay({ runtime: r, cn, close }: { runtime: VillageRuntime; cn: boolean; close(): void }) {
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null)
  const [artReady, setArtReady] = useState(false), [artFailed, setArtFailed] = useState(false), [systemReduced, setSystemReduced] = useState(false)
  const [hint, setHint] = useState(0)
  const e = r.entrance, canReveal = r.canRevealEntrance, progress = e.progress(canReveal)
  const reduced = systemReduced || r.preferences.reducedMotion
  const simple = reduced || r.softwareRendering || !entranceArt || artFailed || e.skipped || !e.full
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setSystemReduced(media.matches)
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let cancelled = false
    if (entranceArt && stage.current) void Promise.all([...stage.current.querySelectorAll('img')].map(img => img.decode())).then(() => { if (!cancelled) setArtReady(true) }, () => { if (!cancelled) setArtFailed(true) })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    setHint(0)
    const slow = setTimeout(() => setHint(1), 5000), details = setTimeout(() => setHint(2), 15000)
    return () => { clearTimeout(slow); clearTimeout(details) }
  }, [progress])
  useEffect(() => {
    const node = stage.current, art = entranceArt
    if (!node || !art) return
    const resize = () => {
      const { width, height } = root.current!.getBoundingClientRect(), layout = entranceLayout(width,height,art)
      Object.assign(node.style,{width:`${layout.width}px`,height:`${layout.height}px`,left:`${layout.left}px`,top:`${layout.top}px`})
      node.style.setProperty('--cross-transform',layout.cross);node.style.setProperty('--far-transform',layout.far)
    }
    // Observe the untransformed viewport. Resize changes the endpoint without restarting the phase.
    const observer = new ResizeObserver(resize)
    resize(); observer.observe(root.current!); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const motion = new EntranceMotion(), node = root.current!, camera = stage.current
    let cancelled = false
    const phase = (value: typeof e.phase) => { e.phase = value; node.dataset.phase = value }
    const run = async () => {
      if (!simple && artReady && camera) {
        phase('approach')
        const fast = canReveal && (performance.now() - e.openedAt <= 200 || !artReady)
        const approach = canReveal ? 180 : 1100
        const layers = [...camera.querySelectorAll<HTMLElement>('[data-parallax]')]
        void Promise.all(layers.map(layer=>motion.animate(layer,[{transform:`translateY(${12*Number(layer.dataset.parallax)}px)`},{transform:'translateY(0)'}],approach)))
        if (!await motion.animate(camera, [{ transform: getComputedStyle(camera).transform }, { transform: 'translate(0,0) scale(1)' }], approach)) return
        camera.style.transform = 'translate(0,0) scale(1)'
        phase('wait')
        if (!canReveal || !r.canRevealEntrance) return
        phase('open')
        const doors = [...node.querySelectorAll<HTMLElement>('[data-door]')]
        if (!(await Promise.all(doors.map(door => motion.animate(door, [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${door.dataset.door === 'left' ? -82 : 82}deg)` }], fast ? 350 : 650)))).every(Boolean)) return
        doors.forEach(door => { door.style.transform = `rotateY(${door.dataset.door === 'left' ? -82 : 82}deg)` })
        if (!r.canRevealEntrance) return
        phase('cross')
        if (!await motion.animate(camera, [{ transform: 'translate(0,0) scale(1)' }, { transform: 'var(--cross-transform)' }], fast ? 300 : 550)) return
        camera.style.transform = 'var(--cross-transform)'
      } else if (!canReveal) { phase('wait'); return }
      if (!r.canRevealEntrance || cancelled) return
      phase('reveal')
      if (!await motion.animate(node, [{ opacity: 1 }, { opacity: 0 }], reduced ? 100 : simple ? 150 : 220)) return
      if (!cancelled) r.finishEntrance()
    }
    void run()
    return () => { cancelled = true; motion.cancel() }
  }, [r, canReveal, simple, artReady, reduced, e.attemptId, e.skipped])
  const phaseText = hint ? (cn ? '仍在准备小院…' : 'Still preparing the courtyard…') : !e.metadata ? (cn ? '正在准备小院…' : 'Preparing the courtyard…') : e.verified < 1 ? (cn ? '正在准备场景素材…' : 'Preparing scene resources…') : e.decoded < 1 ? (cn ? '正在布置场景…' : 'Preparing the scene…') : (cn ? '正在确认小院画面…' : 'Checking the courtyard frame…')
  const art = entranceArt, aperture = art?.aperture
  const knockout = aperture ? `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${aperture.x*100}% ${aperture.y*100}%,${aperture.x*100}% ${(aperture.y+aperture.height)*100}%,${(aperture.x+aperture.width)*100}% ${(aperture.y+aperture.height)*100}%,${(aperture.x+aperture.width)*100}% ${aperture.y*100}%,${aperture.x*100}% ${aperture.y*100}%)` : undefined
  return <div ref={root} className="village-entrance" data-phase={e.phase} data-art={entranceArtStatus} data-simple={simple || !artReady} aria-label={cn ? '进入小院' : 'Entering the courtyard'} onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); r.skipEntrance() }
  }}>
    {art && !artFailed && <div ref={stage} className="entrance-camera" style={{ visibility: artReady && !simple ? 'visible' : 'hidden' }}>
      <div className="entrance-exterior" style={{ clipPath: knockout }}>{art.layers.filter(layer => !['left','right'].includes(layer.kind)).map(layer => <img key={layer.key} data-parallax={{far:.12,mid:.35,near:1.15,frame:1,left:1,right:1}[layer.kind]} src={`/api/nidofy-ai-village/assets/${layer.key}`} alt="" style={{ left: `${layer.rect.x*100}%`, top: `${layer.rect.y*100}%`, width: `${layer.rect.width*100}%`, height: `${layer.rect.height*100}%` }} />)}</div>
      <div className="entrance-perspective">{art.layers.filter(layer => ['left','right'].includes(layer.kind)).map(layer => <img key={layer.key} data-door={layer.kind} src={`/api/nidofy-ai-village/assets/${layer.key}`} alt="" style={{ left: `${layer.rect.x*100}%`, top: `${layer.rect.y*100}%`, width: `${layer.rect.width*100}%`, height: `${layer.rect.height*100}%`, transformOrigin: `${(layer.pivot?.[0] ?? (layer.kind === 'left' ? 0 : 1))*100}% ${(layer.pivot?.[1] ?? .5)*100}%` }} />)}</div>
    </div>}
    <div className="entrance-actions"><button onClick={() => r.skipEntrance()}>{cn ? '跳过动画' : 'Skip animation'}</button><button onClick={close} aria-label={cn ? '关闭小院' : 'Close courtyard'}>×</button></div>
    <div className="entrance-status" role="progressbar" aria-label={cn ? '小院整体准备进度' : 'Overall courtyard preparation'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress*100)} aria-valuetext={phaseText}>
      <div className="entrance-portraits">{characterIds.map((id, index) => <Portrait key={id} id={id} fill={portraitFill(progress, index)} />)}</div>
      <p role="status">{phaseText}</p>
      {hint === 2 && <small>{cn ? '正在等待资源校验或画面确认，可以关闭后再回来。' : 'Waiting for verified resources or a rendered frame. You can close and return later.'}</small>}
    </div>
  </div>
}
export const entranceCSS = `
.village-entrance{position:absolute;inset:0;z-index:25;overflow:hidden;color:#514b3e;isolation:isolate;pointer-events:auto}
.village-entrance[data-simple=true]{background:radial-gradient(ellipse at 50% 40%,#f4ecdc,#ded9c6)}
[data-theme=dark] .village-entrance[data-simple=true]{background:radial-gradient(ellipse at 50% 40%,#3e4137,#292e29);color:#eee6d5}
.entrance-camera,.entrance-exterior,.entrance-perspective{position:absolute;inset:0}
.entrance-camera{transform-origin:0 0;transform:var(--far-transform)}
.entrance-exterior img,.entrance-perspective img{position:absolute;object-fit:fill}
.entrance-exterior{background:#d6d6bc}
.entrance-perspective{perspective:1000px;transform-style:preserve-3d}
.entrance-perspective img{backface-visibility:hidden}
.entrance-actions{position:absolute;top:8px;right:8px;display:flex;gap:8px;z-index:2}
.entrance-actions button{min-width:40px!important;min-height:40px!important;color:inherit}
.entrance-status{position:absolute;left:8px;right:8px;bottom:12%;text-align:center;padding:14px 0;background:radial-gradient(ellipse,#f2ebdb99,transparent 72%)}
[data-theme=dark] .entrance-status{background:radial-gradient(ellipse,#292e2988,transparent 72%)}
.entrance-status p{font-size:14px;margin:12px 0 0}.entrance-status small{font-size:12px}
.entrance-portraits{display:flex;justify-content:center;gap:8px}
.entrance-portrait{display:block;position:relative;width:32px;height:40px;flex:none}
.entrance-portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.entrance-portrait img:first-child{filter:grayscale(1);opacity:.65}
.entrance-portrait img+img{filter:none}
.village-card[data-entrance-wide=true] .entrance-portraits{gap:10px}.village-card[data-entrance-wide=true] .entrance-portrait{width:36px;height:44px}
.village-card[data-short=true] .entrance-portrait{width:28px;height:34px}
.village-entry-ui{position:absolute;inset:0;z-index:30;pointer-events:none}
.village-entry-ui[aria-hidden=true]{visibility:hidden;pointer-events:none}
.village-entry-ui[data-entered=true]{animation:entrance-hud-in 220ms ease-out}
.village-card[data-motion=true] .village-entry-ui[data-entered=true]{animation-duration:100ms}
@keyframes entrance-hud-in{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.village-entry-ui[data-entered=true]{animation-duration:100ms}}
`
