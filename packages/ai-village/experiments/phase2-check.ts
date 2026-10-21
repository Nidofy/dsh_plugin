import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Animator, samplePose } from '../src/art/animation.ts'
import type { AnimationSet, Character } from '../src/art/types.ts'
const root = process.argv[2]!
const character = JSON.parse(await readFile(join(root, 'character.json'), 'utf8')) as Character
const animations = JSON.parse(await readFile(join(root, 'animations.json'), 'utf8')) as AnimationSet
const ids = new Set(character.parts.map(p => p.id))
assert.equal(ids.size, character.parts.length)
for (const part of character.parts) {
  assert.equal(part.mirror, 'never')
  assert.ok([...part.pivot, ...part.offset, ...part.size].every(Number.isFinite))
  if (part.parent) assert.ok(ids.has(part.parent))
  let parent = part.parent
  const visited = new Set([part.id])
  while (parent) {
    assert.ok(!visited.has(parent), 'Cyclic part hierarchy')
    visited.add(parent)
    parent = character.parts.find(p => p.id === parent)!.parent
  }
}
for (const clip of Object.values(animations.actions)) {
  assert.ok(clip.duration > 0 && clip.transition >= 0)
  const tracks = new Set<string>()
  for (const track of clip.tracks) {
    assert.ok(ids.has(track.part))
    const key = track.part + ':' + track.property
    assert.ok(!tracks.has(key)); tracks.add(key)
    assert.ok(track.keys.length >= 2)
    assert.equal(track.keys[0]!.time, 0)
    assert.equal(track.keys.at(-1)!.time, clip.duration)
    for (let i = 0; i < track.keys.length; i++) {
      assert.ok(Number.isFinite(track.keys[i]!.value))
      if (i) assert.ok(track.keys[i]!.time > track.keys[i - 1]!.time)
    }
    if (clip.loop) assert.equal(track.keys[0]!.value, track.keys.at(-1)!.value, 'Loop seam')
  }
  for (const time of [0, clip.duration / 2, clip.duration, clip.duration * 10]) {
    const pose = samplePose(character, clip, time)
    assert.ok(Object.values(pose.transforms).every(t => Object.values(t).every(Number.isFinite)))
  }
}
const animator = new Animator(character, animations)
animator.change('walk'); animator.seek(0)
const first = animator.pose()
animator.advance(.4)
const second = animator.pose()
assert.notEqual(first.transforms['leg-left']!.rotation, second.transforms['leg-left']!.rotation)
assert.equal(first.transforms['leg-left']!.rotation, -first.transforms['leg-right']!.rotation)
const beforeSwitch = animator.pose()
animator.change('dragging')
assert.deepEqual(animator.pose().transforms, beforeSwitch.transforms, 'Transition starts at prior pose')
animator.advance(2)
assert.equal(animator.pose().expression, 'surprised')
animator.change('put_down'); animator.seek(10)
assert.equal(animator.pose().ended, true)
assert.equal(animator.pose().transforms.root!.y, 0)
assert.equal(animator.pose().transforms.body!.scaleY, 1)
assert.throws(() => animator.advance(NaN), /INVALID_ANIMATION_DELTA/)
assert.throws(() => animator.seek(-1), /INVALID_ANIMATION_TIME/)
console.log(JSON.stringify({ passed: true, checks: ['acyclic hierarchy and finite anchors', 'animation keys and loop seams',
  'independent alternating legs', 'transition continuity', 'pickup expression', 'put-down settles', 'invalid time refused'] }))
