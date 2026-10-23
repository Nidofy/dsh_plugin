import type { LivingWorld } from './living-state.ts'
import type { Album } from './photo.ts'
import { characterIds, characterNames } from './roster.ts'
import { words, stories, type Words } from './neighborhood-catalog.ts'
import { playDefinitions, playDecorationNames } from './play-catalog.ts'

export interface CollectionCategory { id: string; title: Words; source: Words; items: { id: string; label: Words }[]; total: number | null; known: boolean }
export interface CollectionGoal { id: string; title: Words; source: Words; count: number | null; target: number }
/** Read-only projection of saved facts. Presence, elapsed time and pending photos are never achievements. */
export function collectionFacts(world: LivingWorld, album: Album | null): { categories: CollectionCategory[]; goals: CollectionGoal[] } {
  const memories = world.neighborhood.memories, journal = world.journal ?? [], bonds = (world.neighborhood.bonds ?? []).filter(b => b.count > 0)
  const completed = new Set(memories.map(m => m.id as string))
  const shared = [...journal, ...memories].filter(m => m.participants.length >= 2)
  const residents = new Set([...shared.flatMap(m => m.participants), ...bonds.flatMap(b => b.pair)])
  const pairs = [...new Map(bonds.map(b => [[...b.pair].sort().join('/'), b])).values()]
  const placed: string[] = [], keepsakes: { id: string; label: Words }[] = []
  if (world.decorations?.windChime) { keepsakes.push({ id: 'wind-chime', label: words('风铃', 'Wind chime') }); if (world.decorations.windChime.slot) placed.push('wind-chime') }
  for (const [id, story, label] of [['lantern', 'shared-book', words('纸灯笼', 'Paper lantern')], ['planter', 'water', words('花叶挂饰', 'Leaf garland')]] as const) {
    if (completed.has(story)) { keepsakes.push({ id, label }); if (world.neighborhood.decorations?.[id]) placed.push(id) }
  }
  for (const d of playDefinitions) if (completed.has(d.id) && !keepsakes.some(k => k.id === d.reward)) {
    keepsakes.push({ id: d.reward, label: playDecorationNames[d.reward] }); if (world.play.decorations[d.reward]) placed.push(d.reward)
  }
  const category = (kind: string, title: Words): CollectionCategory => {
    const catalog = playDefinitions.filter(d => d.kind === kind)
    return { id: kind, title, source: words('来源：已完成并保存的对应回忆；重玩不增加种类。', 'Source: completed, saved memories of this kind. Replays do not add new types.'), items: catalog.filter(d => completed.has(d.id)).map(d => ({ id: d.id, label: d.name })), total: catalog.length, known: true }
  }
  const daily = stories.filter(s => completed.has(s.id)).map(s => ({ id: s.id as string, label: s.name }))
  if (journal.length) daily.unshift({ id: 'first-table', label: words('同桌的午后', 'An afternoon together') })
  const categories: CollectionCategory[] = [
    { id: 'daily', title: words('日常回忆', 'Everyday memories'), source: words('来源：已保存的同桌手账与邻里日常。', 'Source: saved table memories and neighborhood moments.'), items: daily, total: stories.length + 1, known: true },
    category('story', words('小故事', 'Little stories')), category('game', words('小游戏', 'Little games')), category('group', words('多人相聚', 'Group moments')), category('event', words('偶遇', 'Chance encounters')),
    { id: 'company', title: words('一起留下回忆的居民', 'Residents in shared memories'), source: words('来源：已完成多人回忆的参与者，或有记录的共同经历；仅仅在场不会计入。', 'Source: participants in completed shared memories or recorded bonds. Being present alone does not count.'), items: characterIds.filter(id => residents.has(id)).map(id => ({ id, label: words(characterNames[id], characterNames[id]) })), total: characterIds.length, known: true },
    { id: 'keepsakes', title: words('纪念物', 'Keepsakes'), source: words(`来源：已解锁的活动纪念物；其中 ${placed.length} 件正在摆放。收起不会取消解锁。`, `Source: unlocked activity keepsakes; ${placed.length} currently placed. Putting one away does not remove its discovery.`), items: keepsakes, total: new Set(playDefinitions.map(d => d.reward)).size + 3, known: true },
    { id: 'photos', title: words('照片', 'Photos'), source: words('来源：最近读取的已保存相册。只计算当前照片，不推断拍摄历史；删除会减少数量。', 'Source: the latest loaded saved album. Counts current photos, not an inferred capture history; deletion reduces the count.'), items: (album?.photos ?? []).map(p => ({ id: p.id, label: words(p.title || '未命名照片', p.title || 'Untitled photo') })), total: null, known: album !== null },
  ]
  return { categories, goals: [
    { id: 'shared-residents', title: words('和七位居民留下共同回忆', 'Make shared memories with seven residents'), source: categories.find(c => c.id === 'company')!.source, count: residents.size, target: 7 },
    { id: 'shared-pairs', title: words('让三对朋友有共同经历', 'Build shared experiences for three pairs'), source: words('来源：已保存的共同经历中，不重复的居民组合；同一对重玩只算一对。', 'Source: distinct pairs in saved bonds. Repeating with the same pair still counts as one pair.'), count: pairs.length, target: 3 },
    { id: 'photo-album', title: words('在相册留下三张照片', 'Keep three photos in the album'), source: categories.find(c => c.id === 'photos')!.source, count: album === null ? null : new Set(album.photos.map(p => p.id)).size, target: 3 },
  ] }
}
