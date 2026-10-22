export interface Preferences {
  schemaVersion: 1; theme: 'system' | 'light' | 'dark'; language: 'system' | 'zh' | 'en'; reducedMotion: boolean; bubbles: boolean
}
export const defaultPreferences: Preferences = { schemaVersion: 1, theme: 'system', language: 'system', reducedMotion: false, bubbles: true }
export function validatePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_PREFERENCES')
  const p = value as Preferences
  if (Object.keys(p).sort().join() !== 'bubbles,language,reducedMotion,schemaVersion,theme' || p.schemaVersion !== 1
    || !['system', 'light', 'dark'].includes(p.theme) || !['system', 'zh', 'en'].includes(p.language)
    || typeof p.reducedMotion !== 'boolean' || typeof p.bubbles !== 'boolean') throw Error('INVALID_PREFERENCES')
  return { schemaVersion: 1, theme: p.theme, language: p.language, reducedMotion: p.reducedMotion, bubbles: p.bubbles }
}
