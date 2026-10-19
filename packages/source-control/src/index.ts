import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-workspace'
import Schema from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SourceControl } from './service.ts'
import { VcsError } from './process.ts'
import type { Mutation } from './shared.ts'

export const name = 'nidofy-source-control'
export const inject = ['connection']
export interface Config { roots: string[]; includeWorkspaces: boolean; gitExecutable: string; hgExecutable: string }
export const Config: Schema<Config> = Schema.object({
  roots: Schema.array(Schema.string()).default([]).description('Absolute trusted repository roots, including nested repositories explicitly.'),
  includeWorkspaces: Schema.boolean().default(true).description('Include local repositories registered with DSH.'),
  gitExecutable: Schema.string().default('git'), hgExecutable: Schema.string().default('hg'),
})

export async function handleRequest(service: SourceControl, req: IncomingMessage, res: ServerResponse, signal: AbortSignal): Promise<void> {
  const abort = () => { req.destroy() }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { abort(); return }
  res.setHeader('cache-control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8')
  try {
    // All requests use JSON POST; simple cross-origin forms cannot invoke commands.
    if (req.method !== 'POST' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new VcsError('JSON_POST_REQUIRED')
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new VcsError('ORIGIN_REFUSED')
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new VcsError('ORIGIN_REFUSED')
    let size = 0; const chunks: Buffer[] = []
    for await (const chunk of req) { signal.throwIfAborted(); size += chunk.length; if (size > 65536) throw new VcsError('INPUT_LIMIT'); chunks.push(Buffer.from(chunk)) }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new VcsError('INVALID_INPUT')
    const data = input as Record<string, unknown>
    const route = new URL(req.url ?? '/', 'http://localhost').pathname.slice('/api/nidofy-vcs/'.length)
    let result: unknown
    if (route === 'repositories') result = await service.list(signal)
    else if (route === 'status') result = await service.status(data.id, signal)
    else if (route === 'diff') result = await service.diff(data.id, data.path, data.staged === true, signal)
    else if (route === 'history') result = await service.history(data.id, signal)
    else if (route === 'worktrees') result = await service.worktrees(data.id, signal)
    else if (route === 'mutate') result = await service.mutate(data as unknown as Mutation, signal)
    else throw new VcsError('NOT_FOUND')
    if (!signal.aborted) res.end(JSON.stringify(result))
  } catch (error) {
    if (signal.aborted || res.destroyed) return
    const code = error instanceof VcsError ? error.code : 'REQUEST_FAILED'
    res.statusCode = code === 'REVISION_CONFLICT' ? 409 : code === 'ORIGIN_REFUSED' ? 403 : code === 'NOT_FOUND' ? 404 : 400
    res.end(JSON.stringify({ error: code }))
  } finally { signal.removeEventListener('abort', abort) }
}
export function apply(ctx: Context, config: Config): void {
  const lifetime = new AbortController()
  const service = new SourceControl(() => [...config.roots, ...config.includeWorkspaces ? (ctx.get('workspaceRegistry')?.list() ?? []).map(w => w.path) : []], { git: config.gitExecutable, hg: config.hgExecutable })
  const requests = new Set<Promise<void>>()
  ctx.on('connection/request', async (req, res, next) => {
    if (!new URL(req.url ?? '/', 'http://localhost').pathname.startsWith('/api/nidofy-vcs/')) return next()
    const request = new AbortController(), abort = () => request.abort()
    res.once('close', abort)
    const work = handleRequest(service, req, res, AbortSignal.any([request.signal, lifetime.signal]))
    requests.add(work)
    try { await work } finally { res.off('close', abort); requests.delete(work) }
  })
  ctx.effect(() => async () => { lifetime.abort(); await service.close(); await Promise.allSettled(requests) })
}
