import { contract, uiMetrics } from './ui-contract.ts'
export function uiVariables(width:number,height:number,textScale:number,mode:'light'|'dark',environment:string) {
  const m=uiMetrics(width,height,textScale), p=contract.palette[mode]
  const values:Record<string,string>={ '--ink':p.ink,'--muted':p.secondary,'--accent':p.accent,'--solid':`rgb(${p.tintRGB.join(',')})`,'--glass':`rgba(${p.tintRGB.join(',')},${p.surfaceAlpha})`, '--hud-ink':environment==='twilight'?'#FFF6EA':'#342E28','--hud-halo':environment==='twilight'?'#342e28aa':'#fff6eaaa' }
  for(const [key,value] of Object.entries(m)) if(typeof value==='number') values['--'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=`${value}px`
  return values
}
