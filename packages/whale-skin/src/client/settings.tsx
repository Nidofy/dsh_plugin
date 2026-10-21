import { Button, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import { defaults, type SkinPreferences } from './presentation.ts'
export function SkinSettings({state,update,error,zh}:{state:SkinPreferences;update(value:Partial<SkinPreferences>):void;error:string;zh:boolean}) {
  const t=(cn:string,en:string)=>zh?cn:en
  const row={display:'flex',justifyContent:'space-between',alignItems:'center',gap:20} as const
  return <section style={{display:'grid',gap:22,color:'var(--dsw-alias-label-primary)'}}>
    <div style={row}><div><strong>{t('鲸屿 · 深海蓝','Whale Island · Deep blue')}</strong><p style={{color:'var(--dsw-alias-label-secondary)'}}>{t('随官方浅色 / 深色外观切换，即时生效。','Follows official light / dark appearance. Changes apply immediately.')}</p></div>
      <Switch label={t('启用鲸屿皮肤','Enable Whale Island skin')} checked={state.enabled} onChange={enabled=>update({enabled})}/></div>
    <div style={{height:160,borderRadius:12,overflow:'hidden',display:'grid',gridTemplateColumns:'1fr 1fr'}}>
      <img src="/api/nidofy-whale-skin/day.webp" alt={t('浅色预览','Light preview')} style={{width:'100%',height:160,objectFit:'cover'}}/>
      <img src="/api/nidofy-whale-skin/night.webp" alt={t('深色预览','Dark preview')} style={{width:'100%',height:160,objectFit:'cover'}}/>
    </div>
    <div style={row}><span>{t('鲸鱼娘装饰','Whale companion decoration')}</span><Switch label={t('鲸鱼娘装饰','Whale companion decoration')} checked={state.decorations} onChange={decorations=>update({decorations})}/></div>
    <label style={{display:'grid',gap:8}}>{t('背景浓度','Background strength')} · {Math.round(state.strength*100)}%
      <input aria-label={t('背景浓度','Background strength')} type="range" min="0" max=".4" step=".01" value={state.strength} onChange={e=>update({strength:Number(e.target.value)})}/></label>
    <Button onClick={()=>update(defaults)}>{t('恢复官方外观','Restore official appearance')}</Button>
    {error && <p role="alert">{error}</p>}
    <p style={{fontSize:12,color:'var(--dsw-alias-label-secondary)',lineHeight:1.7}}>{t('参考 dsh-deep-whale。素材署名：上善、ZipZipPipe、Small-tailqwq；素材遵循 CC BY-NC-SA 4.0。','Inspired by dsh-deep-whale. Artwork: 上善, ZipZipPipe, Small-tailqwq; CC BY-NC-SA 4.0.')} <a style={{color:'inherit'}} href="https://github.com/Nidofy/dsh-deep-whale" target="_blank" rel="noreferrer">{t('来源与许可','Source and license')}</a></p>
  </section>
}
