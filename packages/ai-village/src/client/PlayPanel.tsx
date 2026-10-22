import { useState, useRef, useEffect } from 'react'
import type { VillageRuntime } from './runtime.ts'
import type { BellSlot } from '../core/content-state.ts'
import { actors } from '../core/world.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { type Locale } from '../core/neighborhood-catalog.ts'
import { villageTime } from '../core/dialogue.ts'
import { playDefinitions, playDefinition, playDecorationNames, deskItems, deskSlots, snackChoices, snackNames, snackReaction, whalePlaces, whalePlaceNames, whalePlace, type PlayDecorationId, type PlayDefinition } from '../core/play-catalog.ts'
import { residentLife, lifeClock } from '../core/life-catalog.ts'
import { TableGamePanel } from './TableGamePanel.tsx'

/** Content lives inside the existing four drawers; it never creates another top-level entrance. */
export function PlayPanel({ runtime, tab, locale, locked }: { runtime: VillageRuntime; tab: string; locale: Locale; locked: boolean }) {
  const world = runtime.controller?.world, cn = locale === 'zh', t = (zh: string, en: string) => cn ? zh : en
  const [guests, setGuests] = useState<CharacterId[]>([])
  const [item, setItem] = useState<number | null>(null)
  const [decor, setDecor] = useState<{ id: PlayDecorationId; slot: BellSlot | null } | null>(null)
  const storyHeading=useRef<HTMLHeadingElement>(null),stageKey=world?.play.active?`${world.play.active.id}:${world.play.active.stage}`:''
  useEffect(()=>{ if(stageKey)storyHeading.current?.scrollIntoView?.({block:'start'}) },[stageKey])
  if (!world?.play) return null
  const active = world.play.active, definition = active && playDefinition(active.definitionId), stage = definition?.stages[active?.stage ?? 0]
  const members = actors(world), ids = members.map(a => a.id), selected = world.actor.id
  const busy = locked || runtime.arranging || !!world.activeEvent || !!world.neighborhood.event || !!active
  const ready = !!active && active.phase === 'ready' && !locked && !runtime.arranging && !runtime.controller?.pauseReasons.size
  const clock = lifeClock(world.ticks)
  const token = active ? `${active.id}:${active.stage}${active.definitionId === 'table-game' ? `:${active.choices.length}` : ''}` : ''
  const act = (action: string, value?: string) => { if (ready) void runtime.playAction(action, value, token) }
  const participants = (d: PlayDefinition): CharacterId[] => {
    const lead = d.id === 'lost-rice' ? 'bluewhale' : selected
    return [lead, ...guests.filter(id => ids.includes(id) && id !== lead), ...ids.filter(id => id !== lead && !guests.includes(id))].slice(0, d.count)
  }
  const names = (list: readonly CharacterId[]) => list.map(id => characterNames[id]).join(' & ')
  const place = (index: number, slot: number) => { act('place', `${index}:${slot}`); setItem(null) }
  return <section className="village-neighborhood village-play" aria-label={t('小院故事与小游戏', 'Courtyard stories and games')}>
    {tab === 'residents' && <><p>{residentLife[selected].description[locale]}</p><small>{t('小院时间：', 'Courtyard time: ')}{clock.period === 'day' ? t('白天', 'Daytime') : clock.period === 'dusk' ? t('傍晚', 'Dusk') : t('夜晚', 'Night')} · {t('喜欢的茶点：', 'Favorite snack: ')}{snackNames[residentLife[selected].favoriteSnack][locale]}</small></>}
    {tab === 'wishes' && !active && <>
      <h3>{t('今天想一起做什么', 'What shall we do together?')}</h3>
      <p>{t('没有期限，也不用每天完成。重玩保留第一次的回忆，只增加体验次数。', 'No deadlines or daily chores. Replaying keeps your first memory and adds to its count.')}</p>
      <div aria-label={t('慢慢完成的小心愿', 'Little wishes to take slowly')}><h3>{t('慢慢完成的小心愿', 'Little wishes to take slowly')}</h3>{(['story', 'game', 'group'] as const).map(kind => {
        const content = playDefinitions.filter(d => d.kind === kind && d.id !== 'table-game'), completed = content.filter(d => world.neighborhood.memories.some(m => m.id === d.id)).length
        return <p key={kind}>{completed === content.length ? '✓ ' : '○ '}{kind === 'story' ? t('收集三个小故事', 'Discover three little stories') : kind === 'game' ? t('试过三种小游戏', 'Try all three little games') : t('和两位朋友一起看星星', 'Watch the stars with two friends')} · {completed}/{content.length}</p>
      })}</div>
      <fieldset disabled={busy}><legend>{t('优先邀请的朋友（最多两位）', 'Preferred friends (up to two)')}</legend><div className="choices">{ids.filter(id => id !== selected).map(id => <button key={id} aria-pressed={guests.includes(id)} onClick={() => setGuests(old => old.includes(id) ? old.filter(g => g !== id) : [...old.slice(-1), id])}>{characterNames[id]}</button>)}</div></fieldset>
      {(['story', 'game', 'group', 'preview'] as const).map(kind => <div key={kind}><h3>{kind === 'story' ? t('慢慢发生的小故事', 'Stories to take slowly') : kind === 'game' ? t('动手玩一会儿', 'A little time to play') : kind === 'group' ? t('三个人的相聚', 'A gathering of three') : t('一起试试：开发预览', 'Try together: development preview')}</h3>{playDefinitions.filter(d => kind === 'preview' ? d.id === 'table-game' : d.kind === kind && d.id !== 'table-game').map(d => {
        const chosen = participants(d), available = chosen.length === d.count && chosen.every(id => ids.includes(id))
        return <article className="village-journal" key={d.id}><strong>{d.name[locale]}</strong><p>{d.summary[locale]}</p><small>{names(chosen)} · {t(`${d.stages.length} 个片段`, `${d.stages.length} moments`)}</small>
          <div className="choices"><button disabled={busy || !available || world.ticks < world.play.nextTick || d.id === 'table-game' && world.play.tableMode !== 'game'} onClick={() => void runtime.startPlay(d.id, chosen)}>{world.neighborhood.memories.some(m => m.id === d.id) ? t('再体验一次', 'Play again') : t('开始', 'Begin')} · {d.name[locale]}</button></div>
          {d.id === 'table-game' && world.play.tableMode !== 'game' && <p>{t('先到“布置 → 家具”，选择棋局桌面并确认，就能邀请朋友下棋。', 'First open Decor → Furniture, choose Game surface, and confirm. Then invite a friend to play.')}</p>}
          {!available && <p>{d.id === 'lost-rice' ? t('请先让蓝鲸和另一位朋友来到小院。', 'Bring Bluewhale and a friend into the courtyard first.') : t(`需要 ${d.count} 位在场居民。`, `Needs ${d.count} residents in the courtyard.`)}</p>}
        </article>
      })}</div>)}
    </>}
    {(tab === 'wishes' || tab === 'residents') && active && definition && stage && <article className="village-status" aria-label={t('正在进行的故事', 'Current story')}>
      <h3 ref={storyHeading}>{definition.name[locale]} · {active.stage + 1}/{definition.stages.length}</h3>
      {!!runtime.controller?.pauseReasons.size && <p role="status">{t('小院已暂停，恢复后可继续；也可以取消活动。', 'The courtyard is paused. Resume to continue, or cancel the activity.')}</p>}
      <p>{names(active.participants)}</p><p role="status">{active.phase === 'approaching' ? t('朋友正在走向观察点。到齐后会先停留一会儿。', 'Friends are walking to the observation spot. They will pause together before continuing.') : active.phase === 'observing' ? t('先一起看看眼前的小细节……', 'Take a moment to notice the little details…') : t('准备好了，可以继续这个片段。', 'Ready to continue this moment.')}</p>
      <p>{stage.text[locale]}</p>
      {active.definitionId === 'table-game' && <TableGamePanel active={active} locale={locale} ready={ready} onMove={cell => act('move', String(cell))} />}
      {stage.action === 'move' ? null : stage.action === 'find' ? <>
        <p>{t('可以收起抽屉，在场景里点选小鲸鱼；下面的按钮也可用键盘操作。', 'Close the drawer to click the whale in the scene, or use the keyboard-accessible buttons below.')}</p>
        <div className="choices">{whalePlaces.map(value => <button key={value} disabled={!ready} onClick={() => act('find', value)}>{t('找找', 'Search')} · {whalePlaceNames[value][locale]}</button>)}<button disabled={!ready || active.choices.filter(c => c === 'hint').length >= 2} onClick={() => act('hint')}>{t('提示（最多两次）', 'Hint (up to two)')}</button></div>
        {active.choices.includes('hint') && <p role="status">{active.choices.filter(c => c === 'hint').length >= 2 ? whalePlaceNames[whalePlace(active)][locale] : t('看看家具下方的小小蓝色记号。', 'Look for a little blue token near the base of the furniture.')}</p>}
      </> : stage.action === 'place' ? <>
        <div className="choices" role="group" aria-label={t('待整理物品', 'Items to tidy')}>{deskItems.map((label, index) => <button key={index} disabled={!ready} draggable={ready} aria-pressed={item === index} onClick={() => setItem(index)} onDragStart={e => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; setItem(index) }}>{label[locale]}{active.board.includes(index) ? t('（已放置）', ' (placed)') : ''}</button>)}</div>
        <div className="choices" role="group" aria-label={t('物品位置', 'Places for items')}>{deskSlots.map((label, slot) => <button key={slot} disabled={!ready} aria-label={`${label[locale]} · ${active.board[slot] === -1 || active.board[slot] === undefined ? t('空', 'empty') : deskItems[active.board[slot]!]![locale]}`} onDragOver={e => { if (ready) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }} onDrop={e => { e.preventDefault(); const value = e.dataTransfer.getData('text/plain'); if (ready && /^[0-2]$/.test(value)) place(Number(value), slot) }} onClick={() => { if (item !== null) place(item, slot) }}>{label[locale]} · {active.board[slot] === -1 || active.board[slot] === undefined ? t('空', 'empty') : deskItems[active.board[slot]!]![locale]}</button>)}</div>
        <p role="status">{item === null ? t('先选择一件物品，再选择它的位置。', 'Select an item, then select its place.') : t(`已选择${deskItems[item]!.zh}，请选位置。`, `${deskItems[item]!.en} selected. Choose a place.`)}</p><button disabled={!ready} onClick={() => { act('reset'); setItem(null) }}>{t('重新整理', 'Reset desk')}</button>
      </> : stage.action === 'choose' ? <>
        <div className="choices">{snackChoices.map(value => <button key={value} disabled={!ready} onClick={() => act('choose', value)}>{snackNames[value][locale]}</button>)}</div>
        <p>{t('已分享', 'Served')} {active.choices.filter(c => snackChoices.includes(c as typeof snackChoices[number])).length}/3</p>
        <div aria-live="polite">{active.choices.filter((c): c is typeof snackChoices[number] => snackChoices.includes(c as typeof snackChoices[number])).map((choice, i) => <div key={i}><p>{i + 1}. {snackNames[choice][locale]}</p>{active.participants.map(id => <p key={id}>{characterNames[id]}：{snackReaction(id, choice, locale)}</p>)}</div>)}</div>
      </> : <button disabled={!ready} onClick={() => act(stage.action)}>{stage.actionLabel[locale]}</button>}
      <div className="choices"><button disabled={locked} onClick={() => void runtime.cancelPlay()}>{t('取消这次活动', 'Cancel this activity')}</button></div>
      <small>{t('取消不会扣除任何东西；已经留下的回忆会保留。', 'Canceling costs nothing. Existing memories stay with you.')}</small>
    </article>}
    {tab === 'decor' && <>
      <h3>{t('故事里的小纪念', 'Little keepsakes from stories')}</h3><p>{t('完成一段故事或小游戏，发现一件小纪念。选个喜欢的位置，让回忆留在小院里。', 'Finish a story or game to discover a keepsake. Choose a favorite spot and give the memory a home.')}</p>
      {playDefinitions.map(d => <div key={d.id}><strong>{playDecorationNames[d.reward][locale]}</strong>{world.neighborhood.memories.some(m => m.id === d.id) ? <button disabled={busy} onClick={() => setDecor({ id: d.reward, slot: world.play.decorations[d.reward] })}>{t('选择位置', 'Choose a place')}</button> : <p>{t('完成后发现：', 'Discovered after: ')}{d.name[locale]}</p>}</div>)}
      {decor && <fieldset disabled={busy}><legend>{playDecorationNames[decor.id][locale]}</legend><div className="choices">{(['window', 'door', 'wall', null] as const).map(slot => <button key={slot ?? 'away'} aria-pressed={decor.slot === slot} onClick={() => setDecor({ ...decor, slot })}>{slot === null ? t('收起', 'Put away') : slot === 'window' ? t('窗边', 'Window') : slot === 'door' ? t('门旁', 'Door') : t('院墙', 'Wall')}</button>)}</div><button onClick={() => void runtime.placePlayDecoration(decor.id, decor.slot).then(() => { if (!runtime.actionError) setDecor(null) })}>{t('确认保存位置', 'Save this place')}</button><button onClick={() => setDecor(null)}>{t('取消', 'Cancel')}</button></fieldset>}
    </>}
    {tab === 'journal' && world.neighborhood.memories.filter(m => playDefinition(m.id)).slice().reverse().map(m => <article key={m.id} className="village-journal"><small>{t('小院第 ', 'Day ')}{villageTime(m.completedTick).day}{cn ? ' 天' : ''} · ×{m.count}</small><h3>{playDefinition(m.id)!.name[locale]}</h3><p>{names(m.participants)}</p><p>{t('保留第一次完成时的朋友和日期。', 'Keeping the friends and date from the first completion.')}</p></article>)}
  </section>
}
