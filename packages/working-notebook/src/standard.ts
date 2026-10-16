/** Standard DSH notebook: public query, tool and system-prompt services only. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import z from '@deepseek-ai/schemastery'
import { join } from 'node:path'
import { installContext } from './engine/standard-context.ts'
export const name = 'nidofy-working-notebook'
export const inject = ['connection', 'tools', 'sessionQuery', 'sessions', 'systemPrompt']
/** Bounds apply to complete snapshots, including retired entries and exact evidence. */
export interface Config { maxEntries: number; maxBytes: number; maxHistoryBytes: number }
export const Config: z<Config> = z.object({
  maxEntries: z.number().step(1).min(1).max(256).default(64),
  maxBytes: z.number().step(1).min(1024).max(262144).default(16384),
  maxHistoryBytes: z.number().step(1).min(65536).max(1073741824).default(16777216),
})
/** Mount reversible tools, logged turn snapshots and authenticated local note requests. */
export function apply(ctx: Context, config: Config): void {
  if (ctx.get('nidofyNotebookV2')) throw Error('NOTEBOOK_OWNER_ALREADY_MOUNTED')
  const request = installContext(ctx, join(resolveDshHome(), 'nidofy-extras/notebooks'), config)
  ctx.on('connection/request', async (incoming, response, next) => {
    const url = new URL(incoming.url ?? '/', 'http://localhost'), prefix = '/api/nidofy-notebook/'
    if (!url.pathname.startsWith(prefix)) return next()
    response.setHeader('cache-control', 'no-store'); response.setHeader('content-type', 'application/json')
    if (incoming.method !== 'POST') { response.writeHead(405); response.end('{}'); return }
    const lifetime = new AbortController()
    const disconnect = () => { if (!response.writableEnded) lifetime.abort() }
    incoming.once('aborted', disconnect); response.once('close', disconnect)
    try {
      const chunks: Buffer[] = []; let size = 0
      for await (const raw of incoming) {
        const bytes = Buffer.from(raw); size += bytes.length
        if (size > 128 * 1024) throw Error('NOTEBOOK_REQUEST_TOO_LARGE')
        chunks.push(bytes)
      }
      const input: unknown = JSON.parse(Buffer.concat(chunks).toString())
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('NOTEBOOK_INVALID_REQUEST')
      const method = url.pathname.slice(prefix.length)
      if (method === 'save-settings') throw Error('NOTEBOOK_ENHANCED_RUNTIME_REQUIRED')
      const value = method === 'settings' ? { mode: 'standard', autoOrganize: false, autoOrganizeSupported: false }
        : await request(method, input as Record<string, unknown>, lifetime.signal)
      response.end(JSON.stringify(value))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      response.writeHead(message.endsWith('CONFLICT') ? 409 : 400)
      response.end(JSON.stringify({ error: /^[A-Z][A-Z0-9_]+$/.test(message) ? message : 'NOTEBOOK_OPERATION_FAILED' }))
    } finally { incoming.off('aborted', disconnect); response.off('close', disconnect) }
  })
}
