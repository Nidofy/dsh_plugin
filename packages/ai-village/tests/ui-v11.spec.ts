import { expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { contract, uiMetrics } from '../src/client/ui-contract.ts'
import { initialPresentation, presentationReducer as reduce } from '../src/client/ui-state.ts'
import { defaultPreferences, decodePreferences, validatePreferences } from '../src/core/preferences.ts'
import { DiagnosticTrace } from '../src/client/diagnostic-trace.ts'
import { recoveryCode, canRecover } from '../src/client/recovery-policy.ts'
import { HostRequestError } from '../src/client/json-response.ts'
it('matches the complete frozen contract, with compact bounded cards and DPR-independent typography',async()=>{
 expect(contract).toEqual(JSON.parse(await readFile('docs/ai-village/ui-v1.1/ui-contract.json','utf8')))
 expect(uiMetrics(340,720,1)).toMatchObject({quickWidth:316,quickHeight:158,body:13,title:15,secondary:12})
 expect(uiMetrics(320,360,1)).toMatchObject({quickWidth:248,quickHeight:128})
 expect(uiMetrics(580,720,1)).toMatchObject({body:14,title:16});expect(uiMetrics(1080,760,1)).toMatchObject({body:15,title:18})
 for(const scale of contract.typography.textScaleValues) for(const [w,h] of [[320,360],[340,720],[580,720],[1080,760]]){const m=uiMetrics(w!,h!,scale);expect(m.body).toBeGreaterThanOrEqual(12);expect(m.secondary).toBeGreaterThanOrEqual(12);expect(m.settingsHeight).toBeLessThanOrEqual(h!*.42)}
})
it('preserves full legacy preference values and read ids, rejecting unknown formats and text factors',()=>{
 const {textScale,...base}=defaultPreferences
 for(const theme of ['system','light','dark']){const old={...base,schemaVersion:2,theme,noticeReadIds:['first-fact'],noticesInitialized:true};expect(decodePreferences(old)).toEqual({...old,schemaVersion:3,textScale:1})}
 for(const textScale of [0,1.1,3,NaN,'1'])expect(()=>validatePreferences({...defaultPreferences,textScale})).toThrow()
 expect(()=>decodePreferences({...base,schemaVersion:2,theme:'host'})).toThrow()
 expect(defaultPreferences.theme).toBe('host')
})
it('restores source route, scroll, target and focus without recording world operations, bounded at eight',()=>{
 let p=reduce(initialPresentation(),{type:'tab',tab:'residents'})
 p=reduce(p,{type:'push',patch:{page:'activities',residentTarget:'claude'}});p.scrollTop=132;p.focusKey='小院设置'
 const before=structuredClone(p)
 p=reduce(p,{type:'overlay',overlay:'settings'});p=reduce(p,{type:'push',patch:{page:'appearance'}})
 p=reduce(reduce(p,{type:'back'}),{type:'back'});expect(p).toEqual(before)
 for(let i=0;i<20;i++)p=reduce(p,{type:'push',patch:{page:'appearance'}})
 expect(p.history).toHaveLength(8);p=reduce(p,{type:'tab',tab:'decor'});expect(p.history).toEqual([]);expect(p.page).toBe('quick')
 p=reduce(p,{type:'overlay',overlay:'more'});p=reduce(p,{type:'overlay',overlay:'settings'});p=reduce(p,{type:'back'});expect(p.overlay).toBe('more')
 p=reduce(p,{type:'close'});expect(p.overlay).toBeNull();expect(p.drawer).toBe('closed');expect(p.history).toEqual([])
})
it('only retries controlled sources and bounds a closed-field diagnostic trace',()=>{
 expect(canRecover(recoveryCode(new TypeError('secret'),'heartbeat'))).toBe(true)
 expect(canRecover(recoveryCode(new Error('unknown')))).toBe(false)
 expect(canRecover(recoveryCode(new HostRequestError('REQUEST_FAILED',503),'heartbeat'))).toBe(true)
 expect(canRecover(recoveryCode(new HostRequestError('OWNER_LOST',409),'heartbeat'))).toBe(false)
 const trace=new DiagnosticTrace();for(let i=0;i<300;i++)trace.record({reasons:['user','hidden'],code:'token=secret',connected:true,frameReady:false,receipt:'unknown',ticks:i})
 const data=trace.export();expect(JSON.parse(data)).toHaveLength(200);expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(32768);expect(data).not.toContain('secret')
})
