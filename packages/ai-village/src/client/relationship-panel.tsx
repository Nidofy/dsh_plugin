import { useId, useState } from 'react'
import type { LivingWorld } from '../core/living-state.ts'
import { characterIds, characterNames, type CharacterId } from '../core/roster.ts'
import type { Locale } from '../core/neighborhood-catalog.ts'
import { relationshipFacts } from '../core/relationship-catalog.ts'

export function RelationshipPanel({ world, locale }: { world: LivingWorld; locale: Locale }) {
  const [resident, setResident] = useState<CharacterId>(world.actor.id)
  const selectorId = useId(), titleId = useId(), t = (zh: string, en: string) => locale === 'zh' ? zh : en
  const facts = relationshipFacts(world), pairs = facts.pairs.filter(pair => pair.pair.includes(resident))
  return <section className="village-neighborhood village-relationships" aria-labelledby={titleId}>
    <h3 id={titleId}>{t('共同回忆册', 'Shared memory book')}</h3>
    <p>{t('只记下已经保存的共同经历。不必收集所有组合，也没有截止时间。', 'Only saved shared experiences belong here. There is no need to collect every pair, and no deadline.')}</p>
    <details className="village-journal"><summary>{t('邻里称号', 'Neighborhood titles')} · {facts.discoveredCount} {t('对已留下回忆', 'pairs with memories')}</summary>
      <p>{t('称号随真实回忆点亮，不用领取，也不影响居民生活。', 'Titles light up with real memories. No claim is needed, and your friends carry on either way.')}</p>
      <ul>{facts.milestones.map(milestone => <li key={milestone.target}>{milestone.unlocked ? t('已点亮', 'Unlocked') : t('未点亮', 'Not yet unlocked')} · {milestone.title[locale]} · {Math.min(facts.discoveredCount, milestone.target)}/{milestone.target}</li>)}</ul>
    </details>
    <label htmlFor={selectorId}>{t('查看居民的共同回忆', 'View a resident’s shared memories')}</label>
    <select id={selectorId} value={resident} onChange={event => setResident(event.target.value as CharacterId)}>{characterIds.map(id => <option key={id} value={id}>{characterNames[id]}</option>)}</select>
    <p role="status">{characterNames[resident]} · {pairs.filter(pair => pair.discovered).length} {t('对已有记录', 'pairs with saved records')}</p>
    {pairs.map(pair => {
      const other = pair.pair.find(id => id !== resident)!
      return <details className="village-journal" key={`${resident}/${other}`} data-relationship={pair.id}>
        <summary style={{ minHeight: 40 }}>{characterNames[other]} · {pair.discovered ? t('已发现', 'Discovered') : t('尚未留下记录', 'No saved record yet')}</summary>
        {!pair.discovered ? <p>{t('以后可以邀请他们一起参加活动；仅仅在场不会留下共同回忆。', 'You can invite them to an activity sometime. Being present alone does not create a shared memory.')}</p> : <>
          {pair.sharedCount !== null && <p>{t(`已记录 ${pair.sharedCount} 次共同活动；最近一次世界时刻 ${pair.lastTick}。`, `${pair.sharedCount} recorded shared activities; latest world tick ${pair.lastTick}.`)}</p>}
          {pair.sources.length === 0 && <p>{t('来源：已保存的邻里关系记录。它保留次数与最近时刻，未保留这对居民的具体活动详情。', 'Source: saved neighborhood bond. It retains a count and latest time, but no specific activity details for this pair.')}</p>}
          {pair.sources.map(source => <article key={`${source.id}/${source.eventId}`}>
            <h4>{source.title[locale]}</h4><small>{source.source[locale]}</small>
            <p>{t('首次保存的参与者', 'First saved participants')}：{source.participants.map(id => characterNames[id]).join(' · ')}</p>
            <p>{t('首次完成的世界时刻', 'First completion world tick')}：{source.completedTick}</p><p>{source.detail[locale]}</p>
            <p>{source.keepsake ? `${t('对应纪念物', 'Related keepsake')}：${source.keepsake.name[locale]} · ${source.keepsake.location[locale]}` : t('这份回忆没有对应纪念物。', 'This memory has no related keepsake.')}</p>
          </article>)}
        </>}
      </details>
    })}
  </section>
}
