/** One explicit gate; --full runs local CPU/official hosts, never a paid model by default. */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
const base = resolve(import.meta.dirname, '..')
const full = process.argv.includes('--full')
const live = process.argv.includes('--live-tutor')
if (live && !full) throw Error('--live-tutor requires --full and authorization to use the configured model')
if (full && !process.env.NEURAL_DESKTOP_EXE) throw Error('Full gate requires NEURAL_DESKTOP_EXE pointing to official rc.5')
const node = process.execPath
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const steps = [
  ['strict build and unit/regression tests', npm, ['test']],
  ['candidate package', npm, ['pack', '--ignore-scripts', '--cache', '.build/npm-cache']],
  ['official empty-cache offline installation', node, ['tests/install-check.mjs']],
  ['packaged historical upgrade chain', node, ['tests/upgrade-020.mjs']],
]
if (full) steps.push(
  ['all reference and broken-starter CPU runs', node, ['--experimental-transform-types', 'tests/runner-real.ts']],
  ['new protocol numerical and maximum-budget CPU tests', node, ['--experimental-transform-types', 'tests/numeric-060-real.ts']],
  ['legacy adversarial isolation', node, ['--experimental-transform-types', 'tests/runner-adversarial.ts']],
  ['cancellation/restart cleanup lifecycle', node, ['--experimental-transform-types', 'tests/runner-lifecycle.ts']],
  ['official Web existing learning flow', node, ['tests/ui-official-session.mjs'], {NEURAL_060_MODE:'0',NEURAL_LIVE_TUTOR:'0',NEURAL_UI_CPU:'1'}],
  ['official Web 0.6 debugger/groups/themes', node, ['tests/ui-official-session.mjs'], {NEURAL_060_MODE:'1',NEURAL_LIVE_TUTOR:live?'1':'0'}],
  ['official Electron isolated profile and restart', node, ['tests/native-022.mjs']],
)
const report = {startedAt:new Date().toISOString(),full,liveTutorRequested:live,steps:[],status:'running'}
await mkdir(join(base,'.build'),{recursive:true})
const path=join(base,'.build/gate060.json')
try {
  for(const [name,command,args,extra] of steps) {
    console.log('GATE '+name)
    const started=Date.now()
    const code=await new Promise((resolve,reject)=>{
      const npmCli = command===npm ? process.env.npm_execpath : undefined
      const child=spawn(npmCli ? node : command,npmCli ? [npmCli,...args] : args,{cwd:base,env:{...process.env,...extra},stdio:'inherit',windowsHide:true,shell:!npmCli&&command===npm&&process.platform==='win32'})
      child.once('error',reject);child.once('exit',code=>resolve(code))
    })
    report.steps.push({name,code,elapsedMs:Date.now()-started})
    await writeFile(path,JSON.stringify(report,null,2))
    if(code!==0)throw Error('Gate failed: '+name)
  }
  report.status='passed'
} catch(error) {report.status='failed';report.error=String(error);process.exitCode=1}
finally {report.finishedAt=new Date().toISOString();await writeFile(path,JSON.stringify(report,null,2))}
