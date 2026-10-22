import { root, generated, resolveDependency, requireTool, baseline } from './env.mjs'
import { join, resolve } from 'node:path'
import { readFileSync, existsSync, statSync } from 'node:fs'
const ts = requireTool('typescript')
const paths = ts.parseConfigFileTextToJson('tsconfig.base.json',readFileSync(join(baseline.source,'tsconfig.base.json'),'utf8')).config.compilerOptions.paths
export default {
 root, cacheDir:join(generated,'vite-cache'),
 plugins:[{name:'dualqa-offline-resolver',enforce:'pre',resolveId(id){
  if(id==='vitest')return requireTool.resolve('vitest/package.json').replace('package.json','dist/index.js').replaceAll('\\','/')
  if(id.startsWith('.') || id.startsWith('/') || /^[A-Z]:/i.test(id) || id.startsWith('node:'))return
  if(id==='@nidofy/dsh-plugin-shared/durable-file')return join(root,'packages/plugin-shared/src/durable-file.ts').replaceAll('\\','/')
  for(const [key,values] of Object.entries(paths)){
   if(key===id || key.endsWith('*')&&id.startsWith(key.slice(0,-1))){
    let path=resolve(baseline.source,values[0].replace('*',id.slice(key.length-1)))
    if(existsSync(path)&&statSync(path).isDirectory())path=join(path,'index.ts')
    if(existsSync(path))return path.replaceAll('\\','/')
   }
  }
  return resolveDependency(id)?.replaceAll('\\','/')
 },transform(code,id){
  if(id.includes('/tests/')||id.includes('\\tests\\')){const relocated=code.replaceAll(".build/ai-village-phase4/","tools/ai-village-dualqa/.generated/test-profiles/");if(relocated!==code)return {code:relocated,map:null}}

  if(!/\.[cm]?tsx?$/.test(id)||!/^\s*@[A-Za-z_$][\w$]*/m.test(code))return
  const result=ts.transpileModule(code,{fileName:id,compilerOptions:{target:ts.ScriptTarget.ES2024,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,sourceMap:true}})
  return {code:result.outputText,map:result.sourceMapText}
 }}],
 oxc:{jsx:{runtime:'automatic'}},
 test:{include:['packages/ai-village/tests/**/*.spec.{ts,tsx}'],setupFiles:['./tests/setup-dom.ts'],pool:'forks',maxWorkers:2,testTimeout:30000,hookTimeout:30000,execArgv:process.allowedNodeEnvironmentFlags.has('--webstorage')?['--no-webstorage']:[],env:{DSH_SANDBOX_OFFICIAL:baseline.source}}
}
