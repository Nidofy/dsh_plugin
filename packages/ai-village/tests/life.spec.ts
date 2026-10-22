import { expect, it } from 'vitest'
import { characterIds } from '../src/core/roster.ts'
import { activityWeight, lifeClock, residentLife } from '../src/core/life-catalog.ts'
import { cancelLifeSocial, chooseLifeSocial, lifePresentation, settleLifeSocial, stepLifeSocial, validateLifeState, type LifeWorld } from '../src/core/life-engine.ts'
import { lifeDialogue } from '../src/core/life-dialogue.ts'
import { actors, createWorld, reachable, validateWorld, type World } from '../src/core/world.ts'
import { scene, roster, character, animations } from '../src/definitions.ts'
import { applyLifePose, samplePose } from '../src/art/animation.ts'
import type { LifeMotion } from '../src/core/life-catalog.ts'
import { createLivingWorld, validateLivingWorld } from '../src/core/living-state.ts'
import { LivingController } from '../src/core/living-controller.ts'
import { stepLiving } from '../src/core/living-engine.ts'

function neighbors(): World & LifeWorld {
  const world = { ...createWorld(scene), life: { social: null } } as World & LifeWorld
  world.ticks = 900
  world.companions.push({ ...structuredClone(world.actor), id: 'claude', position: { x: 260, y: 340 }, safe: { x: 260, y: 340 } })
  return world
}

it('gives all seven residents bounded independent preferences and simulation-only daily rhythms', () => {
  expect(new Set(characterIds.map(id => residentLife[id].signature)).size).toBe(7)
  for (const id of characterIds) {
    const resident = residentLife[id]
    for (const weight of Object.values(resident.activityWeights)) expect(weight).toBeGreaterThan(0)
    for (const words of [resident.description, resident.idle, resident.greeting, resident.watching, resident.farewell]) {
      expect(words.zh.length).toBeLessThan(50); expect(words.zh).toMatch(/[\u4e00-\u9fff]/)
      expect(words.en.length).toBeLessThan(110); expect(words.en).toMatch(/[a-z]/i)
    }
  }
  expect(lifeClock(0)).toEqual({ day: 1, hour: 14, minute: 0, period: 'day' })
  expect(lifeClock(6750).period).toBe('dusk')
  expect(lifeClock(22500).period).toBe('night')
  expect(lifeClock(54000)).toEqual({ day: 2, hour: 14, minute: 0, period: 'day' })
  expect(activityWeight('bluewhale', 'eat', 0)).toBeGreaterThan(activityWeight('bluewhale', 'work', 0))
  expect(activityWeight('claude', 'read', 0)).toBeGreaterThan(activityWeight('claude', 'eat', 0))
  expect(activityWeight('kimi', 'rest', 22500)).toBeGreaterThan(activityWeight('kimi', 'rest', 0))
})

it('approaches an actual neighbor without teleport, collision or random consumption and disperses after a bounded exchange', () => {
  const world = neighbors(), rng = world.rng
  const held = stepLifeSocial(world, scene)
  expect(held).toHaveLength(2); expect(world.life.social?.kind).toBe('greet')
  const first = structuredClone(world), restored = { ...validateWorld(JSON.parse(JSON.stringify(world)), scene), life: validateLifeState(world.life, world, scene) }
  const observed = new Set<string>(), bubbles = new Set<string>()
  for (let i = 0; i < 320; i++) {
    const previous = new Map(actors(world).map(a => [a.id, { ...a.position }]))
    stepLifeSocial(world, scene); stepLifeSocial(restored, scene)
    world.ticks++; restored.ticks++
    settleLifeSocial(world, scene); settleLifeSocial(restored, scene)
    for (const actor of actors(world)) {
      expect(Math.hypot(actor.position.x - previous.get(actor.id)!.x, actor.position.y - previous.get(actor.id)!.y)).toBeLessThanOrEqual(17 / 30 + 1e-7)
      expect(reachable(scene, previous.get(actor.id)!, actor.position)).toBe(true)
      observed.add(lifePresentation(world, actor.id)?.motion ?? actor.behavior)
    }
    for (const line of lifeDialogue(world, 'en')) bubbles.add(line.text)
    expect(Math.hypot(world.actor.position.x - world.companions[0]!.position.x, world.actor.position.y - world.companions[0]!.position.y)).toBeGreaterThanOrEqual(24)
    expect(validateLifeState(world.life, world, scene)).toEqual(world.life)
    const { life: _life, ...base } = world
    expect(validateWorld(world, scene)).toEqual(base)
  }
  expect(world).toEqual(restored); expect(world.rng).toBe(rng); expect(world.life.social).toBeNull()
  expect(first.life.social).not.toBeNull(); expect(observed.has('walk')).toBe(true); expect(observed.has('wave')).toBe(true); expect(observed.has('farewell')).toBe(true)
  expect(bubbles.size).toBe(2)
  expect(actors(world).every(a => a.behavior === 'idle' && !a.intent && !a.destination)).toBe(true)
})

