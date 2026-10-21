import { Context } from '@deepseek-ai/cordis'
import * as Connection from '@deepseek-ai/dsh-client-connection'
import { createServer } from 'node:http'
import type { CredentialRecord } from '@deepseek-ai/dsh-credentials'
/** Uses the pinned official Connection admission + real Cordis plugin lifecycle. Temporary profiles only. */
export async function harness(options: { profile: string; plugin: object; html?: string; port?: number; extra?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void> }) {
  const ctx = new Context()
  let record: CredentialRecord | undefined
  ctx.provide('credentials', { modifyRecord: async (_: string, modify: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>) => {
    record = await modify(record) ?? record; return record
  } } as never)
  await ctx.plugin(Connection)
  ctx.provide('profileContext', { dir: options.profile } as never)
  let plugin = await ctx.plugin(options.plugin)
  const server = createServer(async (req, res) => {
    try {
      if ((req.url ?? '').startsWith('/api/')) {
        const admission = ctx.connection.admit(req)
        if ('rejection' in admission) { res.writeHead(admission.rejection).end(); return }
        await ctx.waterfall('connection/request', req, res, async () => {
          if (options.extra) await options.extra(req, res); else res.writeHead(404).end()
        }); return
      }
      if (!ctx.connection.authorizeIndex(req, res)) return
      res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(options.html ?? 'AI Village authenticated fixture')
    } catch { if (!res.headersSent) res.writeHead(500); res.end() }
  })
  await new Promise<void>(resolve => server.listen(options.port ?? 0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  return { ctx, url, entry: ctx.connection.authenticatedUrl(url),
    disable: async () => { await plugin.dispose() },
    enable: async () => { plugin = await ctx.plugin(options.plugin) },
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await ctx.fiber.dispose() },
  }
}
