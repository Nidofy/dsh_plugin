/** Render the real client with deterministic demo data; never touch a repository. */
import { build } from 'tsdown'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:http'
const root = resolve(import.meta.dirname, '..'), out = join(root, '.build/vcs-preview')
await mkdir(out, { recursive: true })
const entry = `import { createRoot } from 'react-dom/client'
import { RepositoryPanel } from '../../packages/source-control/src/client/Panel.tsx'
const shared = { revision:'demo-revision', branch:'codex/source-control-plugin', head:'a'.repeat(40), changes:[], branches:[{name:'codex/source-control-plugin',node:'a'.repeat(40),current:true},{name:'main',node:'b'.repeat(40),current:false},{name:'feature/notebook-v2',node:'c'.repeat(40),current:false}], remotes:['origin'], added:0, removed:0, stagedAdded:0, stagedRemoved:0,conflict:false }
const repos = [{...shared,id:'desktop',name:'dshWinUi',root:'D:/Documents/FeiyangChen/devApps/dshWinUi',vcs:'git',added:565,removed:12,changes:[{path:'src/components/Environment.tsx',index:' ',worktree:'M'},{path:'src/styles/panel.css',index:'M',worktree:' '}]}, {...shared,id:'plugins',name:'dsh_plugin',root:'D:/Documents/FeiyangChen/devApps/dsh_plugin',vcs:'git',added:248,removed:18}, {...shared,id:'hg',name:'research-notes',root:'D:/Workspace/research-notes',vcs:'hg',branch:'default',branches:[{name:'default',node:'d'.repeat(40),current:true},{name:'experiment',node:'e'.repeat(40),current:false}],added:32,removed:4}]
const api = async (route,input,signal) => {
 if(signal.aborted) throw new Error('CANCELLED')
 if(route==='repositories') return {repositories:repos,warnings:[]}
 if(route==='status') return repos.find(r=>r.id===input.id)
 if(route==='diff') return 'diff --git a/src/panel.tsx b/src/panel.tsx\\n@@ -1,2 +1,3 @@\\n-export const panel = null\\n+export const panel = RepositoryPanel\\n+// Independent DSH plugin'
 if(route==='history') return [{node:'a'.repeat(40),parents:['b'.repeat(40),'c'.repeat(40)],subject:'Merge repository panel',author:'Feiyang',date:'2026-10-18'}, {node:'b'.repeat(40),parents:['d'.repeat(40)],subject:'Add source control actions',author:'Feiyang',date:'2026-10-18'}, {node:'c'.repeat(40),parents:['d'.repeat(40)],subject:'Refine branch picker',author:'Feiyang',date:'2026-10-17'}, {node:'d'.repeat(40),parents:[],subject:'Create plugin package',author:'Feiyang',date:'2026-10-17'}]
 if(route==='worktrees') return [{path:'D:/Workspace/dsh_plugin',branch:'main',head:'a'.repeat(40)}]
 throw new Error('DEMO_READ_ONLY')
}
createRoot(document.getElementById('root')).render(<RepositoryPanel projectRoot="D:/Documents/FeiyangChen/devApps/dsh_plugin" api={api} locale="zh" />)
`
await writeFile(join(out, 'preview.tsx'), entry)
await build({ config: false, entry: { preview: join(out, 'preview.tsx') }, outDir: out, platform: 'browser', format: 'esm', target: 'es2022', dts: false, clean: false, deps: { alwaysBundle: [/./] }, define: { 'process.env.NODE_ENV': '"production"' } })
const code = await readFile(join(out, 'preview.mjs'), 'utf8').catch(() => readFile(join(out, 'preview.js'), 'utf8'))
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DSH · Git / Hg</title><style>body{background:#191919;margin:0;padding:40px;color:#ddd;font:14px system-ui}main{max-width:340px;margin:0 auto}.caption{font-size:12px;color:#929292;margin:0 0 16px 4px;letter-spacing:.04em}@media(max-width:560px){body{padding:14px}}</style><main><p class="caption">DSH / GIT & HG · 交互预览 · 示例数据，写入已禁用</p><div id="root"></div></main><script type="module">${code.replaceAll('</script', '<\\/script')}</script></html>`
await writeFile(join(out, 'index.html'), html)
console.log('Preview:', join(out, 'index.html'))
if (process.argv.includes('--screenshot')) {
  const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
  const pnpm = join(source, 'node_modules/.pnpm')
  const packageDir = (await readdir(pnpm)).find(name => name.startsWith('playwright@1.61.'))
  if (!packageDir) throw Error('Playwright is not installed in the development host')
  const { chromium } = await import(pathToFileURL(join(pnpm, packageDir, 'node_modules/playwright/index.mjs')).href)
  const cache = join(process.env.LOCALAPPDATA, 'ms-playwright')
  const browserDir = (await readdir(cache)).find(name => name.startsWith('chromium_headless_shell-'))
  const candidates = ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']
  let executablePath
  for (const candidate of candidates) { const path = join(cache, browserDir, candidate); if (await stat(path).catch(() => false)) { executablePath = path; break } }
  const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, executablePath })
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 })
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button', { name: 'codex/source-control-plugin', exact: true }).first().waitFor()
    await page.screenshot({ path: join(out, 'overview.png'), fullPage: true })
    await page.getByRole('article', { name: 'dsh_plugin', exact: true }).getByRole('button', { name: 'codex/source-control-plugin', exact: true }).click()
    await page.getByRole('textbox', { name: '搜索分支' }).fill('')
    await page.screenshot({ path: join(out, 'branches.png'), fullPage: true })
    await page.getByRole('button', { name: '提交图谱', exact: true }).click()
    await page.getByText('Merge repository panel', { exact: true }).waitFor()
    await page.screenshot({ path: join(out, 'graph.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw Error('Mobile viewport has horizontal overflow')
    if (errors.length) throw Error(errors.join('\n'))
    await page.screenshot({ path: join(out, 'mobile.png'), fullPage: true })
    console.log('Chromium desktop, branch search, graph and 390px layout passed')
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
