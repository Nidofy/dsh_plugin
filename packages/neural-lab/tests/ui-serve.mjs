import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, mkdtemp, realpath, rm } from 'node:fs/promises'
import { resolve, join, extname, relative, isAbsolute, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { Engine, handleRequest } from '../lib/index.js'
import { generateStyleModule } from '../scripts/style-module.mjs'

/** Remove only a directory allocated by this invocation, below the evidence root. */
async function removeSession(root, created) {
  const actualRoot = await realpath(root)
  const actual = await realpath(created)
  const part = relative(actualRoot, actual)
  if (
    !part ||
    isAbsolute(part) ||
    part.startsWith('..') ||
    !basename(actual).startsWith('session-')
  )
    throw Error('Refusing cleanup outside the UI test session')
  await rm(actual, { recursive: true, force: true })
}
export async function serve() {
  const base = resolve(import.meta.dirname, '..')
  const repo = resolve(base, '../../../..')
  const source = resolve(process.env.DSH_SOURCE ?? join(repo, '.build/official-source-rc5'))
  const out = join(base, '.build/ui')
  await mkdir(out, { recursive: true })
  const session = await mkdtemp(join(out, 'session-'))
  let engine, server
  const abort = new AbortController()
  let closed = false
  async function close() {
    if (closed) return
    closed = true
    abort.abort()
    try {
      if (server?.listening) await new Promise((resolve) => server.close(resolve))
      if (engine) await engine.close()
    } finally {
      await removeSession(out, session)
    }
  }
  try {
    await generateStyleModule(base)
    const require = createRequire(join(source, 'package.json'))
    const { build } = await import(pathToFileURL(require.resolve('vite')).href)
    const paths = ts.parseConfigFileTextToJson(
      'tsconfig.base.json',
      await readFile(join(source, 'tsconfig.base.json'), 'utf8'),
    ).config.compilerOptions.paths
    const alias = Object.entries(paths)
      .filter(([key]) => !key.includes('*'))
      .map(([find, targets]) => ({ find, replacement: join(source, targets[0]) }))
    alias.unshift({
      find: '@deepseek-ai/dsh-client-ui-primitives',
      replacement: join(session, 'primitives.ts'),
    })
    await writeFile(
      join(session, 'primitives.ts'),
      [
        `export { MarkdownText } from ${JSON.stringify(join(source, 'packages/client/ui-primitives/src/markdown/MarkdownText.tsx').replaceAll('\\', '/'))}`,
        `export { useCodeHighlighter } from ${JSON.stringify(join(source, 'packages/client/ui-primitives/src/code-highlighting.ts').replaceAll('\\', '/'))}`,
      ].join('\n'),
    )
    await build({
      configFile: false,
      root: base,
      resolve: { alias, dedupe: ['react', 'react-dom'] },
      esbuild: { jsx: 'automatic' },
      build: {
        outDir: session,
        emptyOutDir: false,
        lib: {
          entry: join(base, 'tests/ui-entry.tsx'),
          name: 'NeuralLabValidation',
          formats: ['iife'],
          fileName: () => 'ui.js',
          cssFileName: 'ui',
        },
      },
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    const profile = join(session, 'profile')
    engine = await Engine.open(profile)
    const html =
      '<!doctype html><html lang="zh"><meta charset="utf-8"><link rel="stylesheet" href="/ui.css"><style>body{margin:0;font-family:system-ui,sans-serif}#root{height:100vh}</style><div id="root"></div><script src="/ui.js"></script></html>'
    server = createServer(async (req, res) => {
      try {
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (pathname === '/api/neural-lab/rpc')
          return await handleRequest(engine, req, res, abort.signal, async () => ({
            status: 'unavailable',
            text: '验证 profile 未配置模型 / No model configured',
          }))
        if (pathname === '/') {
          res.setHeader('content-type', 'text/html;charset=utf-8')
          return res.end(html)
        }
        if (!/^\/(ui\.(js|css)|assets\/[\w.-]+)$/.test(pathname)) {
          res.writeHead(404)
          return res.end()
        }
        res.setHeader(
          'content-type',
          extname(pathname) === '.js'
            ? 'text/javascript'
            : extname(pathname) === '.css'
              ? 'text/css'
              : 'application/octet-stream',
        )
        res.end(await readFile(join(session, pathname.slice(1))))
      } catch (error) {
        res.writeHead(500)
        res.end(String(error))
      }
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    return {
      url: 'http://127.0.0.1:' + server.address().port,
      engine,
      profile,
      session,
      out,
      source,
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
if (process.argv[1] === import.meta.filename) {
  const session = await serve()
  console.log(JSON.stringify({ url: session.url, profile: session.profile }))
  process.once('SIGINT', async () => {
    await session.close()
    process.exit()
  })
  process.once('SIGTERM', async () => {
    await session.close()
    process.exit()
  })
}
