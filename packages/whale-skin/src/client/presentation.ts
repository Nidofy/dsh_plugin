import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
export interface SkinPreferences { enabled: boolean; decorations: boolean; strength: number }
export const defaults: SkinPreferences = { enabled:false,decorations:true,strength:.18 }
export const storageKey = 'nidofy-whale-skin:v1'
export function decode(value: unknown): SkinPreferences {
  if (!value || typeof value!=='object') return {...defaults}
  const v=value as Partial<SkinPreferences>
  return {enabled:v.enabled===true,decorations:v.decorations!==false,strength:typeof v.strength==='number' && Number.isFinite(v.strength)?Math.max(0,Math.min(.4,v.strength)):defaults.strength}
}
export const tokens: ThemeTokenOverrides = {
  '--dsw-alias-bg-base':{light:'#e8eef9',dark:'#101a2d'},
  '--dsw-alias-bg-layer-1':{light:'#f3f6fc',dark:'#17243a'},
  '--dsw-alias-bg-layer-2':{light:'#eaf0fa',dark:'#20304a'},
  '--dsw-alias-bg-overlay':{light:'#f7f9fd',dark:'#1c2b44'},
  '--dsw-alias-label-primary':{light:'#172b4d',dark:'#edf3ff'},
  '--dsw-alias-label-secondary':{light:'#536581',dark:'#b0c2de'},
  '--dsw-alias-brand-primary':{light:'#426bb1',dark:'#91b9f8'},
  '--dsw-alias-border-l1':{light:'#dce4f1',dark:'#293b56'},
  '--dsw-alias-border-l2':{light:'#c8d6eb',dark:'#405675'},
  '--dsw-specific-sidebar-fill':{light:'#dde7f7',dark:'#142139'},
}
export const skinCss = `
body[data-nidofy-whale-skin] [data-conversation-content]{position:relative;isolation:isolate}
body[data-nidofy-whale-skin] [data-conversation-content]::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:url('/api/nidofy-whale-skin/day.webp') center/cover;opacity:var(--nidofy-whale-strength,.18);border-radius:16px}
body[data-nidofy-whale-skin][data-ds-dark-theme] [data-conversation-content]::before{background-image:url('/api/nidofy-whale-skin/night.webp')}
body[data-nidofy-whale-skin=decorated] [data-conversation-content]::after{content:"";position:absolute;right:24px;bottom:12px;width:100px;height:140px;z-index:-1;pointer-events:none;background:url('/api/nidofy-whale-skin/companion.webp') center/contain no-repeat;opacity:.32}
@media(max-width:900px){body[data-nidofy-whale-skin] [data-conversation-content]::after{display:none}}
@media(prefers-reduced-transparency:reduce){body[data-nidofy-whale-skin] [data-conversation-content]::before,body[data-nidofy-whale-skin] [data-conversation-content]::after{display:none}}
`
