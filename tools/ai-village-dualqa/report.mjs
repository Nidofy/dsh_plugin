import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {root,evidence,donor,git} from './env.mjs'
const read=async p=>JSON.parse(await readFile(join(evidence,p),'utf8'))
const full=await read('browser-full.json'),cold=await read('browser-'+Array(10).fill('normal').join('-')+'.json'),unit=await read('unit-latest.json')
const distribution=values=>{const s=values.slice().sort((a,b)=>a-b);return {n:s.length,p50:s[Math.ceil(s.length*.5)-1],p95:s[Math.ceil(s.length*.95)-1],min:s[0],max:s.at(-1),values}}
const coldMs=[],firstFrame=[],longTasks=[],transferBytes=[]
for(const r of cold.results){
 const start=r.trace.find(t=>t.coldElapsedMs!==undefined),protocol=r.trace.find(t=>t.protocol),first=protocol?.protocol.messages.find(m=>m.type==='first-frame-rendered')
 if(r.status==='PASS'&&start)coldMs.push(start.coldElapsedMs)
 if(first&&start)firstFrame.push(first.at-start.startedAtInPage)
 longTasks.push(protocol?.protocol.longtasks??[]);transferBytes.push((protocol?.resources??[]).reduce((n,r)=>n+r.transferSize,0))
}
const stress=full.results.find(r=>r.case==='stress').trace.find(t=>t.cycles)
const performance={baseSHA:full.baseSHA,status:'CONTENDED / NOT_COMPARABLE',reason:'Concurrent Thread A work was not reserved/quiesced. Software Chromium only.',coldOpenToEnteredMs:distribution(coldMs),coldOpenToFirstFrameMs:distribution(firstFrame),warmSidebarReturnMs:distribution(stress.warmMs),longTasks,transferBytes,stress:{...stress,warmMs:undefined},missing:['uncontended formal baseline','hardware GPU','direct texture decode CPU duration','one-hour run (DEFERRED)']}
await writeFile(join(evidence,'PERFORMANCE.json'),JSON.stringify(performance,null,2))
const sanitize=s=>s.replaceAll(root,'<QA_ROOT>').replaceAll(root.replaceAll('\\','/'),'<QA_ROOT>').replaceAll(donor,'<DEPS_ROOT>').replaceAll(donor.replaceAll('\\','/'),'<DEPS_ROOT>')
for(const k of ['stdout','stderr','command'])if(unit[k])unit[k]=sanitize(unit[k])
await writeFile(join(evidence,'unit-latest.json'),JSON.stringify(unit,null,2))
try{const old=await read('browser-stress.json');old.status='HARNESS_CALIBRATION_SUPERSEDED';old.explanation='Initial +20 absolute listener budget had no production contract. Matched viewport samples proved +38 bounded warm retention; current test checks growth across all warm checkpoints. See browser-full.json. No assertion in production tests changed.';await writeFile(join(evidence,'harness-calibration-stress.json'),JSON.stringify(old,null,2))}catch{}
await writeFile(join(evidence,'BASELINE.json'),JSON.stringify({baseSHA:'bc230e7f662f47efb497529a276d09aad90ad4ac',qaBranch:git('branch','--show-current'),qaHeadAtRun:git('rev-parse','HEAD'),sourceArtSHA:'42ee9f46eb0b772fb556631b9a75669c9ea49edf',cachedOriginMain:git('rev-parse','origin/main'),node:process.version,platform:process.platform,arch:process.arch,sourceStatus:'ART_REVIEW; no approval changed',originalUntracked:['docs/ai-village/NEXT_FEATURES_2026-10-21.md','docs/ai-village/UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md'],A_checkpoint:'NOT_AVAILABLE_AT_HARNESS_CHECKPOINT',productionFilesModified:false},null,2))
console.log(JSON.stringify({cold:performance.coldOpenToEnteredMs,firstFrame:performance.coldOpenToFirstFrameMs,warm:{...performance.warmSidebarReturnMs,values:undefined},browser:full.results.map(r=>[r.case,r.status])},null,2))
