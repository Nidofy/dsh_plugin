import type { VillageRuntime } from './runtime.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { collectionFacts } from '../core/collection-catalog.ts'

export function CollectionPanel({ runtime, locale, tab }: { runtime: VillageRuntime; locale: Locale; tab: 'journal' | 'wishes' }) {
  const world = runtime.controller?.world, t = (zh: string, en: string) => locale === 'zh' ? zh : en
  if (!world) return null
  const facts = collectionFacts(world, runtime.album?.loaded ? runtime.album.state?.world ?? { schemaVersion: 1, photos: [] } : null)
  return <section className="village-neighborhood" aria-label={tab === 'journal' ? t('收藏分类', 'Collection categories') : t('慢慢积累的目标', 'Goals to enjoy over time')}>
    <h3>{tab === 'journal' ? t('收藏分类', 'Collection categories') : t('慢慢积累的目标', 'Goals to enjoy over time')}</h3>
    {tab === 'wishes' ? <><p>{t('这些目标都可以慢慢来，也可以不做。没有截止时间，不影响朋友的生活。', 'Take your time with these optional goals, or leave them aside. There are no deadlines and your friends carry on either way.')}</p>{facts.goals.map(g => <article className="village-journal" key={g.id}><strong>{g.count !== null && g.count >= g.target ? '✓ ' : '○ '}{g.title[locale]}</strong><p>{g.count === null ? t('相册尚未读取', 'Album not loaded yet') : `${Math.min(g.count, g.target)}/${g.target}`}</p><small>{g.source[locale]}</small></article>)}</>
      : facts.categories.map(c => <details className="village-journal" key={c.id}><summary>{c.title[locale]} · {c.known ? `${c.items.length}${c.total === null ? '' : `/${c.total}`}` : t('尚未读取', 'Not loaded')}</summary><p>{c.source[locale]}</p>{c.known ? c.items.length ? <ul>{c.items.map(item => <li key={item.id}>{item.label[locale]}</li>)}</ul> : <p>{t('这里还没有已保存的收藏。', 'No saved discoveries here yet.')}</p> : <p>{t('打开手账中的相册，读取照片后会显示数量。', 'Open the album in Journal to load the photo count.')}</p>}</details>)}
    {(runtime.album?.pending || runtime.album?.error) && <p>{t('相册正在核对或暂时不可读取；这里只展示上次已读取的记录。', 'The album is being checked or is unavailable. Only its last loaded records are shown here.')}</p>}
  </section>
}
