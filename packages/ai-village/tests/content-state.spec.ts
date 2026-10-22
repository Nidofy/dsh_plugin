import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createWorld, actors } from '../src/core/world.ts'
import { createContentWorld, emptyContent, validateContentWorld } from '../src/core/content-state.ts'
import { contentWorldCodec, legacySceneV1, migrateContentWorld } from '../src/core/migrations.ts'
import { candidateScene, previewWorld } from '../experiments/content-ui/scene.ts'
import { completedContent, eventId } from './helpers/content.ts'
const load = (name: string) => JSON.parse(readFileSync(new URL('./fixtures/legacy/' + name, import.meta.url), 'utf8'))
describe('schema 4 migration and content invariants', () => {
  for (const v of [1, 2, 3]) it(`migrates original schema ${v} bytes while preserving identities, clocks and selection`, () => {
    const original = load(`saved-schema${v}.json`).world, before = JSON.stringify(original)
    const migrated = migrateContentWorld(original, candidateScene)
    expect(migrated.schemaVersion).toBe(4); expect(migrated.sceneVersion).toBe(2)
    expect(migrated.ticks).toBe(original.ticks); expect(migrated.rng).toBe(original.rng); expect(migrated.userPaused).toBe(original.userPaused)
    expect(migrated.actor.id).toBe(original.actor.id)
    expect(actors({ ...migrated, schemaVersion: 3 }).map(a => a.id).sort()).toEqual([original.actor, ...(original.companions ?? [])].map(a => a.id).sort())
    expect(JSON.stringify(original)).toBe(before)
    expect(contentWorldCodec(candidateScene).decode(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated)
  })
  it('freezes old geometry independently and preserves unaffected work progress', () => {
    const { furniture: _f, cushion: _c, ...frozen } = load('scene-v1.json')
    expect(legacySceneV1).toEqual(frozen)
    const original = load('saved-schema3.json').world, next = migrateContentWorld(original, candidateScene)
    const working = original.companions.find((a: { behavior: string }) => a.behavior === 'work')
    expect(next.companions.find(a => a.id === working.id)).toEqual(working)
  })
  it('maps the old main eating seat to left and replans instead of teleporting', () => {
    const old = createWorld(legacySceneV1)
    Object.assign(old.actor, { position: { x: 268, y: 283 }, safe: { x: 268, y: 283 }, behavior: 'eat', remaining: 22,
      intent: { furnitureId: 'eat', seat: 'main', activity: 'eat', stage: 'use', route: [], expires: 900 } })
    const next = migrateContentWorld(old, candidateScene)
    expect(next.actor.position).toEqual(old.actor.position); expect(next.actor.behavior).toBe('walk')
    expect(next.actor.intent?.seat).toBe('left'); expect(next.actor.intent?.stage).toBe('approach')
    expect(next.actor.remaining).toBe(22)
  })
  it('moves newly obstructed residents without evicting safe residents and refuses impossible placement', () => {
    const old = createWorld(legacySceneV1)
    old.actor.position = { x: 173, y: 390 }; old.actor.safe = { ...old.actor.position }
    old.companions = [{ ...structuredClone(old.actor), id: 'gpt', position: { x: 50, y: 220 }, safe: { x: 50, y: 220 } }]
    const next = migrateContentWorld(old, candidateScene)
    expect(next.actor.position).not.toEqual(old.actor.position); expect(next.companions[0]!.position).toEqual(old.companions[0]!.position)
    expect(() => migrateContentWorld(old, { ...candidateScene, obstacles: [{ ...candidateScene.walkable }] })).toThrow('NO_SAFE_MIGRATION_POSITION')
  })
  it('accepts a complete atomic reward and refuses partial, duplicated or unknown facts', () => {
    const good = completedContent()
    expect(validateContentWorld(good, candidateScene)).toEqual(good)
    for (const mutate of [
      (w: typeof good) => { w.progress.unlocked = [] },
      (w: typeof good) => { w.journal = [] },
      (w: typeof good) => { w.decorations.windChime = null },
      (w: typeof good) => { w.journal.push(structuredClone(w.journal[0]!)) },
      (w: typeof good) => { w.journal[0]!.participants = ['bluewhale', 'bluewhale'] },
      (w: typeof good) => { w.journal[0]!.completedTick = w.ticks + 1 },
      (w: typeof good) => { w.progress.lastCompletedEventId = null },
      (w: typeof good) => { Object.assign(w.progress, { discovered: ['arbitrary-script'] }) },
      (w: typeof good) => { Object.assign(w, { pending: true }) },
      (w: typeof good) => { w.journal = Array(33).fill(w.journal[0]) },
    ]) { const bad = structuredClone(good); mutate(bad); expect(() => validateContentWorld(bad, candidateScene)).toThrow() }
    good.decorations.windChime!.slot = 'window'
    expect(() => validateContentWorld(good, candidateScene)).toThrow()
    good.decorations.layoutRevision = 1; good.progress.discovered.push('wind-chime-placed')
    expect(validateContentWorld(good, candidateScene).decorations.windChime!.slot).toBe('window')
  })
  it('requires actual participants to own both event seats and rejects version/size drift', () => {
    const world = emptyContent(previewWorld())
    for (const [i, actor] of [world.actor, world.companions[0]!].entries()) {
      actor.position = { ...candidateScene.hotspots[i + 1]!.anchor }; actor.safe = { ...actor.position }; actor.behavior = 'eat'
      actor.intent = { furnitureId: 'eat', seat: i ? 'right' : 'left', activity: 'eat', stage: 'use', expires: 900, route: [] }
    }
    world.activeEvent = { id: eventId, definitionId: 'first-tea', definitionVersion: 1, participants: ['bluewhale', 'claude'], food: 'tea',
      seats: ['eat/left', 'eat/right'], phase: 'talking', remainingTicks: 150, approachRemainingTicks: 1000, retryCount: 0, branch: 'tea' }
    expect(validateContentWorld(world, candidateScene)).toEqual(world)
    world.activeEvent.participants[1] = 'gpt'
    expect(() => validateContentWorld(world, candidateScene)).toThrow()
    expect(() => migrateContentWorld({ ...load('saved-schema3.json').world, sceneVersion: 9 }, candidateScene)).toThrow('UNSUPPORTED_WORLD_VERSION')
    expect(() => validateContentWorld({ ...createContentWorld(candidateScene), contentRevision: 2 }, candidateScene)).toThrow('UNSUPPORTED_CONTENT_VERSION')
    expect(() => validateContentWorld({ ...world, extra: '汉'.repeat(20000) }, candidateScene)).toThrow('SAVE_TOO_LARGE')
  })
})
