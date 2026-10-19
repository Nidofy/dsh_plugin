import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import Schema from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { localPath, scanNative } from './audit.ts'
import { protectionStatus, SafetyError } from './contracts.ts'
import { Lifetime } from './lifecycle.ts'
import { bundledHelper } from './helper.ts'

export const name = 'windows-sandbox-enhanced'
export const inject = ['connection']
export interface Config { roots: string[]; maxEntries: number }
export const Config: Schema<Config> = Schema.object({
  roots: Schema.array(Schema.string()).default([]).description('Explicit local roots for read-only ACL diagnostics. No automatic workspace scan.'),
  maxEntries: Schema.number().default(2000).description('Bounded scan size (1–10000); incomplete scans never authorize recovery.'),
})
const prefix = '/api/windows-sandbox-enhanced/'

export async function requestBody(req: IncomingMessage, signal: AbortSignal): Promise<Record<string, unknown>> {
  signal.throwIfAborted()
  if (req.method !== 'POST' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new SafetyError('JSON_POST_REQUIRED')
  if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) throw new SafetyError('ORIGIN_REFUSED')
  let size = 0; const chunks: Buffer[] = []
  for await (const chunk of req) { signal.throwIfAborted(); size += chunk.length; if (size > 4096) throw new SafetyError('INPUT_LIMIT'); chunks.push(Buffer.from(chunk)) }
  const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SafetyError('INVALID_INPUT')
  return input as Record<string, unknown>
}
export function apply(ctx: Context, config: Config): void {
  if (process.platform !== 'win32') throw new SafetyError('WINDOWS_REQUIRED')
  const roots = config.roots.map(localPath)
  if (!Number.isInteger(config.maxEntries) || config.maxEntries < 1 || config.maxEntries > 10000) throw new SafetyError('INVALID_CONFIG')
  const lifetime = new Lifetime(), controller = new AbortController(), requests = new Set<Promise<void>>()
  let scanning = false
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const cancellation = new AbortController(), close = () => cancellation.abort()
    res.once('close', close)
    const signal = AbortSignal.any([controller.signal, cancellation.signal, AbortSignal.timeout(65000)])
    const abort = () => req.destroy(); signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); res.off('close', close); signal.removeEventListener('abort', abort); return }
    res.setHeader('cache-control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8')
    try {
      const input = await requestBody(req, signal), route = new URL(req.url ?? '/', 'http://localhost').pathname.slice(prefix.length)
      signal.throwIfAborted()
      let result: unknown
      if (route === 'status') result = { ...protectionStatus(), roots, lifecycle: lifetime.status }
      else if (route === 'scan') {
        if (scanning) throw new SafetyError('SCAN_BUSY')
        if (typeof input.root !== 'number' || !Number.isSafeInteger(input.root) || !roots[input.root]) throw new SafetyError('ROOT_NOT_REGISTERED')
        scanning = true
        try { result = await scanNative({ ...await bundledHelper(), maxEntries: config.maxEntries }, roots[input.root]!, signal) }
        finally { scanning = false }
      } else throw new SafetyError('NOT_FOUND')
      if (!signal.aborted) res.end(JSON.stringify(result))
    } catch (error) {
      if (!signal.aborted && !res.destroyed) {
        const code = error instanceof SafetyError ? error.code : 'REQUEST_FAILED'
        res.statusCode = code === 'ORIGIN_REFUSED' ? 403 : code === 'SCAN_BUSY' ? 409 : 400
        res.end(JSON.stringify({ error: code }))
      }
    } finally { res.off('close', close); signal.removeEventListener('abort', abort) }
  }
  ctx.on('connection/request', async (req, res, next) => {
    if (!new URL(req.url ?? '/', 'http://localhost').pathname.startsWith(prefix)) return next()
    const work = handle(req, res); requests.add(work)
    try { await work } finally { requests.delete(work) }
  })
  lifetime.track(async () => { controller.abort(); await Promise.allSettled(requests) })
  ctx.effect(() => () => lifetime.close())
}
