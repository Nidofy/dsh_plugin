import {join} from 'node:path'
import {readdir,writeFile} from 'node:fs/promises'
import {root,donor,requireTool,evidence} from '../tools/ai-village-dualqa/env.mjs'
const ts=requireTool('typescript'),dir=join(root,'packages/ai-village/tests')
const files=(await readdir(dir)).filter(n=>/^dualqa-.*\.spec\.ts$/.test(n)).map(n=>join(dir,n))
const options={target:ts.ScriptTarget.ES2024,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true,typeRoots:[join(donor,'node_modules/@types')],types:['node']}
const host=ts.createCompilerHost(options)
host.resolveModuleNames=(names,file)=>names.map(name=>{
 if(name==='vitest')return {resolvedFileName:requireTool.resolve('vitest/package.json').replace('package.json','dist/index.d.ts'),extension:ts.Extension.Dts}
 if(name==='@nidofy/dsh-plugin-shared/durable-file')return {resolvedFileName:join(root,'packages/plugin-shared/src/durable-file.ts'),extension:ts.Extension.Ts}
 return ts.resolveModuleName(name,file,options,ts.sys).resolvedModule??ts.resolveModuleName(name,file.replace(root,donor),options,ts.sys).resolvedModule
})
const program=ts.createProgram(files,options,host)
const diagnostics=[...program.getOptionsDiagnostics(),...program.getGlobalDiagnostics(),...files.flatMap(f=>[...program.getSyntacticDiagnostics(program.getSourceFile(f)),...program.getSemanticDiagnostics(program.getSourceFile(f))])]
const output=ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=>'\n'})
console.log(output||'QA strict TypeScript PASS')
await writeFile(join(evidence,'typecheck.json'),JSON.stringify({status:diagnostics.length?'FAIL':'PASS',scope:'New dualqa test files; imported types resolved, not a full production typecheck',files:files.map(f=>f.slice(root.length+1)),diagnostics:output.replaceAll(root,'<QA_ROOT>').replaceAll(donor,'<DEPS_ROOT>')},null,2))
if(diagnostics.length)process.exitCode=1
