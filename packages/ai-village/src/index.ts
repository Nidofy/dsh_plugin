import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { VillageHost, prefix } from './host/service.ts'
export const name = 'nidofy-ai-village'
export const inject: string[] = ['connection', 'profileContext']
export async function apply(ctx: Context): Promise<void> {
  const lifetime = new AbortController(), pending = new Set<Promise<void>>()
  const directory = dirname(fileURLToPath(import.meta.url))
  const opening = VillageHost.open(ctx.profileContext.dir, join(directory, '../assets'), directory, lifetime.signal)
  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled(pending)
    const host = await opening.catch(() => null)
    await host?.close()
  })
  const host = await opening
  ctx.on('connection/request', async (req, res, next) => {
    if (!(req.url ?? '').startsWith(prefix)) return next()
    const request = new AbortController(), cancel = () => request.abort()
    const timeout = setTimeout(() => { request.abort(); if (!req.complete) req.destroy() }, 10000)
    const abortBody = () => { if (!req.complete) req.destroy() }
    lifetime.signal.addEventListener('abort', abortBody, { once: true })
    res.once('close', cancel)
    const work = host.handle(req, res, AbortSignal.any([lifetime.signal, request.signal]))
    pending.add(work)
    try { await work } finally { clearTimeout(timeout); pending.delete(work); res.off('close', cancel); lifetime.signal.removeEventListener('abort', abortBody) }
  })
}
