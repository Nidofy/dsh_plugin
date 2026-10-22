/** Run received B assertions, redirecting only their output paths into A evidence. */
import { registerHooks } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
const root=resolve(import.meta.dirname,'..'),[mode,label,...args]=process.argv.slice(2)
if(!['build','review','art','browser'].includes(mode)||!label||!/^[a-z0-9-]+$/.test(label))throw Error('Usage: qa-recheck.mjs build|review|art|browser evidence-label [B script arguments]')
const evidence=`docs/ai-village/entrance-parallel/integration/${label}`,target=join(root,`scripts/ai-village-dualqa-${mode}.mjs`)
const sources=[target,join(root,'tools/ai-village-dualqa/env.mjs')]
const allowed=new Set(sources.map(p=>pathToFileURL(p).href))
mkdirSync(join(root,evidence),{recursive:true})
const hashes=Object.fromEntries(sources.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),createHash('sha256').update(readFileSync(p)).digest('hex')]))
writeFileSync(join(root,evidence,`adapter-${mode}.json`),JSON.stringify({executed_by:'A',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),original_QA_source_sha256:hashes,adaptation:'Only QA output paths redirected to A integration evidence. Assertions, test inputs, tolerances and production code unchanged by adapter.',args},null,2)+'\n')
registerHooks({load(url,context,next){const r=next(url,context);if(!allowed.has(url))return r;return {...r,source:Buffer.from(r.source).toString().replaceAll('docs/ai-village/entrance-parallel/qa',evidence).replaceAll('packages/ai-village/art/QA/entrance-dual/qa',evidence+'/screenshots')}}})
process.env.DUALQA_DEPS=root
process.argv=[process.execPath,target,...args]
await import(pathToFileURL(target).href)
