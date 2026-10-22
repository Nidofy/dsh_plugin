import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { characterIds, characterNames } from '../core/roster.ts'
import { portraitFill } from './entrance-state.ts'
import { EntranceMotion } from './entrance-motion.ts'
import { entranceLayout, entranceKnockout, doorAngle, entranceTiming as timing } from './entrance-theme.ts'
import { entranceArt, entranceArtStatus } from './entrance-art.ts'

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
  const e = r.entrance, canReveal = r.canRevealEntrance
  const reduced = systemReduced || r.preferences.reducedMotion
  const simple = reduced || r.softwareRendering || !entranceArt || artFailed || e.skipped || !e.full
  useEffect(() => {
    if (!canReveal && ['open','cross','reveal'].includes(e.phase)) r.skipEntrance()
  }, [canReveal, r, e])
  const progress = e.progress(canReveal && (simple || artReady))
  const showArt = !!entranceArt && !simple
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setSystemReduced(media.matches)
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let cancelled = false
    setArtReady(false)
    if (showArt && stage.current) void Promise.all([...stage.current.querySelectorAll('img')].map(img => img.decode())).then(() => { if (!cancelled) setArtReady(true) }, () => { if (!cancelled) setArtFailed(true) })
    return () => { cancelled = true }
  }, [showArt, e.attemptId])
  useEffect(() => {
    setHint(0)
    const slow = setTimeout(() => setHint(1), 5000), details = setTimeout(() => setHint(2), 15000)
    return () => { clearTimeout(slow); clearTimeout(details) }
  }, [progress])
  useEffect(() => {
    const node = stage.current, art = entranceArt
    if (!node || !art) return
    const resize = () => {
      if (!root.current || !node.isConnected) return
      const { width, height } = root.current.getBoundingClientRect(), layout = entranceLayout(width,height,art)
      Object.assign(node.style,{width:`${layout.width}px`,height:`${layout.height}px`,left:`${layout.left}px`,top:`${layout.top}px`})
      node.style.setProperty('--cross-transform',layout.cross);node.style.setProperty('--far-transform',layout.far)
      node.style.setProperty('--near-transform',layout.near);node.style.setProperty('--entrance-perspective',`${layout.perspective}px`)
      node.style.setProperty('--parallax-driver',`${layout.parallax}px`);root.current!.style.setProperty('--stage-width',`${layout.width}px`)
    }
    // Observe the untransformed viewport. Resize changes the endpoint without restarting the phase.
    const observer = new ResizeObserver(resize)
    resize(); observer.observe(root.current!); return () => observer.disconnect()
  }, [showArt])
  useEffect(() => {
    const motion = new EntranceMotion(), node = root.current!, camera = stage.current
    let cancelled = false, resume: (() => void) | null = null
    const unsubscribe = r.subscribe(() => resume?.())
    const phase = (value: typeof e.phase) => { e.phase = value; node.dataset.phase = value }
    const ready = async () => {
      while (!cancelled && !r.canRevealEntrance) await new Promise<void>(resolve => { resume = resolve })
      resume = null
      return !cancelled && r.canRevealEntrance
    }
    const run = async () => {
      // Candidate image decoding must finish before the full visual sequence starts.
      if (!simple && !artReady) return
      if (!simple && camera) {
        const fast = r.canRevealEntrance && performance.now() - e.openedAt <= 200
        phase('approach')
        const duration = fast ? timing.fastApproach : timing.approach
        const layers = [...camera.querySelectorAll<HTMLElement>('[data-parallax]')]
        void Promise.all(layers.map(layer=>motion.animate(layer,[{transform:`translateY(calc(var(--parallax-driver) * ${Number(layer.dataset.parallax)}))`},{transform:'translateY(0)'}],duration)))
        if (!await motion.animate(camera, [{ transform: 'var(--far-transform)' }, { transform: 'var(--near-transform)' }], duration)) return
        camera.style.transform = 'var(--near-transform)'
        phase('wait')
        if (!await ready()) return
        phase('open')
        const doors = [...node.querySelectorAll<HTMLElement>('[data-door]')]
        if (!(await Promise.all(doors.map(door => motion.animate(door, [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${doorAngle(door.dataset.door as 'left'|'right',1)}deg)` }], fast ? timing.fastOpen : timing.open)))).every(Boolean)) return
        doors.forEach(door => { door.style.transform = `rotateY(${doorAngle(door.dataset.door as 'left'|'right',1)}deg)` })
        if (!await ready()) return
        phase('cross')
        const durationCross=fast ? timing.fastCross : timing.cross
        void motion.animate(node.querySelector('.entrance-atmosphere'),[{opacity:1},{opacity:0}],durationCross).then(ok=>{if(ok){const side=node.querySelector<HTMLElement>('.entrance-atmosphere');if(side)side.style.opacity='0'}})
        if (!await motion.animate(camera, [{ transform: 'var(--near-transform)' }, { transform: 'var(--cross-transform)' }], durationCross)) return
        camera.style.transform = 'var(--cross-transform)'
      } else phase('wait')
      if (!await ready()) return
      phase('reveal')
      if (!await motion.animate(node, [{ opacity: 1 }, { opacity: 0 }], reduced ? timing.reduced : simple ? timing.simple : timing.reveal)) return
      // Readiness can disappear during the fade. Restore the curtain and wait for a valid frame.
      if (!await ready()) return
      if (!cancelled) r.finishEntrance()
    }
    void run()
    return () => { cancelled = true; unsubscribe(); motion.cancel(); resume?.() }
  }, [r, simple, artReady, reduced, e.attemptId, e.skipped])
  const phaseText = canReveal ? (!simple && !artReady ? (cn ? '正在准备入口画面…' : 'Preparing the entrance…') : (cn ? '小院已就绪，欢迎回来。' : 'The courtyard is ready. Welcome back.')) : hint ? (cn ? '仍在准备小院…' : 'Still preparing the courtyard…') : !e.metadata ? (cn ? '正在准备小院…' : 'Preparing the courtyard…') : e.verified < 1 ? (cn ? '正在准备场景素材…' : 'Preparing scene resources…') : e.decoded < 1 ? (cn ? '正在布置场景…' : 'Preparing the scene…') : (cn ? '正在确认小院画面…' : 'Checking the courtyard frame…')
  const art = entranceArt, knockout = art ? entranceKnockout(art) : undefined
  return <div ref={root} className="village-entrance" data-phase={e.phase} data-art={entranceArtStatus} data-simple={simple || !artReady} aria-label={cn ? '进入小院' : 'Entering the courtyard'} onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); r.skipEntrance() }
  }}>
    {art && showArt && <>
      <div className="entrance-atmosphere" aria-hidden="true" style={{ visibility: artReady && !simple ? 'visible' : 'hidden' }}>
        {[0,1].map(side=><div key={side} data-side={side} style={{backgroundImage:`url(/api/nidofy-ai-village/assets/${art.layers.find(l=>l.kind==='far')!.key})`}} />)}
      </div>
      <div ref={stage} className="entrance-camera" style={{ visibility: artReady && !simple ? 'visible' : 'hidden' }}>
        {art.layers.map(layer => {
          const style={left:`${layer.rect.x*100}%`,top:`${layer.rect.y*100}%`,width:`${layer.rect.width*100}%`,height:`${layer.rect.height*100}%`}
          const src=`/api/nidofy-ai-village/assets/${layer.key}`
          return ['left','right'].includes(layer.kind)
            ? <img key={layer.key} data-door={layer.kind} src={src} alt="" style={{...style,transformOrigin:`${layer.pivot![0]*100}% ${layer.pivot![1]*100}%`}} />
            : <div key={layer.key} className="entrance-exterior" style={{clipPath:knockout}}><img data-layer={layer.kind} data-parallax={layer.parallax??0} src={src} alt="" style={style}/></div>
        })}
      </div>
    </>}
    <div className="entrance-actions"><button onClick={() => r.skipEntrance()}>{cn ? '跳过动画' : 'Skip animation'}</button><button onClick={close} aria-label={cn ? '关闭小院' : 'Close courtyard'}>×</button></div>
    <div className="entrance-status" role="progressbar" aria-label={cn ? '小院整体准备进度' : 'Overall courtyard preparation'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress*100)} aria-valuetext={phaseText}>
      <div className="entrance-portraits">{characterIds.map((id, index) => <Portrait key={id} id={id} fill={portraitFill(progress, index)} />)}</div>
      <p role="status">{phaseText}</p>
      {hint === 2 && !canReveal && <small>{cn ? '正在等待资源校验或画面确认，可以关闭后再回来。' : 'Waiting for verified resources or a rendered frame. You can close and return later.'}</small>}
    </div>
  </div>
}
export const entranceCSS = `
.village-entrance{position:absolute;inset:0;z-index:25;overflow:hidden;color:#514b3e;isolation:isolate;pointer-events:auto}
.village-entrance[data-simple=true]{background:radial-gradient(ellipse at 50% 40%,#f4ecdc,#ded9c6)}
[data-theme=dark] .village-entrance[data-simple=true]{background:radial-gradient(ellipse at 50% 40%,#403b35,#2c2926);color:#eee6d5}
.entrance-camera,.entrance-exterior,.entrance-atmosphere{position:absolute;inset:0}
.entrance-camera{transform-origin:0 0;transform:var(--far-transform);perspective:var(--entrance-perspective);perspective-origin:50% 50%}
.entrance-exterior img,.entrance-camera>img{position:absolute;object-fit:fill}
.entrance-camera>img{backface-visibility:hidden}
.entrance-atmosphere>div{position:absolute;top:0;bottom:0;width:max(0px,calc((100% - var(--stage-width))/2 + 1px));background-color:#d8d1b1;background-size:auto 110%;background-position:center;filter:blur(8px)}
.entrance-atmosphere>[data-side="0"]{left:-1px}.entrance-atmosphere>[data-side="1"]{right:-1px}
.entrance-actions{position:absolute;top:8px;right:8px;display:flex;gap:8px;z-index:2}
.entrance-actions button{min-width:40px!important;min-height:40px!important;color:#514b3e;background:#f5efdfeb!important;border:1px solid #82745a55!important;border-radius:12px!important}
.entrance-actions button:focus-visible{outline:2px solid #805b36;outline-offset:2px}
.entrance-status{position:absolute;left:8px;right:8px;bottom:12%;text-align:center;padding:14px 0;border-radius:18px;background:#f2ebdbe6;max-width:420px;margin:auto}
[data-theme=dark] .entrance-status{background:#2c2926e8;color:#eee6d5}
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
