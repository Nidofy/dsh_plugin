import type { Action, AnimationSet, Character, Clip, Keyframe, Pose, Transform } from './types.ts'
import type { CharacterId } from '../core/roster.ts'
import type { LifeMotion } from '../core/life-catalog.ts'

const rest = (): Transform => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })
export function sampleKeys(keys: Keyframe[], time: number): number {
  if (time <= keys[0]!.time) return keys[0]!.value
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!, a = keys[i - 1]!
    if (time <= b.time) {
      const t = (time - a.time) / (b.time - a.time)
      const smooth = t * t * (3 - 2 * t)
      return a.value + (b.value - a.value) * smooth
    }
  }
  return keys.at(-1)!.value
}
/** A pure pose evaluator. Animation does not advance world state or write saves. */
export function samplePose(character: Character, clip: Clip, elapsed: number): Pose {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw Error('INVALID_ANIMATION_TIME')
  const time = clip.loop ? elapsed % clip.duration : Math.min(elapsed, clip.duration)
  const transforms = Object.fromEntries(character.parts.map(p => [p.id, rest()]))
  for (const track of clip.tracks) transforms[track.part]![track.property] = sampleKeys(track.keys, time)
  let expression = clip.expression
  for (const key of clip.expressions ?? []) if (time >= key.time) expression = key.value
  return { transforms, expression, ended: !clip.loop && elapsed >= clip.duration }
}
export function blendPose(from: Pose, to: Pose, amount: number): Pose {
  const t = Math.min(1, Math.max(0, amount))
  const transforms = Object.fromEntries(Object.entries(to.transforms).map(([id, target]) => {
    const source = from.transforms[id] ?? rest()
    return [id, Object.fromEntries(Object.keys(target).map(key => {
      const property = key as keyof Transform
      return [key, source[property] + (target[property] - source[property]) * t]
    })) as unknown as Transform]
  }))
  return { transforms, expression: to.expression, ended: to.ended }
}
/** Explicit time ownership allows pause/resume without wall-clock catch-up. */
export class Animator {
  action: Action = 'idle'
  elapsed = 0
  private from: Pose | undefined
  private transitionElapsed = 0
  constructor(readonly character: Character, readonly animations: AnimationSet) {}
  change(action: Action): void {
    this.from = this.pose()
    this.action = action
    this.elapsed = 0
    this.transitionElapsed = 0
  }
  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('INVALID_ANIMATION_DELTA')
    this.elapsed += seconds
    this.transitionElapsed += seconds
  }
  seek(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('INVALID_ANIMATION_TIME')
    this.elapsed = seconds
    this.from = undefined
  }
  pose(): Pose {
    const clip = this.animations.actions[this.action]
    const pose = samplePose(this.character, clip, this.elapsed)
    return this.from && this.transitionElapsed < clip.transition
      ? blendPose(this.from, pose, this.transitionElapsed / clip.transition) : pose
  }
}

/**
 * Additive, finite part performances using the approved rigs. World movement remains
 * in the simulator. No whole-picture bounce/scale, textures, timers or mutable caches.
 */
