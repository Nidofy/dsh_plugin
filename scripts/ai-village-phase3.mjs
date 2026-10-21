import { build } from 'tsdown'
import ts from 'typescript'
import { readFile, writeFile, mkdir, copyFile, readdir, stat, cp, mkdtemp } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import * as tar from 'tar'
import { spawn } from 'node:child_process'
const root = resolve(import.meta.dirname, '..'), pkg = join(root, 'packages/ai-village')
const out = join(root, '.build/ai-village-phase3'), qa = join(root, '.build/ai-village-v0.3-qa/storage-browser')
await mkdir(out, { recursive: true }); await mkdir(qa, { recursive: true })
const mode = process.argv[2] ?? 'check'
assert.ok(['check', 'serve', 'build'].includes(mode))
const baseline = JSON.parse(await readFile(join(root, '.build/sandbox-enhanced/baseline.json'), 'utf8'))
assert.equal(baseline.revision, '687f282e8625c6b8d11ff58211a90524be2e4317')
const alias = {
  '@deepseek-ai/dsh-atomic-write': join(root, '.build/sandbox-enhanced/official/packages/util/atomic-write/src/index.ts'),
  '@nidofy/dsh-plugin-shared/durable-file': join(root, 'packages/plugin-shared/src/durable-file.ts'),
}
const sources = ['src/core/world.ts', 'src/core/controller.ts', 'src/host/save-store.ts', 'src/client/standalone.ts', 'src/frame/scene.ts',
  'src/art/types.ts', 'src/art/animation.ts', 'src/art/paper-doll.ts', 'experiments/phase3-server.ts', 'experiments/phase3-check.ts'].map(f => join(pkg, f))
const options = ts.convertCompilerOptionsFromJson({ target: 'ES2024', module: 'ESNext', moduleResolution: 'bundler', strict: true,
  noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, skipLibCheck: true, noEmit: true, allowImportingTsExtensions: true,
  types: ['node'], paths: Object.fromEntries(Object.entries(alias).map(([k, v]) => [k, [v]])) }, root)
const program = ts.createProgram(sources, options.options)
const diagnostics = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()]
for (const file of sources) diagnostics.push(...program.getSyntacticDiagnostics(program.getSourceFile(file)), ...program.getSemanticDiagnostics(program.getSourceFile(file)))
if (diagnostics.length) throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }))
for (const [name, file] of [['frame', 'src/frame/scene.ts'], ['client', 'src/client/standalone.ts']]) await build({ config: false, entry: { [name]: join(pkg, file) }, outDir: out,
  format: 'iife', platform: 'browser', target: 'es2022', dts: false, clean: false, minify: true,
  deps: { alwaysBundle: [/./] }, outputOptions: { entryFileNames: '[name].js' } })
await build({ config: false, entry: { server: join(pkg, 'experiments/phase3-server.ts'), check: join(pkg, 'experiments/phase3-check.ts') },
  outDir: out, alias, format: 'esm', platform: 'node', target: 'es2024', dts: false, clean: false,
  deps: { alwaysBundle: Object.keys(alias), neverBundle: ['koffi'] } })
