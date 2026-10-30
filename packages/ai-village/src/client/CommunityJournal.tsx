import type { VillageRuntime } from './runtime.ts'
import { useId, useState } from 'react'
import type { Locale, Words } from '../core/neighborhood-catalog.ts'
import { words } from '../core/neighborhood-catalog.ts'
import { afternoonStories } from '../core/afternoon-catalog.ts'
import { playDefinitions } from '../core/play-catalog.ts'
import { communityPlaces } from '../core/community-map.ts'
import { characterNames, type CharacterId } from '../core/roster.ts'
import { villageTime } from '../core/dialogue.ts'
import { noticeTitle } from '../core/notifications.ts'
import { AfternoonMemoryArticles } from './AfternoonPanel.tsx'
import { BookhouseMemoryArticle } from './BookhouseStoryPanel.tsx'
import { TeaSquareMemoryArticle } from './TeaSquarePanel.tsx'
import { RelationshipPanel } from './relationship-panel.tsx'
import { CollectionPanel } from './CollectionPanel.tsx'
import { CommunityPanel } from './CommunityPanel.tsx'
import { PhotoPanel } from './PhotoPanel.tsx'
import type { PresentationState } from './ui-state.ts'

type JournalPage = PresentationState['subpages']['journal']
const pages: readonly { id: JournalPage; label: Words }[] = [
  { id: 'memories', label: words('故事', 'Stories') },
  { id: 'relationships', label: words('居民关系', 'Relationships') },
  { id: 'collection', label: words('纪念收藏', 'Keepsakes') },
  { id: 'album', label: words('相册', 'Album') },
]
/** A projection of the existing owner, memories and album. Navigation never creates a world fact. */
export function CommunityJournal({ runtime: r, locale, busy }: { runtime: VillageRuntime; locale: Locale; busy: boolean }) {
  const w = r.controller?.world, p = r.presentation, page = p.subpages.journal
  const [regionFilter, setRegionFilter] = useState<string>(w?.region.active ?? 'all')
  const regionFilterId = useId()
  const t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!w) return null
  const regionName = (id: string) => communityPlaces.find(place => place.id === id)?.name[locale] ?? id
  const select = (next: JournalPage) => {
    if (next !== page) r.present({ type: 'push', patch: { page: next, drawer: 'full', subpages: { ...p.subpages, journal: next } } })
  }
  const occupied = !!(w.afternoon.active || w.bookhouse.active || w.teaSquare.active || w.teaSquare.activity || w.play.active || w.activeEvent || w.neighborhood.event)
  const placementLocked = busy || occupied || r.arranging || r.photoMode || r.regionTransition || !!r.controller?.drag || !!r.controller?.pauseReasons.size || !r.frameReady
  const storyRows = [
    ...afternoonStories.map(story => {
      const saved = w.afternoon.memories.find(m => m.storyId === story.id)
      return { id: story.id, title: story.title, region: story.region, active: w.afternoon.active?.storyId === story.id, saved, detail: story.stages[w.afternoon.active?.storyId === story.id ? w.afternoon.active.stage : 0]!, participants: story.participants }
    }),
    ...playDefinitions.filter(story => story.kind === 'story').map(story => ({
      id: story.id, title: story.name, region: 'courtyard', active: w.play.active?.definitionId === story.id,
      saved: w.neighborhood.memories.find(m => m.id === story.id), detail: story.summary, participants: story.requiredParticipants ?? [],
    })),
    { id: 'bookhouse-light', title: words('夹在书里的微光', 'A little light between the pages'), region: 'bookhouse', active: w.bookhouse.active?.kind === 'reading', saved: w.bookhouse.memory, detail: words('在书架、阅读桌和窗边留下共同阅读的句子。', 'Share a reading at the bookcase, desk and window.'), participants: [] },
    { id: 'bookhouse-puzzle', title: words('书架里的谜题', 'A puzzle on the shelf'), region: 'bookhouse', active: w.bookhouse.active?.kind === 'puzzle', saved: w.bookhouse.puzzleMemory, detail: words('整理种子、发芽和开花的书页。', 'Arrange the seed, sprout and flower pages.'), participants: [] },
    { id: 'tea-square-three-cups', title: words('三杯不同的下午', 'Three cups, one afternoon'), region: 'tea-square', active: !!w.teaSquare.active, saved: w.teaSquare.memory, detail: words('和三位居民一起把杯垫排好。', 'Arrange the coasters with three residents.'), participants: [] },
  ]
  const status = (active: boolean, saved: unknown) => active ? t('进行中', 'In progress') : saved ? t('已完成', 'Completed') : t('可发现', 'To discover')
  return <section className="village-community-journal" aria-label={t('社区手账', 'Community journal')} data-journal-page={page}>
    <nav className="choices" aria-label={t('手账分类', 'Journal sections')}>
      {pages.map(item => <button key={item.id} aria-pressed={page === item.id} onClick={() => select(item.id)}>{item.label[locale]}</button>)}
    </nav>
    {page === 'memories' && <>
      <details className="village-journal" open><summary>{t('社区故事目录', 'Community story directory')}</summary>
        <p>{t('可发现的故事只是线索；只有完成并保存后才会留下回忆。', 'Stories to discover are only leads. A memory appears after completion and saving.')}</p>
        <label htmlFor={regionFilterId}>{t('故事地点', 'Story location')}</label><select id={regionFilterId} value={regionFilter} onChange={event => setRegionFilter(event.target.value)}><option value="all">{t('全部区域', 'All regions')}</option>{communityPlaces.filter(place => place.status === 'available').map(place => <option key={place.id} value={place.id}>{place.name[locale]}</option>)}</select>
        {storyRows.filter(story => regionFilter === 'all' || story.region === regionFilter).map(story => <details key={story.id} open={story.active} data-journal-story={story.id} data-story-status={story.active ? 'active' : story.saved ? 'completed' : 'discoverable'} data-story-region={story.region} data-source-event-id={story.saved?.eventId}>
          <summary style={{ minHeight: 40 }}>{story.title[locale]} · {status(story.active, story.saved)}</summary>
          <p>{regionName(story.region)}{story.participants.length ? ' · ' + story.participants.map(id => characterNames[id]).join(' · ') : ''}</p>
          <p>{story.detail[locale]}</p>
          {story.saved && <small>{t('首次保存的参与者：', 'First saved participants: ')}{story.saved.participants.map(id => characterNames[id]).join(' · ')} · {t('世界时刻 ', 'World tick ')}{story.saved.completedTick}</small>}
        </details>)}
      </details>
      <h3>{t('已保存的回忆', 'Saved memories')}</h3>
      <AfternoonMemoryArticles memories={w.afternoon.memories} locale={locale}/>
      {r.notices.filter(n => !n.id.startsWith('afternoon:')).map(n => n.story === 'tea-square-three-cups' && w.teaSquare.memory
        ? <TeaSquareMemoryArticle key={n.id} memory={w.teaSquare.memory} locale={locale} noticeId={n.id}/>
        : n.story === 'bookhouse-light' && w.bookhouse.memory
          ? <BookhouseMemoryArticle key={n.id} memory={w.bookhouse.memory} locale={locale} noticeId={n.id}/>
          : <article tabIndex={-1} data-notice-id={n.id} className="village-journal" key={n.id}>
            <small>{t('第', 'Day ')}{villageTime(n.tick).day}{t('天', '')} · ×{n.count}</small>
            <h3>{noticeTitle(n.story, locale)}</h3><p>{n.participants.map(id => characterNames[id as CharacterId]).join(' · ')}</p>
          </article>)}
      {!r.notices.length && !w.afternoon.memories.length && <p>{t('回忆会在第一次完成活动并保存后留下。', 'First completed activities become memories after saving.')}</p>}
    </>}
    {page === 'relationships' && <RelationshipPanel world={w} locale={locale} pageSize={4}/>}
    {page === 'collection' && <>
      <h3>{t('故事纪念物', 'Story keepsakes')}</h3>
      {!w.afternoon.memories.some(m => afternoonStories.find(story => story.id === m.storyId)?.placement) && <p>{t('完成故事后，纪念物会留在这里。', 'Story keepsakes will appear here after completion.')}</p>}
      {w.afternoon.memories.map(memory => {
        const story = afternoonStories.find(item => item.id === memory.storyId)!
        if (!story.placement) return null
        const place = w.afternoon.keepsakes[story.id], local = w.region.active === story.region
        return <article className="village-journal" key={story.id} data-journal-keepsake={story.id} data-source-event-id={memory.eventId} data-source-participants={memory.participants.join(',')} data-placed-region={place ? story.region : 'stored'}>
          <h4>{story.keepsakeTitle[locale]}</h4>
          <p>{t('来自：', 'From: ')}{story.title[locale]} · {regionName(story.region)}</p>
          <p>{memory.participants.map(id => characterNames[id]).join(' · ')} · {t('世界时刻 ', 'World tick ')}{memory.completedTick}</p>
          <p>{place ? t('正在场景中展示', 'Displayed in the scene') : t('已收起，仍已解锁', 'Put away; still unlocked')}</p>
          <div className="choices">
            <button disabled={placementLocked || !local || !!place} onClick={() => void r.placeAfternoonKeepsake(story.id, story.placement)}>{t('摆放', 'Display')}</button>
            <button disabled={placementLocked || !local || !place} onClick={() => void r.placeAfternoonKeepsake(story.id, null)}>{t('收起', 'Put away')}</button>
          </div>
          {!local && <small>{t('请前往故事所在区域布置这件纪念物。', 'Visit the story’s region to arrange this keepsake.')}</small>}
        </article>
      })}
      <CommunityPanel runtime={r} locale={locale}/>
      <CollectionPanel runtime={r} tab="journal" locale={locale}/>
    </>}
    {page === 'album' && <>
      <button disabled={busy || !r.frameReady} onClick={() => { r.present({ type: 'close' }); void r.enterPhoto() }}>{t('拍一张', 'Take a photo')}</button>
      <PhotoPanel runtime={r} locale={locale} albumOnly/>
    </>}
  </section>
}
