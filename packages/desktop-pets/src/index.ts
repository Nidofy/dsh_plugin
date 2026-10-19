/** Standalone pet service, resources and settings for DSH; Desktop is an optional carrier. */
import { readFile, lstat } from 'node:fs/promises'
import { join, extname, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { packageCommand } from './legacy/pet-packages.mjs'
import { PreferenceStore, object, text } from './state.ts'
import { installPetFeed } from './pets.ts'
import { PetCoordination } from './pet-coordination.ts'
import { extrasHtml } from './ui.ts'
export const name = 'nidofy-desktop-pets'
export const inject = ['connection', 'sessionQuery', 'sessions', 'agents']
export async function apply(ctx: Context): Promise<void> {
  const home = join(resolveDshHome(), 'nidofy-extras')
  const assetSource = fileURLToPath(new URL('../assets/', import.meta.url))
  const assets = process.versions.electron === undefined ? assetSource : assetSource.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2')
  const storage = ctx.get('nidofyStorage')
  const preferences = new PreferenceStore(home, storage)
  await preferences.open()
  const lifetime = new AbortController()
  let petFeed: ReturnType<typeof installPetFeed> | undefined
  let child: Awaited<ReturnType<Context['plugin']>> | undefined
  let reconcileQueue: Promise<void> = Promise.resolve(), resourceQueue: Promise<unknown> = Promise.resolve()
  const reconcile = (): Promise<void> => {
    const work = reconcileQueue.catch(() => {}).then(async () => {
      lifetime.signal.throwIfAborted()
      if (!preferences.value.pets) { await child?.dispose(); child = undefined; petFeed = undefined; return }
      if (!child) child = await ctx.plugin({ name: 'nidofy-pet-feed', apply(scope: Context) { petFeed = installPetFeed(scope) } })
    })
    reconcileQueue = work
    return work
  }
  const coordination = new PetCoordination(() => ({ enabled: preferences.value.pets && petFeed !== undefined,
    revision: preferences.value.revision, generation: petFeed?.snapshot().generation ?? 'disabled' }),
  async (sessionId, signal) => { if (!petFeed) throw Error('PET_COMMAND_UNAVAILABLE'); await petFeed.ensure(sessionId, signal) },
  (command) => {
    if (![preferences.value.pet, ...preferences.value.companions].some(pet => pet.id === command.target && pet.enabled)) throw Error('PET_INSTANCE_MISSING')
    return routes('pet/update', { id: command.target,
      action: { bind: 'pin', unbind: 'unpin', mute: 'mute', unmute: 'unmute', interact: 'interact' }[command.action],
      target: { sessionId: command.sessionId, generation: command.generation } })
  })

  async function routes(method: string, input: Record<string, unknown>, signal = lifetime.signal): Promise<unknown> {
    signal.throwIfAborted()
    if (method === 'pet/coordinate') return coordination.execute(input, signal)
    if (method === 'status') return { preferences: preferences.value, warning: preferences.warning, features: { pets: petFeed ? 'ENABLED' : 'DISABLED' } }
    if (method === 'preferences') {
      const saved = await preferences.save({ ...preferences.value, revision: input.revision, pets: input.pets, pet: input.pet, companions: input.companions })
      await reconcile(); return saved
    }
    if (method === 'pet/snapshot' || method === 'pet/update') {
      const selected = [preferences.value.pet, ...preferences.value.companions].find(p => p.id === (input.id ?? '1'))
      if (!selected) throw Error('PET_INSTANCE_MISSING')
      let pinUnavailable = false
      if (method === 'pet/snapshot' && selected.pinned && petFeed) {
        try { await petFeed.ensure(selected.pinned, signal) }
        catch { signal.throwIfAborted(); pinUnavailable = true }
      }
      if (method === 'pet/update') {
        const next = structuredClone(preferences.value), target = [next.pet, ...next.companions].find(p => p.id === selected.id)
        if (!target) throw Error('PET_INSTANCE_MISSING')
        if (input.action === 'position') { const p = object(input.position); target.position = { x: Number(p.x), y: Number(p.y) } }
        else if (input.action === 'interact') { if (target.moodEnabled && Date.now() - target.lastInteractionMs >= 60000) { target.lastInteractionMs = Date.now(); target.affinity = Math.min(100, target.affinity + 1) } }
        else if (input.action === 'hide') target.enabled = false
        else if (input.action === 'unpin') target.pinned = null
        else if (input.action === 'mute') target.quiet = true
        else if (input.action === 'unmute') target.quiet = false
        else if (input.action === 'pin') {
          const current = petFeed?.snapshot(), requested = object(input.target)
          if (requested.generation !== current?.generation || !current?.items.some(row => row.sessionId === requested.sessionId)) throw Error('PET_TARGET_CHANGED')
          target.pinned = text(requested.sessionId, 128)
        } else throw Error('PET_ACTION_REFUSED')
        await preferences.save(next); return { updated: true }
      }
      return { pinUnavailable, settings: { ...selected, ...(pinUnavailable ? { pinned: null } : {}), profile: 'desktop', bubble: { ...selected.bubble, durationMs: selected.quiet ? 0 : selected.bubble.durationMs } },
        state: { ...(petFeed?.snapshot() ?? { generation: 'disabled', revision: 0, items: [] }), profile: 'desktop' }, doubleMs: 350 }
    }
    if (method === 'pet/packages' || method === 'pet/resource') {
      const action = method === 'pet/resource' ? 'asset' : text(input.action)
      if (!['list', 'preview', 'import', 'delete', 'asset', 'export'].includes(action)) throw Error('RESOURCE_ACTION_INVALID')
      const operation = resourceQueue.catch(() => {}).then(() => packageCommand({ home, resources: assets, action, signal,
        ...(storage ? { storage } : {}),
        resourceId: method === 'pet/resource' ? ([preferences.value.pet, ...preferences.value.companions].find(p => p.id === (input.id ?? '1'))?.resource ?? 'xiaojing') : text(input.resourceId ?? 'xiaojing'),
        ...(input.source === undefined ? {} : { source: text(input.source, 4096) }),
        ...(input.expected === undefined ? {} : { expected: text(input.expected) }),
        ...(input.destination === undefined ? {} : { destination: text(input.destination, 4096) }), replace: input.replace === true }))
      resourceQueue = operation; return operation
    }

    throw Error('UNKNOWN_OPERATION')
  }
  ctx.effect(() => async () => {
    lifetime.abort()
    await coordination.close()
    await reconcileQueue.catch(() => {})
    await child?.dispose()
    await resourceQueue.catch(() => {})
    await preferences.close()
  })
  await reconcile()
  ctx.on('connection/request', async (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/nidofy-pets/')) return next()
    response.setHeader('cache-control', 'no-store')
    try {
      if (request.method === 'GET' && url.pathname === '/api/nidofy-pets/ui') {
        response.setHeader('content-type', 'text/html; charset=utf-8'); response.end(extrasHtml(url.searchParams.get('locale') === 'zh-CN')); return
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/nidofy-pets/assets/')) {
        const part = decodeURIComponent(url.pathname.slice('/api/nidofy-pets/assets/'.length))
        if (!/^[a-zA-Z0-9_./-]+$/.test(part) || part.split('/').includes('..')) throw Error('ASSET_PATH_REFUSED')
        const path = resolve(assets, part), rel = relative(assets, path)
        if (isAbsolute(rel) || rel.startsWith('..')) throw Error('ASSET_PATH_REFUSED')
        const stat = await lstat(path)
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) throw Error('ASSET_REFUSED')
        response.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' } as Record<string, string>)[extname(path)] ?? 'application/octet-stream')
        response.end(await readFile(path)); return
      }
      if (request.method !== 'POST') { response.writeHead(405); response.end('{}'); return }
      if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw Error('JSON_POST_REQUIRED')
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)) throw Error('ORIGIN_REFUSED')
      const chunks: Buffer[] = []; let bytes = 0
      for await (const chunk of request) {
        const value: unknown = chunk
        if (typeof value !== 'string' && !(value instanceof Uint8Array)) throw Error('INVALID_REQUEST_CHUNK')
        const buffer = Buffer.from(value)
        bytes += buffer.length
        if (bytes > 2 * 1024 * 1024) throw Error('REQUEST_TOO_LARGE')
        chunks.push(buffer)
      }
      const requestLifetime = new AbortController(), disconnect = (): void => { requestLifetime.abort() }
      response.once('close', disconnect)
      let result: unknown
      try { result = await routes(url.pathname.slice('/api/nidofy-pets/'.length), object(JSON.parse(Buffer.concat(chunks).toString()) as unknown),
        AbortSignal.any([requestLifetime.signal, lifetime.signal])) }
      finally { response.removeListener('close', disconnect) }
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(result))
    } catch (e) {
      const message = e instanceof Error ? e.message : ''
      response.writeHead(message.endsWith('CONFLICT') ? 409 : 400, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: /^[A-Z][A-Z0-9_]+$/.test(message) ? message : 'OPTIONAL_OPERATION_FAILED' }))
    }
  })

}
