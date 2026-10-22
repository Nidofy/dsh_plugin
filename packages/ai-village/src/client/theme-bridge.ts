import { useEffect, useState } from 'react'
import type { Preferences } from '../core/preferences.ts'
export function readTheme(preference: Preferences['theme']): { mode: 'light' | 'dark'; source: string } {
  if (preference === 'light' || preference === 'dark') return { mode: preference, source: 'preference' }
  if (preference === 'host') {
    // Official 0.2.1-rc.2 ThemePresenter publishes these stable DOM markers.
    const scheme = document.documentElement.style.colorScheme
    if (scheme === 'light' || scheme === 'dark') return { mode: scheme, source: 'host-color-scheme' }
    if (document.body.hasAttribute('data-ds-dark-theme')) return { mode: 'dark', source: 'host-marker' }
  }
  return { mode: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', source: preference === 'host' ? 'host-unavailable-system-fallback' : 'system' }
}
export function useVillageTheme(preference: Preferences['theme']) {
  const [theme,setTheme] = useState(()=>readTheme(preference))
  useEffect(()=>{const update=()=>setTheme(readTheme(preference)), media=window.matchMedia('(prefers-color-scheme: dark)'), observer=new MutationObserver(update)
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['style']});observer.observe(document.body,{attributes:true,attributeFilter:['data-ds-dark-theme']});media.addEventListener('change',update);update()
    return()=>{observer.disconnect();media.removeEventListener('change',update)}
  },[preference]);return theme
}
