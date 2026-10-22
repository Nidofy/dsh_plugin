import {readFile,writeFile,mkdir,cp,symlink,lstat} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {root,donor,generated,requireTool,baseline,resolveDependency,git,sha256} from '../tools/ai-village-dualqa/env.mjs'
const {build}=await import(pathToFileURL(requireTool.resolve('tsdown')))
const review=process.argv.includes('--review'),ts=requireTool('typescript'),pkg=join(root,'packages/ai-village'),out=join(generated,review?'preview-review':'preview')
await mkdir(join(out,'lib'),{recursive:true})
try{await lstat(join(generated,'node_modules'))}catch{await symlink(join(donor,'node_modules'),join(generated,'node_modules'),'junction')}
const paths=ts.parseConfigFileTextToJson('tsconfig.base.json',await readFile(join(baseline.source,'tsconfig.base.json'),'utf8')).config.compilerOptions.paths
const alias=Object.fromEntries(Object.entries(paths).filter(([k])=>!k.includes('*')&&k.startsWith('@deepseek-ai/dsh-')).map(([k,v])=>[k,join(baseline.source,v[0])]))
alias['@nidofy/dsh-plugin-shared/durable-file']=join(root,'packages/plugin-shared/src/durable-file.ts')
if(review)alias['./entrance-art.ts']=join(pkg,'experiments/entrance-review-art.ts')
alias.zod=resolveDependency('zod')
alias['use-sync-external-store/shim/with-selector']=resolveDependency('use-sync-external-store/shim/with-selector')
const resolver={name:'dualqa-offline-dependencies',transform(code,id){if(id.replaceAll('\\','/').endsWith('/experiments/phase4-client.tsx'))return {code:code+'\nObject.assign(window,{__dualqaActions:{preferences:(patch:any)=>runtime.setPreferences(patch),hide:()=>runtime.hide(),show:()=>runtime.show()}})',map:null}},async resolveId(id,importer){
 if(id.startsWith('.')||id.startsWith('/')||/^[A-Z]:/i.test(id)||id.startsWith('node:'))return
 if(await this.resolve(id,importer,{skipSelf:true}))return
 return resolveDependency(id)
}}
const common={config:false,alias,plugins:[resolver],clean:false,dts:false}
await build({...common,entry:{index:join(pkg,'src/index.ts'),service:join(pkg,'src/host/service.ts')},outDir:join(out,'lib'),format:'esm',platform:'node',target:'es2024',deps:{alwaysBundle:[/^@deepseek-ai\/dsh-/,'@nidofy/dsh-plugin-shared/durable-file'],neverBundle:['koffi','@deepseek-ai/cordis','@deepseek-ai/schemastery']}})
await build({...common,entry:{harness:join(pkg,'experiments/phase4-host.ts')},outDir:out,format:'esm',platform:'node',target:'es2024',deps:{alwaysBundle:[/^@deepseek-ai\/dsh-/,'zod'],neverBundle:['@deepseek-ai/cordis','@deepseek-ai/schemastery']}})
await build({...common,entry:{fixture:join(pkg,'experiments/phase4-client.tsx')},outDir:out,format:'iife',platform:'browser',target:'es2022',deps:{alwaysBundle:[/./]},define:{'process.env.NODE_ENV':'"production"'},outputOptions:{entryFileNames:'fixture.js'}})
await build({...common,entry:{frame:join(pkg,'src/frame/scene.ts')},outDir:join(out,'lib'),format:'iife',platform:'browser',target:'es2022',minify:true,deps:{alwaysBundle:[/./]},outputOptions:{entryFileNames:'frame.js'}})
await cp(join(pkg,'assets'),join(out,'assets'),{recursive:true})
const original=await readFile(join(root,'scripts/ai-village-phase4-browser.mjs'),'utf8')
const markup=original.split('const html = '+String.fromCharCode(96))[1]?.split('<script>')[0]
if(!markup?.startsWith('<!doctype html>'))throw Error('Host fixture markup changed; review adapter')
const code=await readFile(join(out,'fixture.js'),'utf8')
await writeFile(join(out,'index.html'),markup+'<script>'+code.replaceAll('</script','<\\/script')+'</script></html>')
const hashes={}
for(const file of ['fixture.js','lib/index.mjs','lib/frame.js'])hashes[file]=await sha256(await readFile(join(out,file)))
await writeFile(join(out,'build.json'),JSON.stringify({head:git('rev-parse','HEAD'),dirty:git('status','--short'),hashes,official:baseline.revision,productionFilesModified:false,reviewMode:review},null,2))
console.log('DUALQA_BUILD_READY '+out)
