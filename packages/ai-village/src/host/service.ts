import { readFile, realpath, stat, lstat } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { writeFileDurable } from '@nidofy/dsh-plugin-shared/durable-file'
import { SaveStore } from './save-store.ts'
import { resources, scene } from '../definitions.ts'
export const prefix = '/api/nidofy-ai-village/'
export const framePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts"
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
async function contained(root: string, file: string, limit: number): Promise<Buffer> {
  const base = await realpath(root), path = await realpath(join(base, file)), rel = relative(base, path)
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !(await stat(path)).isFile()) throw Error('ASSET_REFUSED')
  if ((await stat(path)).size > limit) throw Error('ASSET_REFUSED')
  const bytes = await readFile(path)
  if (!bytes.length || bytes.length > limit) throw Error('ASSET_REFUSED')
  return bytes
}
async function body(req: IncomingMessage, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw Error('CONTENT_TYPE_REFUSED')
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) {
    signal.throwIfAborted(); size += chunk.length
    if (size > 65536) throw Error('BODY_TOO_LARGE')
    chunks.push(chunk)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_REQUEST')
  return value as Record<string, unknown>
}
/** Profile-scoped host owner; HTTP authentication belongs to connection/request. */
export class VillageHost {
  readonly epoch = randomUUID()
  private lease: { id: string; clientId: string; expires: number } | null = null
  private closed = false
  private release!: () => void
  private lifetime!: Promise<void>
  private files = new Map<string, Buffer>()
  private constructor(readonly store: SaveStore, readonly profileId: string) {}
  static async open(profile: string, assetRoot: string, frameRoot: string, signal: AbortSignal): Promise<VillageHost> {
    const store = await SaveStore.open(profile, scene)
    let entered!: () => void, fail!: (e: unknown) => void, release!: () => void
    const ready = new Promise<void>((resolve, reject) => { entered = resolve; fail = reject })
    const lifetime = withFileLock(join(store.directory, 'owner'), async () => {
      entered(); await new Promise<void>(resolve => { release = resolve })
    }, { waitMs: 100, signal })
    void lifetime.catch(fail)
    await ready
    try {
      signal.throwIfAborted()
      const identity = join(store.directory, 'identity.json')
      let profileId: string
      try {
        const info = await lstat(identity)
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 256) throw Error('INVALID_PROFILE_ID')
        const value = JSON.parse(await readFile(identity, 'utf8')) as { schemaVersion: number; id: string }
        if (value.schemaVersion !== 1 || !uuid(value.id)) throw Error('INVALID_PROFILE_ID')
        profileId = value.id
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
        profileId = randomUUID(); await writeFileDurable(identity, JSON.stringify({ schemaVersion: 1, id: profileId }))
      }
      const host = new VillageHost(store, profileId); host.release = release; host.lifetime = lifetime
      for (const entry of resources) {
        const bytes = await contained(assetRoot, entry.file, 8 * 1024 * 1024)
        if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('ASSET_HASH_MISMATCH')
        host.files.set('assets/' + entry.key, bytes)
      }
      const code = (await contained(frameRoot, 'frame.js', 1200 * 1024)).toString('utf8')
      host.files.set('frame', Buffer.from('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style><script>' + code.replace(/<\/script/gi, '<\\/script') + '</script>'))
      signal.throwIfAborted()
      return host
    } catch (e) { release(); await lifetime; throw e }
  }
  private valid(id: unknown): boolean { return !this.closed && uuid(id) && this.lease?.id === id && this.lease.expires > Date.now() }
  async execute(path: string, data: Record<string, unknown>): Promise<unknown> {
    if (this.closed) throw Error('HOST_CLOSED')
    if (path === 'acquire') return withFileLock(join(this.store.directory, 'transaction'), async () => {
      if (this.closed || !uuid(data.clientId)) throw Error('INVALID_CLIENT')
      if (this.lease && this.lease.expires > Date.now() && this.lease.clientId !== data.clientId) throw Error('WORLD_IN_USE')
      this.lease = { id: randomUUID(), clientId: data.clientId, expires: Date.now() + 15000 }
      return { lease: this.lease.id, profileId: this.profileId, epoch: this.epoch }
    })
    if (data.epoch !== this.epoch || !this.valid(data.lease)) throw Error('OWNER_LOST')
    if (path === 'heartbeat') { this.lease!.expires = Date.now() + 15000; return { ok: true } }
    if (path === 'release') return withFileLock(join(this.store.directory, 'transaction'), async () => {
      if (this.valid(data.lease)) this.lease = null
      return { ok: true }
    })
    if (path === 'save') return this.store.save(data.expectedRevision as number, data.world, data.operationId as string, () => this.valid(data.lease))
    if (path === 'recover') return this.store.recover(() => this.valid(data.lease))
    throw Error('UNKNOWN_OPERATION')
  }
  async handle(req: IncomingMessage, res: ServerResponse, signal: AbortSignal): Promise<void> {
    res.setHeader('cache-control', 'no-store'); res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('cross-origin-resource-policy', 'same-origin')
    const json = (code: number, value: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(value)) }
    try {
      signal.throwIfAborted()
      const path = (req.url ?? '').slice(prefix.length)
      if (req.method === 'GET' && path === 'state') { json(200, { profileId: this.profileId, epoch: this.epoch, saved: await this.store.read() }); return }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const bytes = this.files.get(path)
        if (!bytes) { json(404, { error: 'NOT_FOUND' }); return }
        if (path === 'frame') res.setHeader('content-security-policy', framePolicy)
        res.writeHead(200, { 'content-type': path === 'frame' ? 'text/html; charset=utf-8' : 'image/png', 'content-length': bytes.length })
        res.end(req.method === 'HEAD' ? undefined : bytes); return
      }
      if (req.method !== 'POST') { json(405, { error: 'METHOD_REFUSED' }); return }
      const data = await body(req, signal)
      signal.throwIfAborted()
      json(200, await this.execute(path, data))
    } catch (e) {
      if (signal.aborted || res.destroyed) { res.destroy(); return }
      const message = e instanceof Error ? e.message : ''
      // Do not return filesystem paths or parser source excerpts to the UI.
      json(409, { error: /^[A-Z_]+$/.test(message) ? message : 'SAVE_UNAVAILABLE' })
    }
  }
  async close(): Promise<void> { if (this.closed) return; this.closed = true; this.lease = null; this.release(); await this.lifetime; this.files.clear() }
}
