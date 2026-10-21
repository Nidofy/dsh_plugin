import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { SaveStore } from '../src/host/save-store.ts'
import type { Scene } from '../src/core/world.ts'
import type { IncomingMessage } from 'node:http'

export const frameCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts"
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type'] !== 'application/json') throw Error('CONTENT_TYPE_REFUSED')
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 65536) throw Error('BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  const result: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('INVALID_BODY')
  return result as Record<string, unknown>
}
export async function startServer(options: { profile: string; assets: string; build: string; port?: number }) {
  const characterDir = join(options.assets, 'characters/bluewhale'), sceneDir = join(options.assets, 'scenes/courtyard')
  const scene = JSON.parse(await readFile(join(sceneDir, 'scene.json'), 'utf8')) as Scene
  const store = await SaveStore.open(options.profile, scene), secret = randomUUID()
  const files = new Map<string, { bytes: Buffer; mime: string }>()
  const add = async (route: string, path: string, mime: string) => { files.set(route, { bytes: await readFile(path), mime }) }
  await add('/', join(options.build, 'index.html'), 'text/html; charset=utf-8')
  await add('/frame', join(options.build, 'frame.html'), 'text/html; charset=utf-8')
  await add('/client.js', join(options.build, 'client.js'), 'text/javascript')
  await add('/character', join(characterDir, 'character.json'), 'application/json')
  await add('/animations', join(characterDir, 'animations.json'), 'application/json')
  await add('/scene', join(sceneDir, 'scene.json'), 'application/json')
  const manifest: { key: string; url: string; sha256: string }[] = []
  for (const [directory, field, prefix] of [[characterDir, 'parts', ''], [sceneDir, 'files', 'scene/']] as const) {
    const source = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))
    for (const entry of source[field]) {
      if (!/^(parts\/)?[a-z-]+\.png$/.test(entry.file)) throw Error('ASSET_PATH_REFUSED')
      const key = prefix + entry.file, url = '/asset/' + key
      await add(url, join(directory, entry.file), 'image/png')
      const bytes = files.get(url)!.bytes
      if (bytes.length > 8 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('ASSET_HASH_MISMATCH')
      manifest.push({ key, url, sha256: entry.sha256 })
    }
  }
  files.set('/manifest', { bytes: Buffer.from(JSON.stringify(manifest)), mime: 'application/json' })
  files.get('/')!.bytes = Buffer.from(files.get('/')!.bytes.toString().replace('__SERVER_KEY__', secret))
  let lease: { id: string; client: string; expires: number } | null = null, closing = false
  const valid = (id: unknown) => !closing && typeof id === 'string' && lease?.id === id && lease.expires > Date.now()
  let url = ''
  const server = createServer(async (req, res) => {
    const json = (code: number, value: unknown) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value)) }
    try {
      if (req.headers.host !== new URL(url).host) { json(403, { error: 'HOST_REFUSED' }); return }
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('cache-control', 'no-store')
      const route = req.url ?? ''
      if (!route.startsWith('/api/')) {
        const file = files.get(route)
        if (req.method !== 'GET' || !file) { json(404, { error: 'NOT_FOUND' }); return }
        if (route === '/frame') res.setHeader('content-security-policy', frameCsp)
        if (route === '/') res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'")
        res.writeHead(200, { 'content-type': file.mime }).end(file.bytes); return
      }
      const key = req.headers['x-village-key']
      if (typeof key !== 'string' || key.length !== secret.length || !timingSafeEqual(Buffer.from(key), Buffer.from(secret))
        || (req.headers.origin !== undefined && req.headers.origin !== url)) { json(403, { error: 'AUTH_REFUSED' }); return }
      if (route === '/api/state' && req.method === 'GET') { json(200, await store.read()); return }
      if (req.method !== 'POST') { json(404, { error: 'NOT_FOUND' }); return }
      const data = await body(req)
      if (route === '/api/lease') {
        if (typeof data.clientId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.clientId)) throw Error('CLIENT_ID_REFUSED')
        await withFileLock(join(store.directory, 'transaction'), async () => {
          if (lease && lease.expires > Date.now() && lease.client !== data.clientId) throw Error('WORLD_IN_USE')
          lease = { id: randomUUID(), client: data.clientId as string, expires: Date.now() + 15000 }
        })
        json(200, { lease: lease!.id }); return
      }
      if (!valid(data.lease)) throw Error('OWNER_LOST')
      if (route === '/api/heartbeat') { lease!.expires = Date.now() + 15000; json(200, { ok: true }) }
      else if (route === '/api/release') {
        await withFileLock(join(store.directory, 'transaction'), async () => { if (valid(data.lease)) lease = null })
        json(200, { ok: true })
      }
      else if (route === '/api/state') json(200, await store.save(data.expectedRevision as number, data.world, data.operationId as string, () => valid(data.lease)))
      else if (route === '/api/recover') json(200, await store.recover(() => valid(data.lease)))
      else json(404, { error: 'NOT_FOUND' })
    } catch (error) { if (!res.headersSent) json(409, { error: error instanceof Error ? error.message : 'REQUEST_FAILED' }); else res.end() }
  })
  server.requestTimeout = 8000; server.headersTimeout = 10000
  let release!: () => void, ready!: () => void, failed!: (error: unknown) => void
  const started = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject })
  const lifetime = withFileLock(join(store.directory, 'owner'), async () => {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 0, '127.0.0.1', resolve) })
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    ready()
    await new Promise<void>(resolve => { release = resolve })
  }, { waitMs: 100 })
  void lifetime.catch(failed)
  await started
  return { url, store, scene, close: async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    closing = true; release(); await lifetime
  } }
}
