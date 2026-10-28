import type { LivingWorld } from './living-state.ts'
import type { AfternoonState } from './afternoon-state.ts'
import { afternoonStories } from './afternoon-catalog.ts'
import { words, type Words } from './neighborhood-catalog.ts'
import type { RelationshipSource } from './relationship-catalog.ts'
import { isCharacterId, type CharacterId } from './roster.ts'
import { cancelLifeSocial, chooseLifeSocial, lifePresentation, settleLifeSocial, stepLifeSocial, type LifeWorld } from './life-engine.ts'
import { lifeDialogue } from './life-dialogue.ts'
import type { Scene } from './world.ts'

export type CommunityRegion = 'courtyard' | 'bookhouse' | 'tea-square'
export type CommunityKind = 'greet' | 'recall' | 'keepsake' | 'invite'
export interface CommunityEncounter {
  pair: [CharacterId, CharacterId]; region: CommunityRegion; kind: CommunityKind; sourceId: string | null; startTick: number
}
/** Only scheduling and current presentation are persisted here. Memories remain in their original owners. */
export interface CommunityState { version: 1; nextAttemptTick: number; recent: CommunityEncounter[]; active: CommunityEncounter | null }
export type CommunityFactsWorld = Pick<LivingWorld, 'journal' | 'neighborhood' | 'bookhouse' | 'teaSquare'> & { afternoon: AfternoonState }
export type CommunityWorld = CommunityFactsWorld & LifeWorld & { region: { active: CommunityRegion }; community: CommunityState }
export interface CommunitySource extends RelationshipSource { region: CommunityRegion; placedRegion: CommunityRegion | null }
export const communityInterval = 900
export const communityRetryInterval = 90
export const communityPairCooldown = 1800
export const communitySourceCooldown = 3600
export const communityHistoryLimit = 12
const regions: CommunityRegion[] = ['courtyard', 'bookhouse', 'tea-square']
const regionNames: Record<CommunityRegion, Words> = { courtyard: words('庭院', 'courtyard'), bookhouse: words('书屋', 'bookhouse'), 'tea-square': words('茶会广场', 'Tea Square') }
const pairKey = (pair: readonly CharacterId[]) => [...pair].sort().join('/')
const sameEncounter = (a: CommunityEncounter, b: CommunityEncounter) => a.startTick === b.startTick && a.region === b.region && a.kind === b.kind && a.sourceId === b.sourceId && a.pair.join('/') === b.pair.join('/')
export function initialCommunityState(ticks = 0): CommunityState { return { version: 1, nextAttemptTick: ticks + communityInterval, recent: [], active: null } }

/** Called only with a validated, committed world by presentation. Active activities never enter this catalog. */
export function communityMemorySources(world: CommunityFactsWorld): CommunitySource[] {
  const result: CommunitySource[] = []
  const add = (id: string, memory: { eventId: string; participants: readonly CharacterId[]; completedTick: number }, title: Words, region: CommunityRegion, name: Words | null, placedRegion: CommunityRegion | null) => {
    result.push({ id, eventId: memory.eventId, title, source: words('来源：首次完成并保存的回忆', 'Source: the first completed, saved memory'),
      participants: [...memory.participants], completedTick: memory.completedTick,
      detail: words('保留首次参与者与来源；重玩不会补写另一组朋友的历史。', 'The first cast and source are preserved; replays do not invent another pair’s history.'),
      keepsake: name ? { id: id === 'bookhouse-light' ? 'little-light-bookmark' : id === 'tea-square-three-cups' ? 'three-leaf-tea-tag' : `${id}-keepsake`, name, location: placedRegion ? regionNames[placedRegion] : words('已收起，仍已解锁', 'Put away; still unlocked') } : null, region, placedRegion })
  }
  const book = world.bookhouse.memory, puzzle = world.bookhouse.puzzleMemory, tea = world.teaSquare.memory
  if (book) add('bookhouse-light', book, words('夹在书里的微光', 'A little light between the pages'), 'bookhouse', words('微光书签', 'Little-light bookmark'), world.bookhouse.keepsake)
  if (puzzle) add('bookhouse-puzzle', puzzle, words('书架里的谜题', 'A puzzle on the shelf'), 'bookhouse', null, null)
  if (tea) add('tea-square-three-cups', tea, words('三杯不同的下午', 'Three cups, one afternoon'), 'tea-square', words('三叶茶签', 'Three-leaf tea tag'), world.teaSquare.keepsake ? 'tea-square' : null)
  for (const memory of world.afternoon.memories) {
    const story = afternoonStories.find(story => story.id === memory.storyId)!
    add(`afternoon-${memory.storyId}`, memory, story.title, 'tea-square', story.keepsakeTitle, world.afternoon.keepsakes[memory.storyId] ? 'tea-square' : null)
  }
  return result
}

