import { PanelShell } from './PanelShell.tsx'
import { contract } from './ui-contract.ts'
import type { VillageRuntime } from './runtime.ts'
export function SettingsPanel({runtime:r,cn}:{runtime:VillageRuntime;cn:boolean;close?:()=>void}) {
 const t=(a:string,b:string)=>cn?a:b,p=r.preferences,page=r.presentation.page,locked=r.preferencesSaving||!!r.error
 const groups=[['appearance',t('外观与显示','Appearance and display')],['controls',t('交互与视角','Controls and view')],['status',t('小院状态','Courtyard status')]] as const
 const exportTrace=()=>{const url=URL.createObjectURL(new Blob([r.diagnostics.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='ai-village-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <PanelShell runtime={r} cn={cn} title={groups.find(g=>g[0]===page)?.[1]??t('小院设置','Courtyard settings')} className="village-settings">
 {page==='quick'&&groups.map(([id,label])=><button key={id} onClick={()=>r.present({type:'push',patch:{page:id}})}>{label}</button>)}
 {page==='appearance'&&<>
 <label>{t('界面主题','Theme')}<select aria-label={t('界面主题','Theme')} value={p.theme} disabled={locked} onChange={e=>void r.setPreferences({theme:e.target.value as typeof p.theme})}><option value="host">{t('跟随 DSH','Follow DSH')}</option><option value="system">{t('跟随系统','System')}</option><option value="light">{t('浅色','Light')}</option><option value="dark">{t('深色','Dark')}</option></select></label>
 <label>{t('文字大小','Text size')}<select aria-label={t('文字大小','Text size')} value={p.textScale} disabled={locked} onChange={e=>void r.setPreferences({textScale:Number(e.target.value)})}>{contract.typography.textScaleValues.map(v=><option key={v} value={v}>{Math.round(v*100)}%</option>)}</select></label>
 <label>{t('语言','Language')}<select aria-label={t('语言','Language')} value={p.language} disabled={locked} onChange={e=>void r.setPreferences({language:e.target.value as typeof p.language})}><option value="system">{t('跟随 DSH','Follow DSH')}</option><option value="zh">中文</option><option value="en">English</option></select></label>
 {(['reducedMotion','reducedTransparency','bubbles'] as const).map((id,i)=><label key={id}><input type="checkbox" checked={p[id]} disabled={locked} onChange={e=>void r.setPreferences({[id]:e.target.checked})}/>{[t('减少动态','Reduce motion'),t('减少透明效果','Reduce transparency'),t('显示对话气泡','Show speech bubbles')][i]}</label>)}
 {r.preferencesSaving&&<p role="status">{t('设置保存中…','Saving preferences…')}</p>}{r.error&&<p role="status">{t('设置尚未确认，请重新读取核对。','Preferences unconfirmed. Read again to verify.')}</p>}
 </>}
 {page==='controls'&&<><button onClick={()=>r.resetCamera()}>{t('恢复全景','Reset view')}</button><p>{t('滚轮缩放，拖动空地平移。轻点居民选中，再点空地让她散步；也可拖到活动位安排日常。地图中选择地点后点“前往”一起出发。Esc 逐层返回，在场景中可停止散步。','Wheel to zoom; drag empty ground to pan. Select a resident, then tap the ground to walk, or drag to a seat for an activity. Select a place on the map and choose Go to travel together. Escape returns one level, or stops a walk in the scene.')}</p></>}
 {page==='status'&&<><p>{r.error?t('小院暂时无法继续，请核对连接或保存状态。','The courtyard needs a connection or save check.'):r.controller?.world.userPaused?t('已暂停，点击继续恢复。','Paused. Select Resume to continue.'):t('小院一切如常。','All is well in the courtyard.')}</p>
 {r.retentionWarning&&<p>{t('旧快照清理需要检查，已保存数据仍保留。','Snapshot cleanup needs attention; saved data is retained.')}</p>}
 <details><summary>{t('诊断与恢复','Diagnostics and recovery')}</summary><p>{[...r.reasons].join(' / ')} · r{r.revision} · {r.saveReceipt.status} · {r.errorCode}</p><p>{t('材质回退','Material fallback')}：{r.softwareRendering?'software-renderer':p.reducedTransparency?'reduced-transparency':'auto'}</p><button onClick={exportTrace}>{t('导出诊断','Export diagnostics')}</button><button onClick={()=>void r.checkRecovery()}>{t('重新核对连接与保存','Check connection and save')}</button><button onClick={()=>void r.recover()}>{t('恢复上一版小院','Restore previous courtyard')}</button><button onClick={()=>void r.recoverPreferences()}>{t('恢复上一版设置','Restore previous preferences')}</button></details></>}
 </PanelShell>
}
