export interface Preferences {
  schemaVersion: 2; theme: 'system' | 'light' | 'dark'; language: 'system' | 'zh' | 'en'; reducedMotion: boolean; bubbles: boolean
  reducedTransparency: boolean; noticeReadIds: string[]; noticesInitialized: boolean
}
export const defaultPreferences: Preferences = { schemaVersion: 2, theme: 'system', language: 'system', reducedMotion: false, bubbles: true, reducedTransparency: false, noticeReadIds: [], noticesInitialized: false }
export function validatePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_PREFERENCES')
  const p = value as Preferences
  if (Object.keys(p).sort().join() !== 'bubbles,language,noticeReadIds,noticesInitialized,reducedMotion,reducedTransparency,schemaVersion,theme' || p.schemaVersion !== 2
    || !['system', 'light', 'dark'].includes(p.theme) || !['system', 'zh', 'en'].includes(p.language)
    || typeof p.reducedMotion !== 'boolean' || typeof p.bubbles !== 'boolean' || typeof p.reducedTransparency !== 'boolean' || typeof p.noticesInitialized !== 'boolean'
    || !Array.isArray(p.noticeReadIds) || p.noticeReadIds.length > 64 || new Set(p.noticeReadIds).size !== p.noticeReadIds.length
    || p.noticeReadIds.some(id => typeof id !== 'string' || !id.length || new TextEncoder().encode(id).length > 96)) throw Error('INVALID_PREFERENCES')
  return { ...p, noticeReadIds: [...p.noticeReadIds] }
}
export function decodePreferences(value: unknown): Preferences {
  if ((value as { schemaVersion?: number } | null)?.schemaVersion !== 1) return validatePreferences(value)
  const p = value as Record<string, unknown>
  if (Object.keys(p).sort().join() !== 'bubbles,language,reducedMotion,schemaVersion,theme') throw Error('INVALID_PREFERENCES')
  return validatePreferences({ ...defaultPreferences, ...p, schemaVersion: 2 })
}
export const preferencesCodec = { decode: decodePreferences, validate: validatePreferences, needsUpgrade: (value: unknown) => (value as { schemaVersion?: number } | null)?.schemaVersion === 1 }
