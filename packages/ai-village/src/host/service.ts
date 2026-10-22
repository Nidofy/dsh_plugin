import { PhotoStore } from './photo-store.ts'
import { photoLimits } from '../core/photo.ts'
import { readFile, realpath, stat, lstat } from 'node:fs/promises'
import { join, relative, isAbsolute } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { ensureDurableDirectory, writeFileDurable } from '@nidofy/dsh-plugin-shared/durable-file'
import { SaveStore } from './save-store.ts'
import { homeWorldCodec as contentWorldCodec } from '../core/home-state.ts'
import type { HomeWorld as ContentWorld } from '../core/home-state.ts'
import { preferencesCodec, type Preferences } from '../core/preferences.ts'
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
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
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
  private assetRoot = ''
  private constructor(readonly store: SaveStore<ContentWorld>, readonly profileId: string, readonly preferences: SaveStore<Preferences>, readonly photos: PhotoStore) {}
  static async open(profile: string, assetRoot: string, frameRoot: string, signal: AbortSignal): Promise<VillageHost> {
    const store = await SaveStore.open(profile, scene, contentWorldCodec(scene))
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
      const preferencesRoot = join(store.directory, 'preferences')
      await ensureDurableDirectory(preferencesRoot)
      const preferencesInfo = await lstat(preferencesRoot)
      if (!preferencesInfo.isDirectory() || preferencesInfo.isSymbolicLink()) throw Error('PROFILE_DIRECTORY_REFUSED')
      const preferences = await SaveStore.open(preferencesRoot, scene,
        preferencesCodec)
      const host = new VillageHost(store, profileId, preferences, await PhotoStore.open(store.directory, scene)); host.release = release; host.lifetime = lifetime
      host.assetRoot = assetRoot
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
    if (path === 'heartbeat') { this.lease!.expires = Date.now() + 15000; return { ok: true, retention: this.store.retention } }
    if (path === 'release') return withFileLock(join(this.store.directory, 'transaction'), async () => {
      if (this.valid(data.lease)) this.lease = null
      return { ok: true }
    })
    if (path === 'photo-delete') return withFileLock(join(this.store.directory, 'transaction'), async () => {
      if (!this.valid(data.lease) || data.epoch !== this.epoch) throw Error('OWNER_LOST')
      return this.photos.remove(data.expectedRevision as number, data.id as string, data.operationId as string, () => this.valid(data.lease))
    })
    if (path === 'save') return { ...await this.store.save(data.expectedRevision as number, data.world, data.operationId as string, () => this.valid(data.lease)), profileId: this.profileId, epoch: this.epoch }
    if (path === 'preferences-save') return withFileLock(join(this.store.directory, 'transaction'), async () => {
      if (!this.valid(data.lease)) throw Error('OWNER_LOST')
      return { ...await this.preferences.save(data.expectedRevision as number, data.world, data.operationId as string, () => this.valid(data.lease)), profileId: this.profileId, epoch: this.epoch }
    })
    if (path === 'preferences-recover') return withFileLock(join(this.store.directory, 'transaction'), () => this.preferences.recover(() => this.valid(data.lease)))
    if (path === 'recover') return this.store.recover(() => this.valid(data.lease))
    throw Error('UNKNOWN_OPERATION')
  }
  async handle(req: IncomingMessage, res: ServerResponse, signal: AbortSignal): Promise<void> {
    res.setHeader('cache-control', 'no-store'); res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('cross-origin-resource-policy', 'same-origin')
    const json = (code: number, value: unknown) => {
      const bytes = JSON.stringify(value)
      if (Buffer.byteLength(bytes) > 65536) throw Error('RESPONSE_TOO_LARGE')
      res.writeHead(code, { 'content-type': 'application/json' }).end(bytes)
    }
    try {
      signal.throwIfAborted()
      const path = (req.url ?? '').slice(prefix.length)
      if (req.method === 'GET' && path === 'album') { json(200, { profileId: this.profileId, epoch: this.epoch, saved: await this.photos.list() }); return }
      if (req.method === 'GET' && path.startsWith('photos/')) {
        const bytes = await this.photos.get(path.slice(7)); res.writeHead(200, { 'content-type': 'image/png', 'content-length': bytes.length }); res.end(bytes); return
      }
      if (req.method === 'POST' && path === 'photo-upload') {
        if (req.headers['content-type'] !== 'image/png') throw Error('CONTENT_TYPE_REFUSED')
        const lease=req.headers['x-village-lease'],epoch=req.headers['x-village-epoch']
        if(epoch!==this.epoch||!this.valid(lease))throw Error('OWNER_LOST')
        const chunks:Buffer[]=[];let size=0
        for await(const chunk of req){signal.throwIfAborted();size+=chunk.length;if(size>photoLimits.bytes)throw Error('PHOTO_TOO_LARGE');chunks.push(chunk)}
        const result=await withFileLock(join(this.store.directory,'transaction'),async()=>{
          if(epoch!==this.epoch||!this.valid(lease))throw Error('OWNER_LOST')
          const tick=Number(req.headers['x-village-tick']),saved=await this.store.read()
          if(!Number.isSafeInteger(tick)||tick<0||tick>(saved?.world.ticks??0))throw Error('INVALID_PHOTO_TICK')
          return this.photos.add(Number(req.headers['x-village-revision']),String(req.headers['x-village-photo']),decodeURIComponent(String(req.headers['x-village-title']??'')),tick,Buffer.concat(chunks),()=>this.valid(lease))
        })
        json(200,{profileId:this.profileId,epoch:this.epoch,saved:result});return
      }
      if (req.method === 'GET' && path === 'state') { json(200, { profileId: this.profileId, epoch: this.epoch, saved: await this.store.read(), retention: this.store.retention }); return }
      if (req.method === 'GET' && path === 'preferences-state') { json(200, { profileId: this.profileId, epoch: this.epoch, saved: await this.preferences.read() }); return }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const entry = path.startsWith('assets/') ? resources.find(r=>r.key===path.slice(7)) : undefined
        const bytes = entry ? await contained(this.assetRoot, entry.file, 8 * 1024 * 1024) : this.files.get(path)
        if (entry && bytes && (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256)) throw Error('ASSET_HASH_MISMATCH')
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
