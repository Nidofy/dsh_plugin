import { expect, it } from 'vitest'
import { defaultPreferences, validatePreferences } from '../src/core/preferences.ts'
import { villageTime, bellReaction } from '../src/core/dialogue.ts'
import { characterIds } from '../src/core/roster.ts'
it('bounds profile preferences and rejects game data or future schemas', () => {
  expect(validatePreferences(defaultPreferences)).toEqual(defaultPreferences)
  for (const patch of [{ schemaVersion: 2 }, { theme: 'night' }, { language: 'script' }, { bubbles: 1 }, { reward: true }])
    expect(() => validatePreferences({ ...defaultPreferences, ...patch })).toThrow('INVALID_PREFERENCES')
})
it('derives a fixed 30-minute day without mutating simulation state, with seven bilingual reactions', () => {
  expect(villageTime(0)).toEqual({ day: 1, hour: 14, minute: 0 })
  expect(villageTime(54000)).toEqual({ day: 2, hour: 14, minute: 0 })
  for (const language of ['zh', 'en'] as const) {
    const lines = characterIds.map(id => bellReaction(id, language))
    expect(new Set(lines).size).toBe(7)
    expect(lines.every(line => line.length < 120)).toBe(true)
  }
})
