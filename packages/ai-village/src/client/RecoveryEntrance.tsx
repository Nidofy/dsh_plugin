import { useEffect, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { EntranceOverlay } from './EntranceOverlay.tsx'

/** Local, offline recovery curtain. The production entrance art selector is unchanged. */
export function RecoveryEntrance({ runtime: r, cn, close, retryFrame }: { runtime: VillageRuntime; cn: boolean; close(): void; retryFrame(): void }) {
  const [opening, setOpening] = useState(false)
  const t = (zh: string, en: string) => cn ? zh : en
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
  return <div className="village-entrance village-recovery-door" data-opening={opening} data-simple="true">
    <button className="recovery-door-target" disabled={opening || r.reentryBusy} onClick={() => setOpening(true)} aria-label={t('点击开门，重新进入', 'Open the doors and enter again')}>
      <span className="recovery-door-frame" aria-hidden="true"><span className="recovery-door-leaf"/><span className="recovery-door-leaf"/></span>
      <strong>{opening ? t('正在开门…', 'Opening the doors…') : t('点击画面，重新进入', 'Click to enter again')}</strong>
      <span>{t('回到门前了，小院记录仍然保留。', 'Back at the entrance. Your village records are preserved.')}</span>
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
.recovery-door-target>span:last-child{font-size:13px;line-height:1.5}.recovery-door-target:focus-visible{outline:2px solid #96764c;outline-offset:-3px}
.recovery-door-frame{display:flex;width:70%;max-width:230px;height:clamp(96px,32vh,280px);max-height:58%;border:9px solid #ae9069;border-radius:70px 70px 6px 6px;overflow:hidden;perspective:650px;background:#f9e8bc;box-shadow:0 7px 24px #48392025}
.recovery-door-leaf{position:relative;display:block;width:50%;height:100%;background:repeating-linear-gradient(90deg,#b39871 0,#b39871 20%,#a68a63 21%,#a68a63 22%);border:1px solid #816946;transform-origin:left;transition:transform 420ms ease-in-out}
.recovery-door-leaf+span{transform-origin:right}.recovery-door-leaf:after{content:'';position:absolute;right:9%;top:58%;width:8px;height:15px;border:2px solid #f0d391;border-radius:8px}.recovery-door-leaf+span:after{right:auto;left:9%}
[data-opening=true] .recovery-door-leaf{transform:rotateY(-100deg)}[data-opening=true] .recovery-door-leaf+span{transform:rotateY(100deg)}
.recovery-door-close{position:absolute;top:8px;right:8px;min-height:40px}.recovery-door-details{font-size:12px;max-height:35%;overflow:auto;flex-shrink:0}.recovery-door-details summary{cursor:pointer;min-height:32px}.recovery-door-details button{min-height:40px}
[data-motion=true] .recovery-door-leaf{transition:none}@media(prefers-reduced-motion:reduce){.recovery-door-leaf{transition:none}}
`