export function communityCollection(world: CommunityFactsWorld) {
  const sources = communityMemorySources(world)
  const visitedRegions = regions.filter(region => region === 'courtyard' ? world.journal.length > 0 || world.neighborhood.memories.length > 0 : sources.some(source => source.region === region))
  const unlocked = visitedRegions.length === 3
  return { sources, visitedRegions, keepsakes: sources.filter(source => source.keepsake), threeRegions: {
    id: 'three-region-memory-card', title: words('三处风景，一起记得', 'Three places to remember'), unlocked,
    detail: words('由庭院、书屋、茶会广场各一段已保存的经历拼成；仅仅到访不会解锁。', 'Made from saved experiences in the courtyard, bookhouse and Tea Square. A visit alone does not unlock it.'),
    placement: unlocked ? { region: 'courtyard' as const, x: 304, y: 198 } : null,
  } }
}

/** Old saves may retain a life.social without new metadata. The inverse is never valid. */
export function syncCommunitySocial(world: Pick<CommunityWorld, 'community' | 'life' | 'region'>): void {
  const active = world.community.active, social = world.life.social
  if (active && (!social || active.startTick !== social.startTick || active.pair.join('/') !== social.pair.join('/') || active.region !== world.region.active)) world.community.active = null
}
export function cancelCommunitySocial(world: CommunityWorld, protectedIds: readonly CharacterId[] = []): void {
  cancelLifeSocial(world, protectedIds); world.community.active = null
}
export function settleCommunitySocial(world: CommunityWorld, scene: Scene, protectedIds: readonly CharacterId[] = []): void {
  settleLifeSocial(world, scene, protectedIds); syncCommunitySocial(world)
  if (world.community.active?.kind === 'keepsake' && !communityMemorySources(world).some(s => s.id === world.community.active!.sourceId && s.placedRegion === world.region.active)) cancelCommunitySocial(world, protectedIds)
}

export function validateCommunityState(value: unknown, world: Omit<CommunityWorld, 'community'>): CommunityState {
  const fail = (): never => { throw Error('INVALID_COMMUNITY_STATE') }
  const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key))
  const tick = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
  if (!exact(value, ['version', 'nextAttemptTick', 'recent', 'active']) || value.version !== 1 || !tick(value.nextAttemptTick) || value.nextAttemptTick > world.ticks + communityInterval || !Array.isArray(value.recent) || value.recent.length > communityHistoryLimit) return fail()
  const sources = communityMemorySources(world)
  const encounter = (v: unknown): CommunityEncounter => {
    if (!exact(v, ['pair', 'region', 'kind', 'sourceId', 'startTick']) || !Array.isArray(v.pair) || v.pair.length !== 2 || !v.pair.every(isCharacterId) || v.pair[0] === v.pair[1]
      || !regions.includes(v.region as CommunityRegion) || !['greet', 'recall', 'keepsake', 'invite'].includes(v.kind as string) || !tick(v.startTick) || v.startTick > world.ticks) return fail()
    const e = v as unknown as CommunityEncounter, source = sources.find(source => source.id === e.sourceId)
    if (e.kind === 'recall' || e.kind === 'keepsake') {
      if (!source || source.completedTick > e.startTick || !e.pair.every(id => source.participants.includes(id)) || (e.kind === 'recall' && source.region === e.region) || (e.kind === 'keepsake' && !source.keepsake)) return fail()
    } else if (e.sourceId !== null) return fail()
    return structuredClone(e)
  }
  const recent = value.recent.map(encounter)
  for (let i = 0; i < recent.length; i++) {
    const current = recent[i]!
    if (i && current.startTick - recent[i - 1]!.startTick < communityInterval) return fail()
    for (const previous of recent.slice(0, i)) if ((pairKey(previous.pair) === pairKey(current.pair) && current.startTick - previous.startTick < communityPairCooldown)
      || (current.sourceId && current.sourceId === previous.sourceId && current.startTick - previous.startTick < communitySourceCooldown)) return fail()
  }
  if (recent.length && value.nextAttemptTick < recent.at(-1)!.startTick + communityInterval) return fail()
  const active = value.active === null ? null : encounter(value.active)
  if (active && (!recent.length || !sameEncounter(active, recent.at(-1)!) || !world.life.social || active.startTick !== world.life.social.startTick || active.pair.join('/') !== world.life.social.pair.join('/') || active.region !== world.region.active)) return fail()
  if (active?.kind === 'keepsake' && !sources.some(source => source.id === active.sourceId && source.placedRegion === active.region)) return fail()
  return { version: 1, nextAttemptTick: value.nextAttemptTick, recent, active }
}

