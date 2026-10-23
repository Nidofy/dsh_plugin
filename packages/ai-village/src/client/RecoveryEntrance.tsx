import { useEffect, useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { EntranceOverlay } from './EntranceOverlay.tsx'
import { entranceArt } from './entrance-art.ts'
import { entranceKnockout, entranceLayout } from './entrance-theme.ts'

/** Local, offline recovery curtain. The production entrance art selector is unchanged. */
export function RecoveryEntrance({ runtime: r, cn, close, retryFrame }: { runtime: VillageRuntime; cn: boolean; close(): void; retryFrame(): void }) {
  const [opening, setOpening] = useState(false)
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null)
  const [artReady, setArtReady] = useState(false), [artFailed, setArtFailed] = useState(false)
  const art = entranceArt, showArt = !!art && !artFailed
  const t = (zh: string, en: string) => cn ? zh : en
  useEffect(() => {
    if (!showArt || !stage.current || r.entrance.doorOpened) return
    let cancelled = false
    void Promise.all([...stage.current.querySelectorAll('img')].map(img => img.decode())).then(() => { if (!cancelled) setArtReady(true) }, () => { if (!cancelled) setArtFailed(true) })
    return () => { cancelled = true }
  }, [showArt, r.entrance.doorOpened])
  useEffect(() => {
    if (!art || !stage.current || !root.current || r.entrance.doorOpened) return
    const node = stage.current, viewport = root.current
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect(), layout = entranceLayout(width, height, art)
      Object.assign(node.style, { width: `${layout.width}px`, height: `${layout.height}px`, left: `${layout.left}px`, top: `${layout.top}px`, transform: layout.near })
      node.style.setProperty('--entrance-perspective', `${layout.perspective}px`)
    }
    const observer = new ResizeObserver(resize); resize(); observer.observe(viewport)
    return () => observer.disconnect()
  }, [art, showArt, r.entrance.doorOpened])
  useEffect(() => {
    if (!opening) return
    const reduced = r.preferences.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => {
      retryFrame()
      void r.retryEntrance().finally(() => setOpening(false))
    }, reduced ? 0 : 420)
    return () => clearTimeout(timer)
  }, [opening, r, retryFrame])
  if (r.entrance.doorOpened) return <EntranceOverlay runtime={r} cn={cn} close={close} />
  return <div ref={root} className="village-entrance village-recovery-door" data-opening={opening} data-art-ready={showArt && artReady} data-simple="true">
    {showArt && art && <div ref={stage} className="entrance-camera recovery-art" aria-hidden="true" style={{ visibility: artReady ? 'visible' : 'hidden' }}>
      {art.layers.map(layer => {
        const style = { left: `${layer.rect.x * 100}%`, top: `${layer.rect.y * 100}%`, width: `${layer.rect.width * 100}%`, height: `${layer.rect.height * 100}%` }
        const src = `/api/nidofy-ai-village/assets/${layer.key}`
        return ['left', 'right'].includes(layer.kind)
          ? <img key={layer.key} data-door={layer.kind} src={src} alt="" style={{ ...style, transformOrigin: `${layer.pivot![0] * 100}% ${layer.pivot![1] * 100}%` }} />
          : <div key={layer.key} className="entrance-exterior" style={{ clipPath: entranceKnockout(art) }}><img src={src} alt="" style={style} /></div>
      })}
    </div>}
    <button className="recovery-door-target" disabled={opening || r.reentryBusy} onClick={() => setOpening(true)} aria-label={t('点击开门，重新进入', 'Open the doors and enter again')}>
      {(!showArt || !artReady) && <span className="recovery-door-frame" aria-hidden="true"><span className="recovery-door-leaf"/><span className="recovery-door-leaf"/></span>}
      <span className="recovery-door-copy"><strong>{opening ? t('正在开门…', 'Opening the doors…') : t('点击画面，重新进入', 'Click to enter again')}</strong>
      <span>{t('回到门前了，小院记录仍然保留。', 'Back at the entrance. Your village records are preserved.')}</span></span>
    </button>
    <button className="recovery-door-close" onClick={close}>{t('关闭小院', 'Close village')}</button>
    <details className="recovery-door-details"><summary>{t('诊断与恢复', 'Diagnostics and recovery')}</summary>
      <p>{r.errorCode || t('场景等待重新加载', 'The scene needs to reload')}</p>
      <p>{t('若重新进入后仍未恢复，请检查连接或存档。恢复上一版本只会在你明确点击后执行。', 'If entry still fails, check the connection or save. Restoring a previous revision requires your explicit action.')}</p>
      {!!r.error && <button disabled={opening || r.reentryBusy} onClick={() => void (r.error.includes('PREFERENCES') ? r.recoverPreferences() : r.recover())}>{t('恢复上一成功版本', 'Restore previous revision')}</button>}
    </details>
  </div>
}
export const recoveryEntranceCSS = `
.village-recovery-door{display:flex;flex-direction:column;justify-content:center;padding:16px;gap:12px}
.recovery-door-target{flex:1;min-height:0;width:100%;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:transparent!important;color:inherit!important;border:0!important;cursor:pointer}
.recovery-door-target{position:relative;z-index:1}.recovery-door-copy{display:grid;gap:12px;font-size:13px;line-height:1.5;padding:12px;border-radius:14px;background:#f2ebdbe6;color:#514b3e}.recovery-door-target:focus-visible{outline:2px solid #96764c;outline-offset:-3px}
.village-recovery-door[data-art-ready=true] .recovery-door-target{justify-content:flex-end;padding-bottom:8%}.recovery-art{pointer-events:none}.recovery-art>[data-door]{transition:transform 420ms ease-in-out;transform:rotateY(0deg)}
[data-opening=true] .recovery-art>[data-door=left]{transform:rotateY(82deg)}[data-opening=true] .recovery-art>[data-door=right]{transform:rotateY(-82deg)}
[data-theme=dark] .recovery-door-copy{background:#2c2926e8;color:#eee6d5}
.recovery-door-frame{display:flex;width:70%;max-width:230px;height:clamp(96px,32vh,280px);max-height:58%;border:9px solid #ae9069;border-radius:70px 70px 6px 6px;overflow:hidden;perspective:650px;background:#f9e8bc;box-shadow:0 7px 24px #48392025}
.recovery-door-leaf{position:relative;display:block;width:50%;height:100%;background:repeating-linear-gradient(90deg,#b39871 0,#b39871 20%,#a68a63 21%,#a68a63 22%);border:1px solid #816946;transform-origin:left;transition:transform 420ms ease-in-out}
.recovery-door-leaf+span{transform-origin:right}.recovery-door-leaf:after{content:'';position:absolute;right:9%;top:58%;width:8px;height:15px;border:2px solid #f0d391;border-radius:8px}.recovery-door-leaf+span:after{right:auto;left:9%}
[data-opening=true] .recovery-door-leaf{transform:rotateY(-100deg)}[data-opening=true] .recovery-door-leaf+span{transform:rotateY(100deg)}
.recovery-door-close{position:absolute;top:8px;right:8px;min-height:40px;z-index:2;background:var(--solid)!important;color:var(--ink)!important;border-radius:10px;padding:8px}.recovery-door-details{position:relative;z-index:2;font-size:12px;max-height:35%;overflow:auto;flex-shrink:0;background:var(--solid);color:var(--ink);border-radius:10px;padding:4px 8px}.recovery-door-details summary{cursor:pointer;min-height:32px}.recovery-door-details button{min-height:40px}
[data-motion=true] .recovery-door-leaf,[data-motion=true] .recovery-art>[data-door]{transition:none}@media(prefers-reduced-motion:reduce){.recovery-door-leaf,.recovery-art>[data-door]{transition:none}}
`
