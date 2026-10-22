import { contract } from './ui-v11-contract.ts'
export interface Preferences {
  schemaVersion: 3; theme: 'host' | 'system' | 'light' | 'dark'; textScale: number; language: 'system' | 'zh' | 'en'; reducedMotion: boolean; bubbles: boolean
  reducedTransparency: boolean; noticeReadIds: string[]; noticesInitialized: boolean
}
export const defaultPreferences: Preferences = { schemaVersion: 3, theme: 'host', textScale: 1, language: 'system', reducedMotion: false, bubbles: true, reducedTransparency: false, noticeReadIds: [], noticesInitialized: false }
export function validatePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_PREFERENCES')
  const p = value as Preferences
  if (Object.keys(p).sort().join() !== 'bubbles,language,noticeReadIds,noticesInitialized,reducedMotion,reducedTransparency,schemaVersion,textScale,theme' || p.schemaVersion !== 3
    || !(contract.typography.textScaleValues as readonly number[]).includes(p.textScale)
    || !['host', 'system', 'light', 'dark'].includes(p.theme) || !['system', 'zh', 'en'].includes(p.language)
    || typeof p.reducedMotion !== 'boolean' || typeof p.bubbles !== 'boolean' || typeof p.reducedTransparency !== 'boolean' || typeof p.noticesInitialized !== 'boolean'
    || !Array.isArray(p.noticeReadIds) || p.noticeReadIds.length > 64 || new Set(p.noticeReadIds).size !== p.noticeReadIds.length
    || p.noticeReadIds.some(id => typeof id !== 'string' || !id.length || new TextEncoder().encode(id).length > 96)) throw Error('INVALID_PREFERENCES')
  return { ...p, noticeReadIds: [...p.noticeReadIds] }
}
export function decodePreferences(value: unknown): Preferences {
  const p = value as Record<string, unknown>
  if (p?.schemaVersion !== 1 && p?.schemaVersion !== 2) return validatePreferences(value)
  const keys = p.schemaVersion === 1 ? 'bubbles,language,reducedMotion,schemaVersion,theme' : 'bubbles,language,noticeReadIds,noticesInitialized,reducedMotion,reducedTransparency,schemaVersion,theme'
  if (Object.keys(p).sort().join() !== keys || !['light','dark','system'].includes(p.theme as string)) throw Error('INVALID_PREFERENCES')
  return validatePreferences({ ...defaultPreferences, ...p, schemaVersion: 3 })
}
export const preferencesCodec = { decode: decodePreferences, validate: validatePreferences, needsUpgrade: (value: unknown) => [1,2].includes((value as { schemaVersion?: number } | null)?.schemaVersion ?? 0) }