/** Uses the existing movement owner; never calls an activity completion, reward, RNG or memory writer. */
export function stepCommunitySocial(world: CommunityWorld, scene: Scene, blockedIds: readonly CharacterId[] = []): CharacterId[] {
  if (world.userPaused) return []
  settleCommunitySocial(world, scene, blockedIds)
  if (world.life.social) {
    const held = stepLifeSocial(world, scene, blockedIds); syncCommunitySocial(world); return held
  }
  if (world.ticks < world.community.nextAttemptTick) return []
  world.community.nextAttemptTick = world.ticks + communityInterval
  const excluded = [...blockedIds], sources = communityMemorySources(world)
  for (let attempt = 0; attempt <= world.companions.length; attempt++) {
    const social = chooseLifeSocial(world, scene, excluded)
    if (!social) { world.community.nextAttemptTick=world.ticks+communityRetryInterval; return [] }
    if (world.community.recent.some(e => pairKey(e.pair) === pairKey(social.pair) && world.ticks - e.startTick < communityPairCooldown)) { excluded.push(social.pair[0]); continue }
    const source = sources.find(s => social.pair.every(id => s.participants.includes(id)) && s.completedTick <= world.ticks && (s.region !== world.region.active || s.placedRegion === world.region.active)
      && !world.community.recent.some(e => e.sourceId === s.id && world.ticks - e.startTick < communitySourceCooldown))
    const kind: CommunityKind = source ? source.region !== world.region.active ? 'recall' : 'keepsake' : Math.floor(world.ticks / communityInterval) % 2 ? 'greet' : 'invite'
    // The frozen bookhouse codec excludes courtyard chime/garden gestures.
    // Keep the source-backed keepsake dialogue while using the room's chat motion.
    if (social.kind !== 'watch') social.kind = kind === 'keepsake' ? world.region.active === 'bookhouse' ? 'chat' : 'chime' : kind === 'recall' ? 'chat' : kind === 'invite' ? 'tea' : 'greet'
    const active: CommunityEncounter = { pair: [...social.pair], region: world.region.active, kind, sourceId: source?.id ?? null, startTick: world.ticks }
    world.life.social = social; world.community.active = active
    world.community.recent = [...world.community.recent, structuredClone(active)].slice(-communityHistoryLimit)
    for (const actor of [world.actor, ...world.companions]) if (social.pair.includes(actor.id) && (social.kind !== 'watch' || actor.id === social.pair[0])) actor.phase = 0
    const held = stepLifeSocial(world, scene, blockedIds); syncCommunitySocial(world); return held
  }
  world.community.nextAttemptTick=world.ticks+communityRetryInterval
  return []
}

/** A source event ID is returned for review/UI provenance, never copied into another saved fact. */
export function communityDialogue(world: CommunityWorld, locale: 'zh' | 'en'): { actor: CharacterId; text: string; sourceId: string | null; eventId: string | null }[] {
  const active = world.community.active, social = world.life.social
  if (!active || !social || active.startTick !== social.startTick || active.pair.join('/') !== social.pair.join('/') || active.region !== world.region.active) return lifeDialogue(world, locale).map(line => ({ ...line, sourceId: null, eventId: null }))
  const presentation = lifePresentation(world, social.pair[0])
  if (!presentation?.bubble) return []
  if (presentation.bubble === 'farewell') return lifeDialogue(world, locale).map(line => ({ ...line, sourceId: null, eventId: null }))
  const source = communityMemorySources(world).find(source => source.id === active.sourceId)
  if (active.kind === 'keepsake' && source?.placedRegion !== world.region.active) return []
  let text: string
  if (source && active.kind === 'recall') text = locale === 'zh' ? `在${regionNames[world.region.active].zh}，又想起我们「${source.title.zh}」的那一天。` : `Here in the ${regionNames[world.region.active].en}, I remember our “${source.title.en}”.`
  else if (source?.keepsake && active.kind === 'keepsake') text = locale === 'zh' ? `看，${source.keepsake.name.zh}还记着我们一起的那个下午。` : `Look, the ${source.keepsake.name.en} recalls our afternoon together.`
  else if (active.kind === 'invite') text = locale === 'zh' ? '一起停一小会儿，再去忙各自的事吧。' : 'Let’s pause together a moment, then get back to our day.'
  else text = lifeDialogue(world, locale)[0]?.text ?? (locale === 'zh' ? '又见面啦。' : 'Good to see you again.')
  return [{ actor: social.pair[0], text, sourceId: source?.id ?? null, eventId: source?.eventId ?? null }]
}
