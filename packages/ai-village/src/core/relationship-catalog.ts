import type { LivingWorld } from './living-state.ts'
import { characterIds, type CharacterId } from './roster.ts'
import { stories, words, type Words } from './neighborhood-catalog.ts'
import { playDefinitions, playDecorationNames } from './play-catalog.ts'

export interface RelationshipKeepsake { id: string; name: Words; location: Words }
export interface RelationshipSource {
  id: string; eventId: string; title: Words; source: Words; participants: readonly CharacterId[]
  completedTick: number; detail: Words; keepsake: RelationshipKeepsake | null
}
export interface Relationship {
  id: string; pair: readonly [CharacterId, CharacterId]; discovered: boolean
  /** The bond is the only per-pair counter. A memory's replay counter spans different casts. */
  sharedCount: number | null; lastTick: number | null; sources: RelationshipSource[]
}
export const relationshipMilestones = [
  { target: 3, title: words('留座的朋友', 'A friend who saves a seat') },
  { target: 8, title: words('邻里故事收藏家', 'Neighborhood story keeper') },
  { target: 15, title: words('小院的回忆守护者', 'Keeper of courtyard memories') },
] as const
const pairKey = (pair: readonly CharacterId[]) => [...pair].sort().join('/')
const location = (slot: string | null | undefined): Words => slot === 'message-tree' ? words('茶会广场 · 留言树', 'Tea Square · message tree') : slot === 'bookhouse' ? words('书屋', 'Bookhouse')
  : slot === 'courtyard' ? words('庭院', 'Courtyard')
  : slot === 'window' ? words('庭院 · 窗边', 'Courtyard · window')
  : slot === 'door' ? words('庭院 · 门口', 'Courtyard · doorway')
  : slot === 'wall' ? words('庭院 · 墙面', 'Courtyard · wall') : words('已收起，仍已解锁', 'Put away; still unlocked')

/** Bounded, read-only catalog of actual saved facts. No presence, in-flight events or inferred replays. */
export function relationshipFacts(world: LivingWorld) {
  const sources: RelationshipSource[] = []
  for (const memory of world.journal) sources.push({
    id: memory.templateId, eventId: memory.eventId, title: words('同桌的午后', 'An afternoon together'),
    source: words('来源：已保存的同桌手账', 'Source: saved table journal'), participants: [...memory.participants],
    completedTick: memory.completedTick, detail: memory.food === 'tea' ? words('初次分享了热茶。', 'The first shared serving was tea.') : words('初次分享了米饭。', 'The first shared serving was rice.'),
    keepsake: world.decorations.windChime ? { id: 'wind-chime', name: words('风铃', 'Wind chime'), location: location(world.decorations.windChime.slot) } : null,
  })
  for (const memory of world.neighborhood.memories) {
    if (memory.participants.length < 2) continue
    const play = playDefinitions.find(item => item.id === memory.id), daily = stories.find(item => item.id === memory.id)
    if (!play && !daily) continue
    const reward = play?.reward
    const extra = memory.id === 'shared-book' ? 'lantern' : null
    sources.push({ id: memory.id, eventId: memory.eventId, title: (play ?? daily)!.name,
      source: play ? words('来源：已完成并保存的游玩回忆', 'Source: completed, saved play memory') : words('来源：已完成并保存的邻里活动', 'Source: completed, saved neighborhood activity'),
      participants: [...memory.participants], completedTick: memory.completedTick,
      detail: words('这是本项活动首次保存的参与者；重玩次数不代表这对居民的次数。', 'These are the participants first saved for this activity; its replay total is not a count for this pair.'),
      keepsake: reward ? { id: reward, name: playDecorationNames[reward], location: location(world.play.decorations[reward]) }
        : extra ? { id: extra, name: words('纸灯笼', 'Paper lantern'), location: location(world.neighborhood.decorations[extra]) } : null,
    })
  }
  const book = world.bookhouse.memory
  if (book) sources.push({ id: 'bookhouse-light', eventId: book.eventId, title: words('夹在书里的微光', 'A little light between the pages'),
    source: words('来源：首次保存的书屋共读', 'Source: the first saved bookhouse reading'), participants: [...book.participants], completedTick: book.completedTick,
    detail: book.theme === 'light' ? words('首次共读的主题：光。后续重读不会补写其他组合的历史。', 'First reading theme: light. Later readings do not add histories for other pairs.') : words('首次共读的主题：风。后续重读不会补写其他组合的历史。', 'First reading theme: wind. Later readings do not add histories for other pairs.'),
    keepsake: { id: 'little-light-bookmark', name: words('微光书签', 'Little-light bookmark'), location: location(world.bookhouse.keepsake) },
  })
  const puzzle = world.bookhouse.puzzleMemory
  if (puzzle) sources.push({ id: 'bookhouse-puzzle', eventId: puzzle.eventId, title: words('书架里的谜题', 'A puzzle on the shelf'),
    source: words('来源：首次保存的书屋谜题', 'Source: the first saved bookhouse puzzle'), participants: [...puzzle.participants], completedTick: puzzle.completedTick,
    detail: words('首次一起整理书页的两位朋友。后续重玩次数不代表这对居民的次数。', 'The two friends who first arranged the pages together. Later replay totals are not a count for this pair.'), keepsake: null,
  })
  const tea=world.teaSquare.memory
  if(tea)sources.push({id:'tea-square-three-cups',eventId:tea.eventId,title:words('三杯不同的下午','Three cups, one afternoon'),source:words('来源：首次保存的三人茶会','Source: the first saved three-person tea story'),participants:[...tea.participants],completedTick:tea.completedTick,detail:words(`第 ${tea.day} 天的三位朋友；重玩不替换首次参与者。`,`Three friends on day ${tea.day}; replays preserve this first cast.`),keepsake:{id:'three-leaf-tea-tag',name:words('三叶茶签','Three-leaf tea tag'),location:location(world.teaSquare.keepsake)}})
  const pairs: Relationship[] = []
  for (let i = 0; i < characterIds.length; i++) for (let j = i + 1; j < characterIds.length; j++) {
    const pair = [characterIds[i]!, characterIds[j]!] as const, id = pairKey(pair)
    const bond = world.neighborhood.bonds.find(item => item.count > 0 && pairKey(item.pair) === id)
    // A three-person first memory belongs to its three actual pairs, with the complete cast retained.
    const actual = sources.filter(source => pair.every(resident => source.participants.includes(resident))).sort((a, b) => a.completedTick - b.completedTick)
    pairs.push({ id, pair, discovered: !!bond || actual.length > 0, sharedCount: bond?.count ?? null, lastTick: bond?.lastTick ?? null, sources: actual })
  }
  const discoveredCount = pairs.filter(pair => pair.discovered).length
  return { pairs, discoveredCount, milestones: relationshipMilestones.map(item => ({ ...item, unlocked: discoveredCount >= item.target })) }
}
