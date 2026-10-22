import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { root, generated, evidence, requireTool, git } from '../tools/ai-village-dualqa/env.mjs'
await mkdir(join(generated,'test-profiles'),{recursive:true});await mkdir(evidence,{recursive:true})
const selected=process.argv.slice(2),defaults=['dualqa-art-contract.spec.ts','dualqa-runtime.spec.ts','dualqa-protocol.spec.ts','entrance.spec.ts','frame-bridge.client.spec.ts','runtime.client.spec.ts','save-transaction.spec.ts','retention.spec.ts'].map(n=>'packages/ai-village/tests/'+n)
const args=['run','--config','tools/ai-village-dualqa/vitest.config.mjs',...(selected.length?selected:defaults)]
const result=spawnSync(process.execPath,[join(dirname(requireTool.resolve('vitest/package.json')),'vitest.mjs'),...args],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,DSH_HOME:join(generated,'profile-unit')},maxBuffer:16*1024*1024})
console.log(result.stdout);console.error(result.stderr)
await writeFile(join(evidence,'unit-latest.json'),JSON.stringify({sha:git('rev-parse','HEAD'),command:['node',...process.argv.slice(1)].join(' '),status:result.status===0?'PASS':'FAIL',exitCode:result.status,stdout:result.stdout,stderr:result.stderr},null,2))
process.exitCode=result.status??1