const { startServer, frameCsp } = await import(pathToFileURL(join(out, 'server.mjs')).href)
const script = await readFile(join(out, 'frame.js'), 'utf8')
assert.ok(Buffer.byteLength(script) < 1200 * 1024, 'frame bundle exceeds reviewed 1.2 MiB limit')
await writeFile(join(out, 'frame.html'), `<!doctype html><html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${frameCsp}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style><script>${script.replaceAll('</script', '<\\/script')}</script></html>`)
await copyFile(join(pkg, 'experiments/phase3.html'), join(out, 'index.html'))
if (mode === 'build') { console.log('Phase 3 types and build passed'); process.exit(0) }
const profile = mode === 'serve' ? join(out, 'profile') : await mkdtemp(join(out, 'browser-'))
await mkdir(profile, { recursive: true })
const server = await startServer({ profile, assets: join(pkg, 'assets'), build: out, ...(mode === 'serve' ? { port: 18748 } : {}) })
if (mode === 'serve') console.log('AI Village phase 3: ' + server.url)
else {
  let browser
  try {
    const { check } = await import(pathToFileURL(join(out, 'check.mjs')).href)
    const logic = await check(server.scene, out)
    await assert.rejects(startServer({ profile, assets: join(pkg, 'assets'), build: out }), /writer lock/)
    const probe = `const {startServer}=await import(process.argv[1]);try{const s=await startServer({profile:process.argv[2],assets:process.argv[3],build:process.argv[4]});await s.close();process.exitCode=1}catch(e){if(!String(e).includes('writer lock'))throw e}`
    const childCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', probe, pathToFileURL(join(out, 'server.mjs')).href, profile, join(pkg, 'assets'), out],
        { cwd: root, windowsHide: true, stdio: 'pipe' })
      let stderr = ''; child.stderr.on('data', b => { stderr += b })
      child.on('error', reject); child.on('close', code => code === 0 ? resolve(code) : reject(Error(stderr || 'Owner probe unexpectedly acquired the profile')))
    })
    assert.equal(childCode, 0)
    logic.push('same-process and independent child-process host owners refused by filesystem lifetime lock')
    const { source } = JSON.parse(await readFile(join(root, '.local/environment.json'), 'utf8'))
    const pnpm = join(source, 'node_modules/.pnpm'), name = (await readdir(pnpm)).find(n => n.startsWith('playwright@1.61.'))
    assert.ok(name)
    const { chromium } = await import(pathToFileURL(join(pnpm, name, 'node_modules/playwright/index.mjs')).href)
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright'), folder = (await readdir(cache)).find(n => n.startsWith('chromium_headless_shell-'))
    let executablePath
    for (const candidate of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-win/headless_shell.exe']) {
      const path = join(cache, folder, candidate); if (await stat(path).catch(() => false)) { executablePath = path; break }
    }
    assert.ok(executablePath)
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] })
    const { browserCheck } = await import('./ai-village-phase3-browser.mjs')
    const browserResult = await browserCheck(browser, server, qa, join(out, 'videos'))
    await writeFile(join(out, 'result.json'), JSON.stringify({ logic, browser: browserResult }, null, 2) + '\n')
    const packed = await mkdtemp(join(out, 'preview-'))
    const runtimeFiles = new Set(['server.mjs', 'client.js', 'frame.js', 'frame.html', 'index.html'])
    for (const file of runtimeFiles) {
      const bytes = await readFile(join(out, file), 'utf8')
      if (file.endsWith('.mjs')) for (const match of bytes.matchAll(/from ["']\.\/([^"']+\.mjs)["']/g)) runtimeFiles.add(match[1])
      await copyFile(join(out, file), join(packed, file))
    }
    await cp(join(pkg, 'assets'), join(packed, 'assets'), { recursive: true })
    await copyFile(join(root, '.build/ai-village-phase1/THIRD-PARTY-NOTICES.txt'), join(packed, 'THIRD-PARTY-NOTICES.txt'))
    await writeFile(join(packed, 'README.txt'), 'Offline development preview; not an installable DSH plugin. Server requires Node 24 and external koffi. Run from the source repository with: node scripts/ai-village-phase3.mjs serve\n')
    await tar.c({ cwd: packed, gzip: true, file: join(out, 'phase3-preview.tgz') }, await readdir(packed))
    const entries = []; await tar.t({ file: join(out, 'phase3-preview.tgz'), onentry: e => entries.push(e.path) })
    assert.ok(entries.includes('frame.html') && entries.includes('assets/scenes/courtyard/scene.json'))
    assert.ok(entries.every(n => !/profile|art\/|node_modules|\.lock$/.test(n)))
    const extracted = await mkdtemp(join(out, 'extracted-'))
    await tar.x({ file: join(out, 'phase3-preview.tgz'), cwd: extracted })
    const packedServer = (await import(pathToFileURL(join(extracted, 'server.mjs')).href)).startServer
    const smoke = await packedServer({ profile: await mkdtemp(join(out, 'smoke-')), assets: join(extracted, 'assets'), build: extracted })
    try {
      const html = await fetch(smoke.url).then(r => r.text())
      assert.ok(html.includes('小院'))
      assert.equal((await fetch(smoke.url + '/manifest').then(r => r.json())).length, 34)
      const key = html.match(/__VILLAGE_KEY__="([^"]+)"/)[1]
      const headers = { 'content-type': 'application/json', 'x-village-key': key }
      const lease = await fetch(smoke.url + '/api/lease', { method: 'POST', headers, body: JSON.stringify({ clientId: crypto.randomUUID() }) }).then(r => r.json())
      const world = (await server.store.read()).world
      const ack = await fetch(smoke.url + '/api/state', { method: 'POST', headers, body: JSON.stringify({ lease: lease.lease, expectedRevision: 0, operationId: crypto.randomUUID(), world }) }).then(r => r.json())
      assert.equal(ack.revision, 1); assert.deepEqual((await smoke.store.read()).world, world)
      assert.equal((await fetch(smoke.url + '/api/state')).status, 403)
      assert.equal((await fetch(smoke.url + '/asset/unknown.png')).status, 404)
      assert.equal((await fetch(smoke.url + '/api/state', { headers: { ...headers, origin: 'https://invalid.example' } })).status, 403)
    } finally { await smoke.close() }
    logic.push('extracted preview smoke: fixed asset manifest, authenticated save/reload, unauthenticated/cross-origin/path refusal')
    await writeFile(join(out, 'result.json'), JSON.stringify({ logic, browser: browserResult, packedFiles: entries.length }, null, 2) + '\n')
    await copyFile(join(out, 'result.json'), join(qa, 'validation.json'))
    console.log(JSON.stringify({ logic, browser: browserResult, packedFiles: entries.length }, null, 2))
  } finally { await browser?.close(); await server.close() }
}
