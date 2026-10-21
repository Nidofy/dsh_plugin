import type { Action, AnimationSet, Character, Clip, Keyframe, Pose, Transform } from './types.ts'

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
