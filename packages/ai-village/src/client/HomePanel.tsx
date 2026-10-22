import { useEffect, useRef } from 'react'
import type { VillageRuntime } from './runtime.ts'
import { furnitureIds, type Accessory } from '../core/home-state.ts'
import { layouts, layoutNames, type Locale } from '../core/neighborhood-catalog.ts'
import { characterNames } from '../core/roster.ts'

export function HomePanel({ runtime, locale, locked }: { runtime: VillageRuntime; locale: Locale; locked: boolean }) {
  const t = (zh: string, en: string) => locale === 'zh' ? zh : en, world = runtime.controller?.world, draft = runtime.homeDraft
  const entry = useRef<HTMLButtonElement>(null), wasEditing = useRef(!!draft)
  useEffect(() => {
    if (wasEditing.current && !draft) entry.current?.focus()
    wasEditing.current = !!draft
  }, [draft])
  if (!world) return null
  const busy = runtime.homeSaving || !runtime.ready || !!runtime.error || runtime.saveReceipt.status === 'pending'
  const names = { work: t('书桌', 'Writing desk'), eat: t('餐桌', 'Dining table'), bench: t('长椅', 'Bench'), corner: t('生活角落', 'Living corner') }
  return <section className="village-home" onKeyDown={e => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing && draft && !busy) { runtime.cancelHome(); e.preventDefault(); e.stopPropagation() }
  }}><h3>{t('我的小院', 'Make it your courtyard')}</h3>
    {!draft ? <><p>{t('家具移动会改变座位和路线。先结束活动，再开始布置。', 'Furniture moves change seats and paths. Finish activities before arranging.')}</p>
      <button ref={entry} disabled={locked || !!world.activeEvent || !!world.neighborhood.event} onClick={() => runtime.beginHome()}>{t('编辑我的小院', 'Arrange my courtyard')}</button></> : <>
      <p role="status">{t('正在预览，世界已暂停。确认后保存，取消保留原样。', 'Previewing with the world paused. Confirm to save, or cancel to keep the original.')}</p>
      <fieldset disabled={busy}><legend>{t('布局模板', 'Layout templates')}</legend><div className="choices">{layouts.map(id => <button key={id} onClick={() => runtime.homeTemplate(id)}>{layoutNames[id][locale]} · {t('模板', 'template')}</button>)}</div>
      <label>{t('生活角落', 'Living corner')}<select aria-label={t('生活角落类型', 'Living corner type')} value={draft.layout} onChange={e => runtime.updateHome(draft.home, e.target.value as typeof draft.layout)}>{layouts.map(id => <option key={id} value={id}>{layoutNames[id][locale]}</option>)}</select></label>
      {furnitureIds.map(id => <div key={id}><strong>{names[id]}</strong><div className="choices">{([0, 1] as const).map(index => <button key={index} aria-pressed={draft.home.positions[id] === index} onClick={() => runtime.updateHome({ ...draft.home, positions: { ...draft.home.positions, [id]: index } })}>{names[id]} · {index === 0 ? t('原位', 'original') : t('替代锚点', 'alternate anchor')}</button>)}</div></div>)}
      <label>{t('环境主题', 'Environment')}<select aria-label={t('环境主题', 'Environment')} value={draft.home.environment} onChange={e => runtime.updateHome({ ...draft.home, environment: e.target.value as 'afternoon' | 'twilight' })}><option value="afternoon">{t('暖阳午后', 'Warm afternoon')}</option><option value="twilight">{t('暮色灯火', 'Twilight lights')}</option></select></label>
      <label>{characterNames[world.actor.id]} · {t('配饰', 'accessory')}<select aria-label={t('居民配饰', 'Resident accessory')} value={draft.home.accessories[world.actor.id]} onChange={e => runtime.updateHome({ ...draft.home, accessories: { ...draft.home.accessories, [world.actor.id]: e.target.value as Accessory } })}><option value="none">{t('不佩戴', 'None')}</option><option value="ribbon">{t('布艺结', 'Fabric bow')}</option><option value="leaf">{t('叶形胸针', 'Leaf pin')}</option></select></label></fieldset>
      <div className="choices"><button disabled={busy || !runtime.canUndoHome} onClick={() => runtime.undoHome()}>{t('撤销上一步', 'Undo last change')}</button><button disabled={busy} onClick={() => void runtime.confirmHome()}>{t('确认我的布置', 'Confirm my arrangement')}</button><button disabled={busy} onClick={() => runtime.cancelHome()}>{t('取消我的布置', 'Cancel my arrangement')}</button></div>
      {runtime.homeDraftError && <p role="alert">{runtime.homeDraftError === 'FURNITURE_OCCUPIED' ? t('这个位置有居民，请取消布置、挪开居民后再试。', 'A resident is here. Cancel, move them, then try again.') : runtime.homeDraftError === 'LAYOUT_CONFLICT' ? t('布局已变化，请取消并重新开始。', 'The layout changed. Cancel and start again.') : t('当前布置无法确认。检查活动与连接状态后重试；不会自动重复保存。', 'Cannot confirm this arrangement. Check activities and connection; saves are never automatically repeated.')}</p>}
    </>}
  </section>
}
