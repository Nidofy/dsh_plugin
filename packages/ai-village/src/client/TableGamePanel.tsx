import { useRef, useState } from 'react'
import type { VillageRuntime } from './runtime.ts'
import type { PlayEvent } from '../core/living-state.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { characterNames } from '../core/roster.ts'
import { tableResult } from '../core/table-game.ts'

/** The furniture drawer owns this explicit mode choice; picking a radio never writes the world. */
export function TableModePanel({ runtime, locale, locked }: { runtime: VillageRuntime; locale: Locale; locked: boolean }) {
  const [draft, setDraft] = useState<'dining' | 'game' | null>(null), [saving, setSaving] = useState(false)
  const world = runtime.controller?.world, t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!world) return null
  const busy = locked || saving || runtime.arranging || !!world.activeEvent || !!world.neighborhood.event || !!world.play.active
  const current = world.play.tableMode
  return <section aria-label={t('桌面棋局（开发预览）', 'Table game (development preview)')}>
    <h3>{t('桌面棋局（开发预览）', 'Table game (development preview)')}</h3>
    <p>{t('在现有餐桌上铺开三连棋盘。此开发预览复用餐桌，尚未加入新的家具原画。', 'Lay a three-in-a-row board on the existing dining table. This development preview reuses the table; new furniture artwork is not included.')}</p>
    <p>{t('棋局桌面仍能用餐。朋友吃饭、喝茶或进行餐桌故事时，会自动暂收棋盘；活动结束后再铺开。', 'The game table still serves meals. The board is put away during meals, tea, or stories at the table, and returns when the table is free.')}</p>
    <p role="status">{t('当前用途：', 'Current use: ')}{current === 'game' ? t('棋局', 'Game table') : t('用餐', 'Dining table')}</p>
    <fieldset disabled={busy}><legend>{t('选择餐桌用途', 'Choose how to use the table')}</legend><div className="choices">
      <button aria-pressed={(draft ?? current) === 'dining'} onClick={() => setDraft('dining')}>{t('用餐桌面', 'Dining surface')}</button>
      <button aria-pressed={(draft ?? current) === 'game'} onClick={() => setDraft('game')}>{t('棋局桌面', 'Game surface')}</button>
    </div></fieldset>
    {draft !== null && <div className="choices"><button disabled={busy || draft === current} onClick={() => { setSaving(true); void runtime.setTableMode(draft).then(() => { if (!runtime.actionError) setDraft(null) }).finally(() => setSaving(false)) }}>{t('确认桌面用途', 'Confirm table use')}</button><button disabled={saving} onClick={() => setDraft(null)}>{t('取消更改', 'Cancel change')}</button></div>}
    {!!(world.activeEvent || world.neighborhood.event || world.play.active) && <p>{t('先结束或取消当前活动，再更换桌面用途。', 'Finish or cancel the current activity before changing the table.')}</p>}
  </section>
}

export function TableGamePanel({ active, locale, ready, onMove }: { active: Pick<PlayEvent, 'board' | 'choices' | 'participants' | 'stage'>; locale: Locale; ready: boolean; onMove(cell: number): void }) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]), t = (zh: string, en: string) => locale === 'zh' ? zh : en
  const result = tableResult(active.board), resident = characterNames[active.participants[1] ?? active.participants[0]!]
  const playerTurn = active.choices.length % 2 === 0, canMove = ready && active.stage === 0 && !result && playerTurn
  const resultText = result === 'player' ? t(`${resident}：你先连成了三颗！这一步下得真好。`, `${resident}: Three in a row! That was a lovely move.`)
    : result === 'resident' ? t(`${resident}：这次让我先连成了。谢谢你陪我下一局。`, `${resident}: I made a row this time. Thank you for playing with me.`)
    : result === 'draw' ? t(`${resident}：每一格都刚刚好，平局也很有趣。`, `${resident}: Every square found a piece. A draw can be fun, too.`) : ''
  const label = (cell: number, value: number) => `${t('第', 'Row ')}${Math.floor(cell / 3) + 1}${t('行，第', ', column ')}${cell % 3 + 1}${t('列', '')} · ${value === 0 ? t('你，圆圈', 'you, circle') : value === 1 ? `${resident}${t('，叉号', ', cross')}` : t('空格', 'empty')}`
  return <section aria-label={t('三连棋盘', 'Three-in-a-row board')}>
    <p>{t('你执 ○，朋友执 ×。横、竖或斜着连成三颗就完成一局。', 'You play ○ and your friend plays ×. Make a row of three horizontally, vertically, or diagonally.')}</p>
    <p role="status" aria-live="polite">{result ? resultText : !ready ? t('等朋友就位后再落子。', 'Wait for everyone to settle before playing.') : playerTurn ? t(`轮到你了 · 已落 ${active.choices.length} 子`, `Your turn · ${active.choices.length} pieces played`) : t(`${resident}正在想下一步……`, `${resident} is thinking about the next move…`)}</p>
    <div role="group" aria-label={t('九个棋格', 'Nine board squares')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(44px, 1fr))', gap: 6, maxWidth: 270 }}>
      {active.board.map((value, cell) => <button key={cell} ref={node => { cells.current[cell] = node }} style={{ minHeight: 48, fontSize: '1.4em' }} aria-label={label(cell, value)} disabled={!canMove || value !== -1} onClick={() => onMove(cell)} onKeyDown={e => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 3 : e.key === 'ArrowUp' ? -3 : 0
        if (!direction) return
        e.preventDefault()
        for (let next = cell + direction; next >= 0 && next < 9; next += direction) {
          const button = cells.current[next]
          if (button && !button.disabled) { button.focus(); break }
        }
      }}>{value === 0 ? '○' : value === 1 ? '×' : '·'}</button>)}
    </div>
    <small>{t('可以用 Tab 或方向键选空格，用 Enter 或空格键落子。没有积分，也不会因为输棋失去东西。', 'Use Tab or arrow keys to choose an empty square, then Enter or Space to play. There are no scores or losses to worry about.')}</small>
  </section>
}