export function applyLifePose(pose: Pose, _id: CharacterId, motion: LifeMotion, elapsed: number, reduced = false): void {
  if (!Number.isFinite(elapsed) || elapsed < 0) throw Error('INVALID_ANIMATION_TIME')
  if (reduced) return
  const duration = motion === 'farewell' ? 1.5 : motion === 'interrupted' ? 1.2 : 3.6
  if (elapsed >= duration) return
  const t = elapsed / duration
  const smooth = (n: number) => { const v = Math.min(1, Math.max(0, n)); return v * v * (3 - 2 * v) }
  const envelope = smooth(t / .18) * (1 - smooth((t - .76) / .24))
  const pulse = Math.sin(t * Math.PI * 4) * envelope
  const add = (part: string, property: keyof Transform, value: number) => { const transform = pose.transforms[part]; if (transform) transform[property] += value }
  switch (motion) {
    case 'whale-tail':
      add('tail-root', 'rotation', 12 * envelope); add('tail-fin', 'rotation', -18 * pulse)
      add('arm-left', 'rotation', -12 * envelope); add('head', 'rotation', 4 * envelope); break
    case 'thoughtful-note':
      add('arm-right', 'rotation', -24 * envelope); add('arm-right', 'y', -15 * envelope)
      add('head', 'rotation', 7 * envelope); add('arm-left', 'rotation', 6 * pulse); break
    case 'cloud-frame':
      add('arm-left', 'rotation', 34 * envelope); add('arm-right', 'rotation', -34 * envelope)
      add('arm-left', 'y', -18 * envelope); add('arm-right', 'y', -18 * envelope); add('head', 'rotation', -4 * pulse); break
    case 'neat-cuffs':
      add('arm-left', 'rotation', 24 * envelope); add('arm-right', 'rotation', -12 * envelope)
      add('arm-right', 'y', -12 * pulse); add('head', 'rotation', 5 * envelope); break
    case 'playful-salute':
      add('arm-right', 'rotation', -48 * envelope); add('arm-right', 'y', -16 * envelope)
      add('head', 'rotation', -8 * envelope); add('arm-left', 'rotation', 10 * pulse); break
    case 'quiet-stretch':
      add('arm-left', 'rotation', 38 * envelope); add('arm-right', 'rotation', -30 * envelope)
      add('body', 'rotation', 3 * envelope); add('head', 'rotation', -5 * envelope); break
    case 'leaf-greeting':
      add('arm-left', 'rotation', 26 * envelope); add('arm-left', 'x', 12 * envelope)
      add('arm-right', 'rotation', -8 * pulse); add('head', 'rotation', 6 * envelope); break
    case 'dance-count':
      add('arm-left', 'rotation', 18 * pulse); add('arm-right', 'rotation', -25 * envelope)
      add('head', 'rotation', 4 * pulse); add('ornament', 'rotation', 8 * pulse); break
    case 'fox-listen':
      add('head', 'rotation', -9 * envelope); add('arm-left', 'rotation', 15 * envelope)
      add('arm-left', 'y', -8 * envelope); add('back-hair', 'rotation', 2 * pulse); break
    case 'frame-story':
      add('arm-left', 'rotation', 29 * envelope); add('arm-right', 'rotation', -40 * envelope)
      add('arm-right', 'y', -22 * envelope); add('head', 'rotation', 3 * pulse); break
    case 'woolly-hug':
      add('arm-left', 'rotation', 20 * envelope); add('arm-right', 'rotation', -20 * envelope)
      add('arm-left', 'x', 8 * envelope); add('arm-right', 'x', -8 * envelope); add('head', 'y', 4 * envelope); break
    case 'feather-tip':
      add('arm-right', 'rotation', -55 * envelope); add('arm-right', 'y', -25 * envelope)
      add('head', 'rotation', 8 * envelope); add('ornament', 'rotation', 6 * pulse); break
    case 'wave':
      add('arm-right', 'rotation', (-30 + 12 * Math.sin(t * Math.PI * 8)) * envelope)
      add('arm-right', 'y', -12 * envelope); add('head', 'rotation', -3 * envelope); break
    case 'listen':
      add('head', 'rotation', 5 * envelope); add('head', 'y', 5 * pulse)
      add('arm-left', 'rotation', 8 * envelope); break
    case 'offer':
      add('arm-left', 'rotation', 21 * envelope); add('arm-right', 'rotation', -21 * envelope)
      add('arm-left', 'y', -9 * envelope); add('arm-right', 'y', -9 * envelope); add('head', 'rotation', 3 * pulse); break
    case 'point':
      add('arm-left', 'rotation', 38 * envelope); add('arm-left', 'y', -12 * envelope)
      add('head', 'rotation', -7 * envelope); add('arm-right', 'rotation', -5 * envelope); break
    case 'farewell':
      add('body', 'rotation', 3 * envelope); add('head', 'y', 12 * envelope)
      add('head', 'rotation', 6 * envelope); add('arm-right', 'rotation', -12 * envelope); break
    case 'waiting':
      add('head', 'rotation', 6 * envelope); add('arm-left', 'rotation', 5 * pulse); break
    case 'interrupted':
      add('head', 'y', -6 * envelope); add('arm-left', 'rotation', 10 * envelope)
      add('arm-right', 'rotation', -10 * envelope); break
  }
  if (envelope > .2) pose.expression = motion === 'interrupted' ? 'surprised' : motion === 'waiting' ? 'neutral' : motion === 'quiet-stretch' ? 'sleepy' : 'happy'
}
