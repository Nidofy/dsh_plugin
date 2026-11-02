import {createServer} from 'node:http'
import {mkdir,readFile,writeFile,readdir,mkdtemp} from 'node:fs/promises'
import {resolve,join,extname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
import ts from 'typescript'
import {Engine,handleRequest} from '../lib/index.js'
export async function serve(){
 const base=resolve(import.meta.dirname,'..'),repo=resolve(base,'../../../..'),source=resolve(process.env.DSH_SOURCE??join(repo,'.build/official-source-rc5')),out=join(base,'.build/ui')
 await mkdir(out,{recursive:true})
 const req=createRequire(join(source,'package.json'));const {build}=await import(pathToFileURL(req.resolve('vite')).href)
 const paths=ts.parseConfigFileTextToJson('tsconfig.base.json',await readFile(join(source,'tsconfig.base.json'),'utf8')).config.compilerOptions.paths
 const alias=Object.entries(paths).filter(([k])=>!k.includes('*')).map(([find,targets])=>({find,replacement:join(source,targets[0])}))
 alias.unshift({find:'@deepseek-ai/dsh-client-ui-primitives',replacement:join(out,'primitives.ts')})
 await writeFile(join(out,'primitives.ts'),`export { MarkdownText } from ${JSON.stringify(join(source,'packages/client/ui-primitives/src/markdown/MarkdownText.tsx').replaceAll('\\','/'))}`)
 await build({configFile:false,root:base,resolve:{alias,dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},build:{outDir:out,emptyOutDir:false,lib:{entry:join(base,'tests/ui-entry.tsx'),name:'NeuralLabValidation',formats:['iife'],fileName:()=> 'ui.js',cssFileName:'ui'}},define:{'process.env.NODE_ENV':'"production"'}})
 const profile=await mkdtemp(join(out,'profile-')),engine=await Engine.open(profile),abort=new AbortController()
 const html='<!doctype html><html lang="zh"><meta charset="utf-8"><link rel="stylesheet" href="/ui.css"><style>body{margin:0}#root{height:100vh}</style><div id="root"></div><script src="/ui.js"></script></html>'
 const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/api/neural-lab/rpc')return await handleRequest(engine,req,res,abort.signal,async()=>({status:'unavailable',text:'验证 profile 未配置模型 / No model configured'}));if(pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html)}if(!/^\/(ui\.(js|css)|assets\/[\w.-]+)$/.test(pathname)){res.writeHead(404);return res.end()}res.setHeader('content-type',extname(pathname)==='.js'?'text/javascript':extname(pathname)==='.css'?'text/css':'application/octet-stream');res.end(await readFile(join(out,pathname.slice(1))))}catch(e){res.writeHead(500);res.end(String(e))}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 return {url,engine,profile,out,source,close:async()=>{abort.abort();await engine.close();await new Promise(r=>server.close(r))}}
}
if(process.argv[1]===import.meta.filename){const s=await serve();console.log(JSON.stringify({url:s.url,profile:s.profile}));process.on('SIGINT',async()=>{await s.close();process.exit()})}
