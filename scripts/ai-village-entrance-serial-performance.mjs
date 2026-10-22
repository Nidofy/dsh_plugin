/** Sequential local software baseline. No build or other validation is launched concurrently. */
import {cpus,freemem,totalmem,platform,arch} from 'node:os'
import {spawnSync,execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
const root=resolve(import.meta.dirname,'..'),dir=join(root,'docs/ai-village/entrance-parallel/integration/final-performance');mkdirSync(dir,{recursive:true})
const samples=[]
const snapshot=()=>cpus().map(c=>({total:Object.values(c.times).reduce((a,b)=>a+b,0),idle:c.times.idle}))
const quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]
for(let i=1;i<=10;i++){
 const before=snapshot(),freeBefore=freemem(),label=`performance-cold-${i}`
 const run=spawnSync(process.execPath,['scripts/ai-village-entrance-qa-recheck.mjs','browser',label,'normal'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000})
 writeFileSync(join(dir,`run-${i}.txt`),(run.stdout+run.stderr).trim()+'\n')
 if(run.status!==0)throw Error(`Cold sample ${i} failed: ${run.stdout} ${run.stderr}`)
 const after=snapshot(),busy=after.map((c,n)=>({total:c.total-before[n].total,busy:(c.total-before[n].total)-(c.idle-before[n].idle)}))
 const report=JSON.parse(readFileSync(join(root,'docs/ai-village/entrance-parallel/integration',label,'browser-latest.json'),'utf8')),test=report.results[0],cold=test.trace.find(t=>Number.isFinite(t.coldElapsedMs))
 if(test.status!=='PASS'||!cold)throw Error('Missing valid timing sample')
 samples.push({sample:i,coldElapsedMs:cold.coldElapsedMs,hostCpuBusyPercent:100*busy.reduce((a,c)=>a+c.busy,0)/busy.reduce((a,c)=>a+c.total,0),maxCoreBusyPercent:Math.max(...busy.map(c=>100*c.busy/c.total)),freeMemoryBefore:freeBefore,freeMemoryAfter:freemem(),evidence:`../${label}/browser-latest.json`})
 console.log(JSON.stringify(samples.at(-1)))
}
const times=samples.map(s=>s.coldElapsedMs)
const report={status:'MEASURED_SERIAL_SOFTWARE_BASELINE',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0].model,logicalCpus:cpus().length,totalMemory:totalmem()},method:'10 fresh Chromium processes, new authenticated temporary profile per run, production ART_REVIEW static fallback, one run at a time after all builds/regressions completed; wall time from open action to entrance unblocked',limits:['SwiftShader only; not hardware GPU acceptance','OS filesystem cache is not flushed','Other desktop processes are not suspended; host aggregate/max-core load recorded, cannot certify exclusive machine access','No before/after improvement or hardware SLA claim','B tool historical performanceStatus is conservative CONTENDED; this supplemental run records actual serial scheduling'],summary:{count:times.length,minMs:Math.min(...times),p50Ms:quantile(times,.5),p95Ms:quantile(times,.95),maxMs:Math.max(...times)},samples}
writeFileSync(join(dir,'PERFORMANCE.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary))
