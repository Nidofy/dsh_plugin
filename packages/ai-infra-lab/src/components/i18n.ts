import type { BilingualText, Locale } from '../types.ts'

const LOCALE_STORAGE_KEY = 'ai-infra-lab:locale'

export function detectInitialLocale(): Locale {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') {
        return saved
      }
    }
  } catch {
    // Ignore storage restriction errors
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  return 'zh'
}

export function persistLocale(locale: Locale): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export function pickText(text: BilingualText | undefined | null, locale: Locale): string {
  if (!text) return ''
  return locale === 'zh' ? text.zh : text.en
}

export function tr(locale: Locale, zh: string, en: string): string {
  return locale === 'zh' ? zh : en
}