it('does not overwrite confirmed user actions and releases only its own interrupted actors', () => {
  const world = neighbors(); stepLifeSocial(world, scene)
  const protectedActor = actors(world).find(a => a.id === world.life.social!.pair[0])!
  protectedActor.position = { x: 200, y: 420 }; protectedActor.safe = { ...protectedActor.position }; protectedActor.behavior = 'put_down'; protectedActor.destination = null; protectedActor.remaining = .5
  const before = structuredClone(protectedActor)
  expect(stepLifeSocial(world, scene, [protectedActor.id])).toEqual([])
  expect(world.life.social).toBeNull(); expect(protectedActor).toEqual(before)
  const second = neighbors(); stepLifeSocial(second, scene)
  second.companions = []
  settleLifeSocial(second, scene)
  expect(second.life.social).toBeNull(); expect(second.actor.intent).toBeNull(); expect(second.actor.destination).toBeNull()
})

it('watches furniture activity without taking its seat or completing special wishes, and ends when it ends', () => {
  const world = neighbors(), h = scene.hotspots.find(h => h.activity === 'work')!, worker = world.companions[0]!
  world.actor.position = { x: 184, y: 278 }; world.actor.safe = { ...world.actor.position }
  worker.position = { ...h.anchor }; worker.safe = { ...h.anchor }; worker.behavior = 'work'; worker.remaining = 10
  worker.intent = { furnitureId: h.id, seat: 'main', activity: 'work', stage: 'use', route: [], expires: 1500 }
  const before = structuredClone(worker)
  expect(chooseLifeSocial(world, scene)?.kind).toBe('watch')
  expect(stepLifeSocial(world, scene)).toEqual(['bluewhale'])
  expect(worker).toEqual(before)
  expect(Object.keys(world.life)).toEqual(['social'])
  worker.intent = null; worker.behavior = 'idle'; worker.remaining = 3
  settleLifeSocial(world, scene)
  expect(world.life.social).toBeNull(); expect(worker.remaining).toBe(3)
})

it('respects pause, blocked residents, occupied routes and tick cooldown, independently of selected character', () => {
  const world = neighbors(), swapped = { ...structuredClone(world), actor: structuredClone(world.companions[0]!), companions: [structuredClone(world.actor)] }
  expect(chooseLifeSocial(world, scene)).toEqual(chooseLifeSocial(swapped, scene))
  expect(chooseLifeSocial(world, scene, ['bluewhale'])).toBeNull()
  world.userPaused = true
  const before = structuredClone(world); stepLifeSocial(world, scene)
  expect(world).toEqual(before)
  world.userPaused = false; world.ticks = 901
  expect(stepLifeSocial(world, scene)).toEqual([])
  world.ticks = 900; world.companions[0]!.position = { x: 102, y: 283 }
  expect(chooseLifeSocial(world, scene)).toBeNull()
  cancelLifeSocial(world)
})

