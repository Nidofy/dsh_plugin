import {readFile,writeFile,mkdir,access} from 'node:fs/promises'
import {join,resolve,basename} from 'node:path'
import {execFileSync} from 'node:child_process'
import {root,git,evidence} from '../tools/ai-village-dualqa/env.mjs'
const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d
const checkpoint=JSON.parse(await readFile(resolve(get('--checkpoint',join(root,'../AI_Village_Astra_DualTrack_20261022/coord/A_CHECKPOINT.json'))),'utf8'))
if(checkpoint.thread!=='A'||!/^[a-f0-9]{40}$/.test(checkpoint.head_sha)||!/^[a-f0-9]{40}$/.test(checkpoint.base_sha))throw Error('Invalid A checkpoint')
const a=checkpoint.head_sha,qa=get('--qa',git('rev-parse','HEAD')),base=checkpoint.base_sha
if(!/^[a-f0-9]{40}$/.test(qa))throw Error('Supply full QA SHA')
for(const sha of [a,qa,base])git('cat-file','-e',sha+'^{commit}')
git('merge-base','--is-ancestor',a,'refs/heads/codex/entrance-integration')
git('merge-base','--is-ancestor',base,qa)
const commits=git('rev-list','--reverse',base+'..'+qa).split('\n').filter(Boolean)
const allowed=p=>/^packages\/ai-village\/tests\/dualqa-[^/]+\.spec\.ts$/.test(p)||/^scripts\/ai-village-dualqa-[^/]+\.mjs$/.test(p)||['tools/ai-village-dualqa/','docs/ai-village/entrance-parallel/qa/','packages/ai-village/art/QA/entrance-dual/qa/'].some(prefix=>p.startsWith(prefix))
if(!commits.length)throw Error('No committed QA changes')
for(const commit of commits){
 const files=git('diff-tree','--no-commit-id','--name-only','-r',commit).split('\n').filter(Boolean)
 if(!files.length||files.some(p=>!allowed(p)))throw Error('Non-QA or merge commit rejected: '+commit)
}
const evaluation=resolve(root,'..','dsh_plugin-entrance-eval-'+a.slice(0,12)+'-'+qa.slice(0,8))
try{await access(evaluation);throw Error('Evaluation path already exists; reuse manually after inspection, never overwrite')}catch(e){if(e.code!=='ENOENT')throw e}
const plan={A_SHA:a,QA_SHA:qa,base,qaOnlyCommits:commits,evaluationDirectory:basename(evaluation),status:args.includes('--create')?'PREPARING':'DRY_RUN',DSH_HOME:'tools/ai-village-dualqa/.generated/profile-eval',productionOwnership:'A; no production changes permitted'}
await mkdir(evidence,{recursive:true})
if(args.includes('--create')){
 git('worktree','add','--detach',evaluation,a)
 execFileSync('git',['-c','safe.directory=*','cherry-pick','--no-commit',...commits],{cwd:evaluation,stdio:'inherit',windowsHide:true})
 plan.status='EVALUATION_READY'
 // Keep one isolated identity for all commands in the evaluation checkout.
 plan.commands=['node scripts/ai-village-dualqa-test.mjs','node scripts/ai-village-dualqa-build.mjs','node scripts/ai-village-dualqa-browser.mjs']
}
await writeFile(join(evidence,'EVALUATION_PLAN.json'),JSON.stringify(plan,null,2))
console.log(JSON.stringify(plan,null,2))
