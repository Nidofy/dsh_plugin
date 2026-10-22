import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { attachFloatingLayout, type FloatingGeometry } from './floating-layout.ts'
import { attachFrame } from './frame-bridge.ts'
import type { VillageRuntime } from './runtime.ts'
import { en, zh } from './messages.ts'
import { characterIds, characterNames, type CharacterId } from '../core/roster.ts'
import { actors } from '../core/world.ts'
import { dialogue, bellReaction, villageTime } from '../core/dialogue.ts'
import type { BellSlot, Food } from '../core/content-state.ts'
import { PhotoPanel } from './PhotoPanel.tsx'
import { HomePanel } from './HomePanel.tsx'
import { VillageIcon } from './Icon.tsx'
import { NeighborhoodPanel } from './NeighborhoodPanel.tsx'
import { css } from './content-style.ts'
export { css }
function Scene({ runtime, fail }: { runtime: VillageRuntime; fail(): void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => ref.current ? attachFrame(ref.current, runtime, fail) : undefined, [runtime, fail])
  return <iframe ref={ref} src="/api/nidofy-ai-village/frame" title="AI 小院互动场景 / Interactive courtyard" sandbox="allow-scripts" />
}
export function Floating({ runtime, locale, active, onClose }: { runtime: VillageRuntime; locale: string; active: boolean; onClose(): void }) {
  useSyncExternalStore(runtime.subscribeUI, runtime.snapshotUI)
  const language = runtime.preferences.language === 'system' ? (locale === 'zh' ? 'zh' : 'en') : runtime.preferences.language
  useEffect(() => runtime.setLocale(language), [runtime, language])
  const cn = language === 'zh', t = cn ? zh : en, text = (zh: string, en: string) => cn ? zh : en
  const anchor = useRef<HTMLDivElement>(null), expandButton = useRef<HTMLButtonElement>(null), settingsButton = useRef<HTMLButtonElement>(null)
  const [geometry, setGeometry] = useState<FloatingGeometry | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false), [settings, setSettings] = useState(false)
  const [tab, setTab] = useState<'residents' | 'wishes' | 'decor' | 'journal'>('wishes')
  const [first, setFirst] = useState<CharacterId>('bluewhale'), [second, setSecond] = useState<CharacterId>('claude'), [food, setFood] = useState<Food>('tea')
  const editing = runtime.decorationDraft !== undefined, slot = runtime.decorationDraft ?? null
  const [fail] = useState(() => () => { setFailed(true); runtime.setFrameReady(false) })
  useLayoutEffect(() => {
    if (!runtime.open || !active || !anchor.current) { setGeometry(null); runtime.pause('sidebar', true); return }
    return attachFloatingLayout(anchor.current, value => { setGeometry(value); runtime.pause('sidebar', !value) }, expanded)
  }, [runtime, runtime.open, active, expanded])
  const insufficient = !!geometry && (geometry.height < 360 || (geometry.width ?? 340) < 320)
  useEffect(() => { runtime.pause('insufficient-space', insufficient); return () => runtime.pause('insufficient-space', false) }, [runtime, insufficient])
  useEffect(() => {
    if (!runtime.open) setSettings(false)
  }, [runtime, runtime.open])
  const visible = runtime.open && active && geometry && !runtime.reasons.has('hidden')
  const world = runtime.controller?.world, actor = world?.actor, members = world ? actors(world) : []
  const memberIds = members.map(a => a.id)
  const selectedFirst = memberIds.includes(first) ? first : memberIds[0]
  const selectedSecond = memberIds.includes(second) && second !== selectedFirst ? second : memberIds.find(id => id !== selectedFirst)
  const event = world?.activeEvent, time = villageTime(world?.ticks ?? 0)
  const receipt = runtime.saveReceipt, baseLocked = runtime.photoMode || !runtime.ready || !!runtime.error || runtime.reasons.has('commit-pending'), locked = baseLocked || runtime.arranging
  const status = runtime.controller?.pauseReasons.size ? t.paused : runtime.controller?.drag?.active ? t.dragging : actor ? t[actor.behavior] : t.loading
  const saveStatus = receipt.status === 'pending' || runtime.preferencesSaving ? t.saving : receipt.status === 'unknown' ? t.saveUnknown
    : receipt.status === 'rejected' ? t.saveRejected : runtime.revision ? `${t.lastSaved} r${runtime.revision}` : t.notSaved
  const abortDraft = () => { if (!runtime.homeSaving) runtime.cancelArrangements() }
  const tabs = { residents: text('居民', 'Residents'), wishes: text('心愿', 'Wishes'), decor: text('布置', 'Decor'), journal: text('手账', 'Journal') }
  const slots: [BellSlot, string][] = [['window', text('窗边', 'Window')], ['door', text('门旁', 'Doorway')], ['wall', text('院墙', 'Garden wall')]]
  const settingsLocked = locked || runtime.preferencesSaving
  const preferenceError = runtime.error.includes('PREFERENCES_')
  const recoverLabel = preferenceError ? text('恢复上一版设置', 'Restore previous settings') : t.recover
  return <div ref={anchor} data-nidofy-ai-village-overlay="" data-nidofy-village-open={runtime.open && active ? '' : undefined} className="dsh-ai-village"><style>{css}</style>
    {visible && <aside className="village-card" data-expanded={expanded} data-narrow={(geometry.width ?? 340) < 900} data-short={geometry.height < 480} data-theme={runtime.preferences.theme} aria-label={t.title}
      style={{ left: geometry.left, top: geometry.top, width: geometry.width ?? 340, height: Math.min(expanded ? 760 : 720, geometry.height) }}
      onKeyDown={e => {
        if (e.key !== 'Escape' || e.nativeEvent.isComposing) return
        if (runtime.arranging && baseLocked) { e.preventDefault(); e.stopPropagation(); return }
        if (runtime.homeDraft) { if (!runtime.homeSaving) runtime.cancelHome() }
        else if (runtime.photoMode) runtime.exitPhoto()
        else if (editing || runtime.extraDecorationDraft) abortDraft()
        else if (settings) { setSettings(false); settingsButton.current?.focus() }
        else if (expanded) { setExpanded(false); expandButton.current?.focus() }
        else return
        e.preventDefault(); e.stopPropagation()
      }}>
      <header className="village-header"><strong><VillageIcon name="home" /> {t.title}</strong>
        <button disabled={locked} onClick={() => runtime.pause('user', !world?.userPaused)}>{world?.userPaused ? t.resume : t.pause}</button>
        <button disabled={locked || runtime.photoMode || !runtime.frameReady} aria-label={text('拍照', 'Photo mode')} onClick={()=>void runtime.enterPhoto()}><VillageIcon name="camera" /></button>
        <button ref={expandButton} aria-label={text(expanded ? '收起小院' : '展开小院', expanded ? 'Compact courtyard' : 'Expand courtyard')} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}><VillageIcon name={expanded ? 'compact' : 'expand'} /></button>
        <button ref={settingsButton} aria-label={text('小院设置', 'Courtyard settings')} aria-expanded={settings} onClick={() => setSettings(!settings)}><VillageIcon name="settings" /></button>
        <button aria-label={t.close} onClick={onClose}><VillageIcon name="close" /></button>
      </header>
      <label className="village-roster">{text('小院伙伴', 'Companion')}
        <select aria-label={text('选择角色', 'Choose character')} value={actor?.id ?? 'bluewhale'} disabled={locked} onChange={e => runtime.selectCharacter(e.target.value)}>
          {characterIds.filter(id => members.length <= 1 || memberIds.includes(id)).map(id => <option key={id} value={id}>{characterNames[id]}</option>)}
        </select>
      </label>
      <details className="village-members"><summary>{text('在场伙伴', 'Residents')} · {members.length}/7</summary>
        <div className="village-members-menu"><div className="village-members-list">
          {characterIds.map(id => <label key={id}><input type="checkbox" aria-label={text('入住 ', 'Resident ') + characterNames[id]} checked={memberIds.includes(id)}
            disabled={locked || (members.length === 1 && memberIds.includes(id))} onChange={e => runtime.setCharacterPresent(id, e.target.checked)} />{characterNames[id]}</label>)}
        </div><button disabled={locked} onClick={() => runtime.setAllCharacters(true)}>{text('全员入住', 'Invite everyone')}</button>
        <button disabled={locked} onClick={() => runtime.setAllCharacters(false)}>{text('仅留当前', 'Keep selected only')}</button></div>
      </details>
      <div className="village-footer" role="status">{status} · {saveStatus}</div>
      {runtime.retentionWarning && <div className="village-footer" role="status">{t.retentionWarning}</div>}
      {insufficient ? <p className="village-error">{text('当前空间不足，已暂停。切换展开／收起或调整窗口后继续；聊天输入区保持可用。', 'Paused for limited space. Switch size or resize the window to continue; the chat composer stays available.')}</p> :
      <div className="village-body"><div className="village-world">
        <span className="village-time">{text(`小院第 ${time.day} 天`, `Day ${time.day}`)} · {String(time.hour).padStart(2, '0')}:{String(time.minute).padStart(2, '0')}</span>
        {runtime.error ? <div className="village-error" role="alert"><p>{runtime.error.includes('WORLD_IN_USE') ? t.occupied : /PROFILE_CHANGED|REVISION_CONFLICT|HOST_CHANGED/.test(runtime.error) ? t.conflict : t.error}</p>
          <button onClick={() => runtime.retry()}>{t.retry}</button><details><summary>{recoverLabel}</summary><p>{preferenceError ? text('仅恢复显示设置，小院进度保持原样。', 'Restore display preferences while keeping courtyard progress.') : t.recovery}</p><button onClick={() => void (preferenceError ? runtime.recoverPreferences() : runtime.recover())}>{recoverLabel}</button></details></div>
          : failed ? <div className="village-error">{t.frameFailed}<button onClick={() => { setFailed(false); setRetry(v => v + 1) }}>{t.retryFrame}</button></div>
          : runtime.ready ? <div className="village-canvas"><Scene key={runtime.generation + ':' + retry} runtime={runtime} fail={fail} /></div> : <p>{t.loading}</p>}
      </div><section className="village-content">
        {!runtime.photoMode && <nav className="village-tabs" role="tablist" aria-label={text('小院页面', 'Courtyard pages')}>
          {(Object.keys(tabs) as (keyof typeof tabs)[]).map(key => <button role="tab" key={key} id={`village-tab-${key}`} aria-controls="village-panel" aria-selected={tab === key}
            onClick={() => { if (tab !== key) abortDraft(); setTab(key) }} onKeyDown={e => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              const keys = Object.keys(tabs) as (keyof typeof tabs)[], next = keys[(keys.indexOf(key) + (e.key === 'ArrowRight' ? 1 : 3)) % 4]!
              abortDraft(); setTab(next); document.getElementById(`village-tab-${next}`)?.focus(); e.preventDefault()
            }}>{tabs[key]}</button>)}
        </nav>}
        <div id="village-panel" className="village-panel" role="tabpanel" aria-labelledby={`village-tab-${tab}`}>
          {runtime.photoMode && <PhotoPanel runtime={runtime} locale={language} />}
          {!runtime.photoMode && <>
          {tab === 'residents' && <><p className="eyebrow">OUR LITTLE COURTYARD</p><h2>{text('慢慢认识彼此', 'A little company')}</h2>
            <p>{text('在「在场伙伴」中安排入住。点击选择居民，也可以轻轻拖动。', 'Choose who stays using Residents above. Select a resident here, or gently drag them in the scene.')}</p>
            {members.map(a => <div className="village-person" key={a.id}><img alt="" src={`/api/nidofy-ai-village/assets/${a.id === 'bluewhale' ? '' : a.id + '/'}parts/face-neutral.png`} />
              <span><strong>{characterNames[a.id]}</strong><small>{t[a.behavior]}</small></span><button disabled={locked} aria-pressed={a.id === actor?.id} onClick={() => runtime.selectCharacter(a.id)}>{text('看看', 'Select')}</button></div>)}</>}
          {tab === 'wishes' && <><p className="eyebrow">A MOMENT TO SHARE</p><h2>{text('同桌的午后', 'An afternoon together')}</h2>
            <p>{text('邀请两位居民坐到餐桌前。第一次完成，会记下一页手账，也带来一枚风铃。', 'Invite two residents to the table. Your first gathering adds a journal entry and unlocks a wind chime.')}</p>
            {event ? <div className="village-status"><strong>{event.phase === 'approaching' ? text('正在依次入座…', 'Taking their seats…') : text('聊得正好', 'A good conversation')}</strong>
              <p>{event.participants.map(id => characterNames[id]).join(' · ')} · {event.food === 'tea' ? text('热茶', 'Tea') : text('白米饭', 'Rice')}</p>
              {world && dialogue(world, language).map(row => <p key={row.actor}>{characterNames[row.actor]}：{row.text}</p>)}
              <button disabled={locked} onClick={() => void runtime.cancelEvent()}>{text('取消邀请', 'Cancel gathering')}</button></div> : <>
              {world?.journal.length ? <p role="status">✓ {text('首个心愿已完成，再坐一会儿吧。', 'First wish completed. There is always time for another visit.')}</p> : null}
              {members.length < 2 ? <button className="primary" disabled={locked} onClick={() => runtime.setCharacterPresent(actor?.id === 'claude' ? 'bluewhale' : 'claude', true)}>{text('请一位朋友入住', 'Welcome a friend')}</button> : <>
                <label>{text('第一位朋友', 'First guest')}<select aria-label={text('第一位朋友', 'First guest')} value={selectedFirst} disabled={locked} onChange={e => setFirst(e.target.value as CharacterId)}>{members.map(a => <option value={a.id} key={a.id}>{characterNames[a.id]}</option>)}</select></label>
                <label>{text('第二位朋友', 'Second guest')}<select aria-label={text('第二位朋友', 'Second guest')} value={selectedSecond} disabled={locked} onChange={e => setSecond(e.target.value as CharacterId)}>{members.filter(a => a.id !== selectedFirst).map(a => <option value={a.id} key={a.id}>{characterNames[a.id]}</option>)}</select></label>
                <div className="choices">{(['tea', 'rice'] as const).map(value => <button key={value} disabled={locked} aria-pressed={food === value} onClick={() => setFood(value)}>{value === 'tea' ? text('热茶', 'Tea') : text('白米饭', 'Rice')}</button>)}</div>
                <button className="primary" disabled={locked || !!world?.neighborhood.event || !selectedFirst || !selectedSecond} onClick={() => selectedFirst && selectedSecond && void runtime.invite([selectedFirst, selectedSecond], food)}>{text('邀请同桌', 'Invite to the table')}</button>
              </>}
              {runtime.actionError && <p role="alert">{text('座位或通路暂时被占用。请挪开桌边的居民，再邀请一次。', 'A seat or route is occupied. Move the resident by the table, then invite again.')}</p>}
            </>}
          </>}
          {tab === 'journal' && <><p className="eyebrow">LITTLE THINGS, KEPT</p><h2>{text('小院手账', 'Courtyard journal')}</h2>
            {!world?.journal.length ? <p>{text('第一段回忆，等一次同桌的午后。', 'The first memory begins with an afternoon together.')}</p> : [...world.journal].reverse().map(row => <article className="village-journal" key={row.id}>
              <small>{text(`小院第 ${villageTime(row.completedTick).day} 天`, `Day ${villageTime(row.completedTick).day}`)} · ×{row.count}</small><h3>{text('今天，我们坐到了一起', 'Today, we shared a table')}</h3>
              <p>{row.participants.map(id => characterNames[id]).join(' & ')} · {row.food === 'tea' ? text('一壶热茶', 'Warm tea') : text('一碗白米饭', 'A bowl of rice')}</p>
              <p>{text('留一点空闲，给身边的人。', 'A little unhurried time, for someone nearby.')}</p></article>)}</>}
          {tab === 'decor' && <><p className="eyebrow">MAKE ROOM FOR THE BREEZE</p><h2>{text('风经过的地方', 'A place for the breeze')}</h2>
            {!world?.decorations.windChime ? <p>{text('完成「同桌的午后」后，会收到一枚小风铃。', 'Complete An afternoon together to receive a little wind chime.')}</p> : <>
              <p>{text('一枚小风铃，三个挂点。先看看，再决定留下。', 'One chime, three places. Preview a spot before you keep it.')}</p>
              {editing ? <><div className="choices">{slots.map(([id, label]) => <button key={id} disabled={baseLocked} aria-pressed={slot === id} onClick={() => runtime.previewDecoration(id)}>{label}</button>)}</div>
                <button disabled={baseLocked} aria-pressed={slot === null} onClick={() => runtime.previewDecoration(null)}>{text('暂时收起', 'Put away')}</button>
                <button className="primary" disabled={baseLocked} onClick={() => void runtime.decorate(slot).then(result => { if (result?.status === 'committed') abortDraft() })}>{text('确认摆放', 'Keep this placement')}</button>
                <button disabled={baseLocked} onClick={abortDraft}>{text('取消', 'Cancel')}</button></> : <>
                <p>{text('当前位置：', 'Current spot: ')}{slots.find(([id]) => id === world.decorations.windChime?.slot)?.[1] ?? text('已收好', 'Put away')}</p>
                <button className="primary" disabled={locked} onClick={() => { const value = world.decorations.windChime?.slot ?? 'window'; runtime.previewDecoration(value) }}>{text('选择挂点', 'Choose a spot')}</button>
                {world.decorations.windChime.slot && <div className="village-status"><strong>{characterNames[world.actor.id]}</strong><p>{bellReaction(world.actor.id, language)}</p></div>}
              </>}
            </>}
          </>}
          {tab === 'journal' && <PhotoPanel runtime={runtime} locale={language} albumOnly />}
          {tab === 'decor' && <HomePanel runtime={runtime} locale={language} locked={locked} />}
          <NeighborhoodPanel key={tab} runtime={runtime} tab={tab} locale={language} locked={baseLocked || (!!runtime.homeDraft || editing)} />
          </>}
        </div>
      </section></div>}
      <div className="village-footer">{runtime.controller?.lastPlacement === 'rejected' ? t.rejected : t.help}</div>
      {settings && <section className="village-settings" aria-label={text('小院设置', 'Courtyard settings')}><h2>{text('小院设置', 'Courtyard settings')}</h2>
        <label>{text('界面主题', 'Theme')}<select aria-label={text('界面主题', 'Theme')} value={runtime.preferences.theme} disabled={settingsLocked} onChange={e => void runtime.setPreferences({ theme: e.target.value as 'system' | 'light' | 'dark' })}>
          <option value="system">{text('跟随系统', 'System')}</option><option value="light">{text('浅色', 'Light')}</option><option value="dark">{text('深色', 'Dark')}</option></select></label>
        <label>{text('语言', 'Language')}<select aria-label={text('语言', 'Language')} value={runtime.preferences.language} disabled={settingsLocked} onChange={e => void runtime.setPreferences({ language: e.target.value as 'system' | 'zh' | 'en' })}>
          <option value="system">{text('跟随 DSH', 'Follow DSH')}</option><option value="zh">中文</option><option value="en">English</option></select></label>
        <label><input type="checkbox" checked={runtime.preferences.reducedMotion} disabled={settingsLocked} onChange={e => void runtime.setPreferences({ reducedMotion: e.target.checked })} /> {text('减少动态', 'Reduce motion')}</label>
        <label><input type="checkbox" checked={runtime.preferences.bubbles} disabled={settingsLocked} onChange={e => void runtime.setPreferences({ bubbles: e.target.checked })} /> {text('显示对话气泡', 'Show speech bubbles')}</label>
        <button onClick={() => { setSettings(false); settingsButton.current?.focus() }}>{text('完成', 'Done')}</button>
      </section>}
    </aside>}
  </div>
}
