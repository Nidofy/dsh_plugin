import { expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { characterIds, characterNames, approvedEntranceCharacterIds, isCharacterId } from '../src/core/roster.ts'
import { roster, resources } from '../src/definitions.ts'
import { residentAssets } from '../src/client/asset-selection.ts'
import { residentLife } from '../src/core/life-catalog.ts'
import { residentLines } from '../src/core/neighborhood-catalog.ts'
import { bellReaction } from '../src/core/dialogue.ts'
import { samplePose, applyLifePose } from '../src/art/animation.ts'
import { portraitFill } from '../src/client/entrance-state.ts'

const added = ['seedance', 'glm', 'minimax', 'llama', 'mistral'] as const
const pkg = fileURLToPath(new URL('../', import.meta.url))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
it('exposes twelve stable names while preserving the approved seven-portrait entrance progression', () => {
  expect(characterIds).toHaveLength(12)
  expect(characterIds.slice(7)).toEqual(added)
  expect(approvedEntranceCharacterIds).toEqual(['bluewhale', 'claude', 'gemini', 'gpt', 'grok', 'kimi', 'qwen'])
  expect(approvedEntranceCharacterIds.map((_, i) => portraitFill(3 / 7, i))).toEqual([1, 1, 1, 0, 0, 0, 0])
  expect(residentAssets(['bluewhale', 'claude', ...added]).size).toBe(128)
  expect(residentAssets(['bluewhale', 'claude', ...added], 'bookhouse').size).toBe(123)
  for (const id of added) { expect(isCharacterId(id)).toBe(true); expect(characterNames[id]).toBeTruthy() }
  for (const value of ['Seedance', '../glm', '__proto__', '', null]) expect(isCharacterId(value)).toBe(false)
})
it('registers every new runtime part and portrait with exact delivery bytes and complete activity closure', async () => {
  for (const id of added) {
    const manifest = JSON.parse(await readFile(join(pkg, `assets/characters/${id}/manifest.json`), 'utf8'))
    expect(manifest.approvedForRelease).toBe(true)
    expect(manifest.parts).toHaveLength(16)
    const selected = residentAssets([id]), bookhouse = residentAssets([id], 'bookhouse')
    expect(selected.size).toBe(23); expect(bookhouse.size).toBe(18)
    expect([...selected].some(key => key.startsWith('claude/') || key.startsWith('parts/'))).toBe(false)
    for (const part of manifest.parts) {
      const key = `${id}/${part.file}`, resource = resources.find(entry => entry.key === key)!
      expect(selected.has(key)).toBe(true); expect(bookhouse.has(key)).toBe(true)
      expect(resource.sha256).toBe(part.sha256)
      const bytes = await readFile(join(pkg, 'assets', resource.file))
      expect(hash(bytes)).toBe(resource.sha256); expect(bytes.length).toBe(resource.bytes)
      // Buffer.equals still compares every byte, without walking millions of numeric properties.
      expect(bytes.equals(await readFile(join(pkg, 'art/deliverables/roster-expansion/characters', id, part.file)))).toBe(true)
    }
    const portrait = resources.find(entry => entry.key === `portraits/${id}.png`)!
    expect(hash(await readFile(join(pkg, 'assets', portrait.file)))).toBe(portrait.sha256)
    for (const part of roster[id]!.character.parts) for (const file of [part.file, ...Object.values(part.expressions ?? {})].filter(Boolean)) expect(selected.has(file!)).toBe(true)
  }
})
it('provides distinct bilingual voices and articulated signatures for each new resident', () => {
  const descriptions = new Set<string>(), signatures = new Set<string>()
  for (const id of added) {
    const life = residentLife[id], art = roster[id]!
    descriptions.add(life.description.zh); signatures.add(life.signature)
    expect(residentLines[id]).toHaveLength(12)
    for (const line of [life.description, life.idle, life.greeting, life.watching, life.farewell, ...residentLines[id]]) {
      expect(line.zh).toMatch(/[\u4e00-\u9fff]/); expect(line.en).toMatch(/[a-z]/i)
    }
    expect(bellReaction(id, 'zh')).toMatch(/[\u4e00-\u9fff]/); expect(bellReaction(id, 'en')).toMatch(/[a-z]/i)
    const base = samplePose(art.character, art.animations.actions.idle, 0), pose = structuredClone(base)
    applyLifePose(pose, id, life.signature, 1.1)
    expect(pose.transforms).not.toEqual(base.transforms)
    for (const part of ['root', 'leg-left', 'leg-right']) expect(pose.transforms[part]).toEqual(base.transforms[part])
    const reduced = structuredClone(base); applyLifePose(reduced, id, life.signature, 1.1, true)
    expect(reduced).toEqual(base)
  }
  expect(descriptions.size).toBe(5); expect(signatures.size).toBe(5)
})