it('strictly rejects malformed, stale, duplicate or absent social participants', () => {
  const world = neighbors(); stepLifeSocial(world, scene)
  const valid = world.life.social!
  for (const social of [undefined, {}, { ...valid, extra: 1 }, { ...valid, endTick: Infinity }, { ...valid, startTick: 901 },
    { ...valid, endTick: valid.endTick + 1 }, { ...valid, pair: ['bluewhale', 'bluewhale'] }, { ...valid, pair: ['bluewhale', 'qwen'] }, { ...valid, kind: '__proto__' }]) {
    expect(() => validateLifeState({ social }, world, scene)).toThrow('INVALID_LIFE_STATE')
  }
  expect(() => validateLifeState({ ...world.life, unknown: true }, world, scene)).toThrow('INVALID_LIFE_STATE')
})

it('uses distinct articulated performances for seven approved rigs and distinguishes social actions without moving feet', () => {
  const poses = new Set<string>()
  for (const id of characterIds) {
    const art = id === 'bluewhale' ? { character, animations } : roster[id]!, pose = samplePose(art.character, art.animations.actions.idle, 0), base = structuredClone(pose)
    applyLifePose(pose, id, residentLife[id].signature, 1.1)
    poses.add(JSON.stringify(pose.transforms))
    expect(pose.transforms.root).toEqual(base.transforms.root)
    expect(pose.transforms['leg-left']).toEqual(base.transforms['leg-left'])
    expect(pose.transforms['leg-right']).toEqual(base.transforms['leg-right'])
    expect(Object.values(pose.transforms).every(t => Object.values(t).every(Number.isFinite))).toBe(true)
    const reduced = structuredClone(base); applyLifePose(reduced, id, residentLife[id].signature, 1.1, true)
    expect(reduced).toEqual(base)
    const ended = structuredClone(base); applyLifePose(ended, id, residentLife[id].signature, 4)
    expect(ended).toEqual(base)
  }
  expect(poses.size).toBe(7)
  const base = samplePose(character, animations.actions.idle, 0)
  const motions: LifeMotion[] = ['wave', 'listen', 'offer', 'point', 'farewell', 'waiting', 'interrupted']
  const socialPoses = motions.map(motion => { const pose = structuredClone(base); applyLifePose(pose, 'bluewhale', motion, .7); return pose })
  expect(new Set(socialPoses.map(p => JSON.stringify(p.transforms))).size).toBe(motions.length)
  expect(socialPoses.at(-1)!.expression).toBe('surprised')
})

it('integrates seven-resident social scheduling, cold restores and pause without changing the chosen environment or recording rewards', () => {
  const controller = new LivingController(createLivingWorld(scene), scene, () => {})
  for (const id of characterIds) controller.setCharacterPresent(id, true)
  const world = controller.world, environment = world.home.environment
  let restored = validateLivingWorld(JSON.parse(JSON.stringify(world)), scene), exchanges = 0
  for (let tick = 0; tick < 108000; tick++) {
    const before = world.life.social
    stepLiving(world, scene); stepLiving(restored, scene)
    if (!before && world.life.social) exchanges++
    if (tick % 300 === 0) {
      expect(validateLivingWorld(world, scene)).toEqual(world)
      expect(world).toEqual(restored)
      restored = validateLivingWorld(JSON.parse(JSON.stringify(restored)), scene)
    }
  }
  expect(exchanges).toBeGreaterThan(0)
  expect(world.home.environment).toBe(environment)
  expect(world.neighborhood.memories).toEqual([]); expect(world.neighborhood.bonds).toEqual([])
  expect(world.journal).toEqual([]); expect(world.progress.completedWishes).toEqual([])
  controller.pause('hidden', true)
  const paused = controller.snapshot()
  for (let i = 0; i < 100; i++) controller.advance(.1)
  expect(controller.snapshot()).toEqual(paused)
})
