import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { actors } from '../core/world.ts'
import { characterNames } from '../core/roster.ts'
import { afternoonStories, afternoonStory, type AfternoonSelection } from '../core/afternoon-catalog.ts'
import { afternoonToken, type AfternoonMemory } from '../core/afternoon-state.ts'

const selectionText: Record<AfternoonSelection, { zh: string; en: string }> = {
  leaf: { zh: '叶子', en: 'Leaf' }, wave: { zh: '波纹', en: 'Wave' }, left: { zh: '左边视角', en: 'Left viewpoint' }, right: { zh: '右边视角', en: 'Right viewpoint' },
}
export function AfternoonPanel({ runtime: r, tab, locale, locked }: { runtime: VillageRuntime; tab: string; locale: Locale; locked: boolean }) {
  const w = r.controller?.world, t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!w || tab === 'journal' || w.region.active !== 'tea-square') return null
  const s = w.afternoon, e = s.active, members = actors(w), paused = !!r.controller?.pauseReasons.size
  const busy = locked || r.arranging || r.photoMode || r.regionTransition || !!r.controller?.drag
  const otherStory = !!(w.teaSquare.active || w.teaSquare.activity || w.bookhouse.active || w.play.active || w.activeEvent || w.neighborhood.event)
  const ready = !busy && !paused && e?.phase === 'ready', story = e ? afternoonStory(e.storyId) : null
  if (tab !== 'residents' && tab !== 'wishes' && tab !== 'decor') return null
  return <section className="village-neighborhood village-afternoon" data-stage={e?.stage ?? 'idle'} data-afternoon-story={e?.storyId ?? 'none'} aria-label={t('午后小插曲', 'Afternoon stories')}>
    <h3>{t('午后小插曲', 'Afternoon stories')}</h3>
    {tab !== 'decor' && <>
      {!e ? <>
        <p>{t('两位老朋友各有一个小主意。一起走近，听一听，再亲手留下一个选择。', 'Two friends have a little idea. Walk over, listen, and make a choice together.')}</p>
        {afternoonStories.map(st => {
          const available = st.participants.every(id => members.some(a => a.id === id)), memory = s.memories.find(m => m.storyId === st.id)
          return <article key={st.id} data-afternoon-offer={st.id} aria-label={st.title[locale]}>
            <h4>{st.title[locale]}</h4><p>{st.participants.map(id => characterNames[id]).join(' · ')}</p>
            <p>{st.stages[1][locale]}</p>
            {!available && <p>{t('请先回小院邀请这两位居民，再一起到茶会广场。', 'Invite both residents in the courtyard, then visit the tea square together.')}</p>}
            {memory && <p>{t('已留下第一次的回忆。重玩只累积次数，不替换选择或重复获得纪念物。', 'Your first memory is kept. Replays add a count without replacing the choice or awarding another keepsake.')}</p>}
            <button disabled={busy || paused || otherStory || !available} onClick={() => void r.startAfternoon(st.id, [...st.participants])}>{memory ? t(`重玩：${st.title.zh}`, `Replay: ${st.title.en}`) : t(`开始：${st.title.zh}`, `Start: ${st.title.en}`)}</button>
          </article>
        })}
      </> : <article className="village-status" aria-label={t('进行中的午后小插曲', 'Current afternoon story')}>
        <h4>{story!.title[locale]} · {e.stage + 1}/3</h4>
        <p>{e.participants.map(id => characterNames[id]).join(' · ')}</p>
        <p role="status">{paused ? t('已暂停，恢复后可继续。', 'Paused. Resume to continue.') : e.phase === 'approaching' ? t('朋友们正沿小路走近，请等他们到达。', 'Friends are walking along the path. Wait for them to arrive.') : e.phase === 'observing' ? t('先停一停，让这个小发现慢慢展开。', 'Pause for a moment and let the little discovery unfold.') : t('准备好了，轮到你来选择。', 'Ready. It is your turn to choose.')}</p>
        <p>{story!.stages[e.stage][locale]}</p>
        {e.stage < 2 && story!.lines.map((line, i) => <p key={i}>{line[locale]}</p>)}
        {e.storyId === 'tea-bookmark' && e.stage === 0 && <button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'listen')}>{t('听完纸签里的话', 'Listen to the note')}</button>}
        {e.storyId === 'tea-bookmark' && e.stage === 1 && <>
          <div className="choices" role="group" aria-label={t('书签图案', 'Bookmark motif')}>{(['leaf', 'wave'] as const).map(choice => <button key={choice} disabled={!ready} aria-pressed={e.selection === choice} onClick={() => void r.actAfternoon(afternoonToken(e), 'fold', choice)}>{choice === 'leaf' ? t('折一枚叶子', 'Fold a leaf') : t('折一道波纹', 'Fold a wave')}</button>)}</div>
          <p>{e.selection ? t(`已经折好${selectionText[e.selection].zh}，轻轻压平就能带走。`, `Your ${selectionText[e.selection].en.toLowerCase()} is folded. Press it gently to finish.`) : t('先选择纸签上的图案。', 'First choose a motif for the note.')}</p>
          <button disabled={!ready || !e.selection} onClick={() => void r.actAfternoon(afternoonToken(e), 'press')}>{t('轻轻压平书签', 'Press the bookmark gently')}</button>
        </>}
        {e.storyId === 'reflection-shapes' && e.stage === 0 && <div className="choices" role="group" aria-label={t('观察视角', 'Viewpoint')}>
          <button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'observe', 'left')}>{t('从左边观察', 'Look from the left')}</button>
          <button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'observe', 'right')}>{t('从右边观察', 'Look from the right')}</button>
        </div>}
        {e.storyId === 'reflection-shapes' && e.stage === 1 && <>
          <p>{t('你选择了', 'You chose the ')}{selectionText[e.selection!][locale]}{t('。杯沿的小箭头与倒影方向相反。', '. The little arrow on the cup points opposite to its reflection.')}</p>
          <p aria-label={t('倒影图形提示', 'Reflection shape hint')}>{e.selection === 'left' ? '→ │ ←' : '← │ →'}</p>
          <div className="choices" role="group" aria-label={t('匹配倒影', 'Match the reflection')}>
            <button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'match', 'same')}>{t('试试原样重合', 'Try the original shape')}</button>
            <button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'match', 'mirror')}>{t('左右镜像重合', 'Match the mirrored shape')}</button>
          </div>
          {e.attempts > 0 && <p role="status">{t('还没有重合：倒影把左右交换了，再试一次。', 'Not a match yet: the reflection swaps left and right. Try again.')}</p>}
        </>}
        {e.stage === 2 && <><p>{t('这次留下的选择：', 'This time you chose: ')}{selectionText[e.selection!][locale]}</p><button disabled={!ready} onClick={() => void r.actAfternoon(afternoonToken(e), 'remember')}>{t('记住这段小插曲', 'Remember this little story')}</button></>}
        <button disabled={busy} onClick={() => void r.cancelAfternoon()}>{t('取消小插曲', 'Cancel little story')}</button>
        <p>{t('取消不会留下新回忆或纪念物。', 'Cancelling leaves no new memory or keepsake.')}</p>
      </article>}
    </>}
    {tab === 'decor' && afternoonStories.map(st => <article key={st.id} aria-label={st.keepsakeTitle[locale]}><h4>{st.keepsakeTitle[locale]}</h4>
      {s.memories.some(m => m.storyId === st.id) ? <><p>{t('首次完成留下的纪念物，可以挂起或收好。', 'A keepsake from your first story. Hang it up or put it away.')}</p><div className="choices">
        <button aria-pressed={s.keepsakes[st.id] === 'message-tree'} disabled={busy || paused || !!e || otherStory} onClick={() => void r.placeAfternoonKeepsake(st.id, 'message-tree')}>{t(`挂起${st.keepsakeTitle.zh}`, `Hang ${st.keepsakeTitle.en}`)}</button>
        <button aria-pressed={s.keepsakes[st.id] === null} disabled={busy || paused || !!e || otherStory} onClick={() => void r.placeAfternoonKeepsake(st.id, null)}>{t(`收起${st.keepsakeTitle.zh}`, `Put away ${st.keepsakeTitle.en}`)}</button>
      </div></> : <p>{t(`完成“${st.title.zh}”后留下。`, `Complete “${st.title.en}” to discover it.`)}</p>}
    </article>)}
  </section>
}

export function AfternoonMemoryArticles({ memories, locale }: { memories: readonly AfternoonMemory[]; locale: Locale }) {
  const t = (zh: string, en: string) => locale === 'zh' ? zh : en
  return <>{memories.map(m => <article key={m.storyId} tabIndex={-1} data-notice-id={`afternoon:${m.storyId}`} className="village-journal">
    <small>{t('第', 'Day ')}{m.day}{t('天', '')} · ×{m.count}</small><h3>{afternoonStory(m.storyId).title[locale]}</h3>
    <p>{m.participants.map(id => characterNames[id]).join(' · ')}</p><p>{t('第一次留下的选择：', 'Our first choice: ')}{selectionText[m.selection][locale]}</p>
    <p>{m.storyId === 'tea-bookmark' ? t('听完纸签里的小句子，我们一起折好并压平了书签。', 'After listening to the little note, we folded and pressed a bookmark together.') : t('从杯中找到了左右颠倒的形状，我们把发现留在倒影小卡上。', 'We found the reversed shape in the cup and kept our discovery on a reflection card.')}</p>
    <p>{t('第一次的朋友、日期与选择会一直保留。', 'The first companions, date and choice are kept.')}</p>
  </article>)}</>
}
