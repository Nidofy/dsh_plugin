import { useEffect, useRef } from 'react'
import type { VillageRuntime } from './runtime.ts'
export function SettingsPanel({ runtime: r, cn, close }: { runtime: VillageRuntime; cn: boolean; close(): void }) {
  const t = (a: string, b: string) => cn ? a : b, p = r.preferences, locked = r.preferencesSaving || !!r.error
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [])
  return <section ref={ref} className="village-settings" role="dialog" aria-label={t('小院设置', 'Courtyard settings')} onKeyDown={e => {
    if (e.key !== 'Tab') return
    const nodes = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),summary')]
    if (e.shiftKey && document.activeElement === nodes[0]) { nodes.at(-1)?.focus(); e.preventDefault() }
    else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { nodes[0]?.focus(); e.preventDefault() }
  }}><header><h2>{t('小院设置', 'Courtyard settings')}</h2><button onClick={close}>{t('完成', 'Done')}</button></header>
    <h3>{t('显示与交互', 'Display and interaction')}</h3>
    <label>{t('界面主题', 'Theme')}<select aria-label={t('界面主题', 'Theme')} value={p.theme} disabled={locked} onChange={e => void r.setPreferences({ theme: e.target.value as typeof p.theme })}><option value="system">{t('跟随系统', 'System')}</option><option value="light">{t('浅色', 'Light')}</option><option value="dark">{t('深色', 'Dark')}</option></select></label>
    <label>{t('语言', 'Language')}<select aria-label={t('语言', 'Language')} value={p.language} disabled={locked} onChange={e => void r.setPreferences({ language: e.target.value as typeof p.language })}><option value="system">{t('跟随 DSH', 'Follow DSH')}</option><option value="zh">中文</option><option value="en">English</option></select></label>
    {(['reducedMotion', 'reducedTransparency', 'bubbles'] as const).map((id, i) => <label key={id}><input type="checkbox" checked={p[id]} disabled={locked} onChange={e => void r.setPreferences({ [id]: e.target.checked })} />{[t('减少动态', 'Reduce motion'), t('减少透明效果', 'Reduce transparency'), t('显示对话气泡', 'Show speech bubbles')][i]}</label>)}
    <p role="status">{r.preferencesSaving ? t('设置保存中…', 'Saving preferences…') : r.error ? t('设置尚未确认，请重新读取核对。', 'Preferences are unconfirmed. Read again to verify.') : t('设置已确认', 'Preferences confirmed')}</p>
    {r.softwareRendering && <p>{t('当前使用实色面板以降低绘制开销，透明效果偏好仍保留。', 'Solid panels reduce rendering cost here; your transparency preference is preserved.')}</p>}
    <h3>{t('视角与操作', 'View and controls')}</h3><button onClick={() => r.resetCamera()}>{t('恢复全景', 'Reset view')}</button><p>{t('滚轮缩放，拖动空地平移。轻点居民查看，拖到活动位安排日常。Esc 逐层返回；布置也可用位置按钮。', 'Wheel to zoom; drag empty ground to pan. Tap a resident to inspect, or drag to a seat. Escape returns one layer. Arrangement also supports position buttons.')}</p>
    <h3>{t('运行与存档', 'Runtime and saves')}</h3><p>{t('暂停原因', 'Pause reasons')}：{[...r.reasons].join(' / ') || t('运行中', 'Running')}</p><p>{t('最近确认修订', 'Last confirmed revision')}：r{r.revision} · {r.saveReceipt.status}</p>
    {r.retentionWarning && <p role="alert">{t('旧快照清理需要检查，已保存数据仍保留。', 'Snapshot cleanup needs attention; saved data is retained.')}</p>}
    <details><summary>{t('开发与恢复', 'Diagnostics and recovery')}</summary><p>{t('仅在存档故障时恢复上一成功版本。', 'Restore the previous successful revision only when recovery is needed.')}</p><button onClick={() => void r.recover()}>{t('恢复上一版小院', 'Restore previous courtyard')}</button><button onClick={() => void r.recoverPreferences()}>{t('恢复上一版设置', 'Restore previous preferences')}</button></details>
  </section>
}
