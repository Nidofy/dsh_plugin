import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assets } from './assets.ts'

export const name = 'nidofy-live2d'
export const inject = ['connection']
const directory = dirname(fileURLToPath(import.meta.url))
const prefix = '/api/nidofy-live2d/'
export const framePolicy = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src blob:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts"

async function containedFile(root: string, file: string, limit: number, signal: AbortSignal): Promise<Buffer> {
  const base = await realpath(root), target = await realpath(join(base, file))
  const rel = relative(base, target)
  if (rel.startsWith('..') || isAbsolute(rel) || (await stat(target)).size > limit) throw Error('ASSET_REFUSED')
  const bytes = await readFile(target, { signal })
  if (!bytes.length || bytes.length > limit) throw Error('ASSET_REFUSED')
  return bytes
}

/** Invoked only behind DSH's authenticated connection/request boundary. */
export async function handleRequest(req: IncomingMessage, res: ServerResponse, signal: AbortSignal,
  assetRoot = join(directory, '../assets'), frameRoot = directory): Promise<void> {
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('cross-origin-resource-policy', 'same-origin')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405; res.setHeader('allow', 'GET, HEAD'); res.end(); return
  }
  try {
    const path = (req.url ?? '').split('?')[0]!.slice(prefix.length)
    let data: Buffer, type: string
    if (path === 'frame') {
      const js = await containedFile(frameRoot, 'frame.js', 256 * 1024, signal)
      data = Buffer.from('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;width:100%;height:100%}</style><canvas></canvas><script>' + js.toString('utf8').replace(/<\/script/gi, '<\\/script') + '</script>')
      type = 'text/html; charset=utf-8'; res.setHeader('content-security-policy', framePolicy)
    } else {
      const file = path.startsWith('assets/') ? path.slice(7) : ''
      const definition = Object.hasOwn(assets, file) ? assets[file] : undefined
      if (!definition) { res.statusCode = 404; res.end(); return }
      data = await containedFile(assetRoot, file, definition.limit, signal); type = definition.type
    }
    signal.throwIfAborted()
    res.setHeader('content-type', type); res.setHeader('content-length', data.length)
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch {
    if (signal.aborted) { res.destroy(); return }
    if (res.destroyed) return
    res.statusCode = 404; res.end()
  }
}

export function apply(ctx: Context): void {
  const lifetime = new AbortController(), pending = new Set<Promise<void>>()
  ctx.on('connection/request', async (req, res, next) => {
    if (!(req.url ?? '').startsWith(prefix)) return next()
    const request = new AbortController(), cancel = () => request.abort()
    res.once('close', cancel)
    const work = handleRequest(req, res, AbortSignal.any([lifetime.signal, request.signal]))
    pending.add(work)
    try { await work } finally { pending.delete(work); res.off('close', cancel) }
  })
  ctx.effect(() => async () => { lifetime.abort(); await Promise.allSettled(pending) })
}
