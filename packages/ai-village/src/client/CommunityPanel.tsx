import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { characterNames } from '../core/roster.ts'
import { communityCollection } from '../core/community-life.ts'

/** Read-only view of the controller's saved world. Invitations and presence never become entries. */
export function CommunityPanel({ runtime, locale }: { runtime: VillageRuntime; locale: Locale }) {
  const world = runtime.controller?.world, t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!world) return null
  const collection = communityCollection(world), region = world.region.active
  const local = collection.sources.filter(source => source.region === region || source.placedRegion === region)
  const remembered = collection.sources.filter(source => source.region !== region)
  const cast = (ids: readonly (keyof typeof characterNames)[]) => ids.map(id => characterNames[id]).join(' · ')
  return <section className="village-neighborhood" aria-label={t('朋友和三处风景', 'Friends and three places')} data-community-panel={region}>
    <h3>{t('朋友和三处风景', 'Friends and three places')}</h3>
    <p>{t('朋友会在散步时想起一起经历过的事。问候、停留和邀请本身不会完成心愿或增加收藏。', 'Friends may recall a shared experience during their day. Greetings, pauses and invitations do not complete wishes or add collectibles.')}</p>
    <article className="village-journal" data-community-collection="three-region-memory-card" data-unlocked={collection.threeRegions.unlocked}>
      <strong>{collection.threeRegions.unlocked ? '✓ ' : '○ '}{collection.threeRegions.title[locale]}</strong>
      <p>{collection.visitedRegions.length}/3 · {collection.threeRegions.detail[locale]}</p>
      {collection.threeRegions.unlocked && <small>{t('三地纪念卡正在庭院墙边展示。', 'The three-place memory card is displayed on the courtyard wall.')}</small>}
    </article>
    <h4>{t('这里保存的经历与纪念', 'Experiences and keepsakes here')}</h4>
    {!local.length && <p>{t('这里还没有保存的经历。慢慢来。', 'No saved experiences here yet. Take your time.')}</p>}
    {local.map(source => <article className="village-journal" key={source.id} data-community-source={source.id} data-source-event-id={source.eventId} data-source-participants={source.participants.join(',')}>
      <strong>{source.title[locale]}</strong><p>{cast(source.participants)}</p><small>{source.source[locale]} · {source.detail[locale]}</small>
      {source.keepsake && <p data-community-keepsake={source.keepsake.id} data-placed-region={source.placedRegion ?? 'stored'}>{source.keepsake.name[locale]} · {source.keepsake.location[locale]}</p>}
    </article>)}
    {!!remembered.length && <details className="village-journal"><summary>{t('带到这里的共同回忆', 'Shared memories brought here')}</summary>
      {remembered.map(source => <article key={source.id} data-community-recall={source.id} data-source-event-id={source.eventId} data-source-participants={source.participants.join(',')}>
        <strong>{source.title[locale]}</strong><p>{cast(source.participants)}</p><small>{source.source[locale]}</small>
      </article>)}
    </details>}
  </section>
}
