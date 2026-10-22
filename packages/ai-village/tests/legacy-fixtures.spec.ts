import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { actors, validateWorld, type Scene } from '../src/core/world.ts'
import { migrateGeometryProbe, candidateScene } from '../experiments/content-ui/scene.ts'
const read = (file: string) => readFileSync(new URL('./fixtures/legacy/' + file, import.meta.url))
const scene = JSON.parse(read('scene-v1.json').toString()) as Scene
const manifest = JSON.parse(read('manifest.json').toString()) as { file: string; sha256: string }[]
describe('exact historical snapshot bytes', () => {
  for (const version of [1, 2, 3]) it(`decodes schema ${version} and probes the new geometry`, () => {
    const file = `saved-schema${version}.json`, before = read(file), saved = JSON.parse(before.toString())
    expect(createHash('sha256').update(before).digest('hex')).toBe(manifest.find(r => r.file === file)!.sha256)
    const world = validateWorld(saved.world, scene), migrated = migrateGeometryProbe(saved.world)
    expect(actors(migrated).map(a => a.id).sort()).toEqual(actors(world).map(a => a.id).sort())
    expect(migrated.actor.id).toBe(world.actor.id)
    expect(migrated.rng).toBe(world.rng); expect(migrated.ticks).toBe(world.ticks)
    expect(validateWorld(migrated, candidateScene)).toEqual(migrated)
    expect(read(file)).toEqual(before)
  })
  it('defaults absent facing only for the original schema 1, not malformed new snapshots', () => {
    const original = JSON.parse(read('saved-schema1.json').toString()).world
    expect(original.actor.facing).toBeUndefined()
    expect(validateWorld(original, scene).actor.facing).toBe('right')
    expect(() => validateWorld({ ...original, schemaVersion: 2, companions: [] }, scene)).toThrow('INVALID_WORLD')
    original.actor.facing = 'up'
    expect(() => validateWorld(original, scene)).toThrow('INVALID_WORLD')
  })
  it('keeps the frozen scene checksum and refuses unknown versions', () => {
    expect(createHash('sha256').update(read('scene-v1.json')).digest('hex')).toBe(manifest.find(r => r.file === 'scene-v1.json')!.sha256)
    const old = JSON.parse(read('saved-schema3.json').toString()).world
    expect(() => validateWorld({ ...old, schemaVersion: 99 }, scene)).toThrow('INVALID_WORLD')
    expect(() => validateWorld({ ...old, sceneVersion: 99 }, scene)).toThrow('INVALID_WORLD')
  })
})
