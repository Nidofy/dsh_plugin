import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import Schema from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute, join } from 'node:path'
import { Engine } from './engine.ts'
export { Engine } from './engine.ts'
import { mentor } from './mentor.ts'
import { askInfraTutor } from './tutor-context.ts'
import type { HelpLevel } from './types.ts'

export const name = 'ai-infra-lab'
export const inject = ['connection']

export interface Config {
  dataRoot?: string
  image: string
  timeoutMs?: number
  tutorTimeoutMs?: number
  maxCpus?: number
  outputBytes?: number
}

export const Config: Schema<Config> = Schema.object({
  dataRoot: Schema.string(),
  image: Schema.string().default('dsh-ai-infra-lab-cpu:0.1'),
  tutorTimeoutMs: Schema.natural().min(1000).max(600000).default(180000),
  timeoutMs: Schema.natural().min(1000).max(600000).default(90000),
  maxCpus: Schema.natural().min(1).max(8).default(4),
  outputBytes: Schema.natural().min(4096).max(4194304).default(262144),
})

function expectString(v: unknown, label = 'string'): string {
  if (typeof v !== 'string') throw Error(`Expected ${label}`)
  return v
}

function expectObject(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('Expected object')
  return v as Record<string, unknown>
}

function expectNumberMap(v: unknown): Record<string, number> {
  if (v === undefined || v === null) return {}
  return Object.fromEntries(
    Object.entries(expectObject(v)).map(([k, val]) => {
      if (typeof val !== 'number' || !Number.isFinite(val)) throw Error(`Expected finite number for ${k}`)
      return [k, val]
    }),
  )
}

export async function dispatch(
  engine: Engine,
  method: string,
  args: unknown[],
  tutor: (prompt: string) => Promise<{ status: string; text: string }>,
): Promise<unknown> {
  const id = () => expectString(args[0], 'id')
  switch (method) {
    case 'overview':
      return engine.overview()
    case 'workspace':
      return engine.workspace(id())
    case 'environment':
      return await engine.environment()
    case 'selectLesson':
      engine.selectLesson(id())
      return null
    case 'readLesson':
      engine.readLesson(id())
      return null
    case 'saveDraft':
      if (typeof args[2] !== 'number') throw Error('Expected draft revision')
      return engine.saveDraft(id(), expectString(args[1], 'code'), args[2])
    case 'saveNote':
      if (typeof args[2] !== 'number') throw Error('Expected note revision')
      return engine.saveNote(id(), expectString(args[1], 'note'), args[2])
    case 'saveProfile':
      if (typeof args[1] !== 'number') throw Error('Expected profile revision')
      return engine.saveProfile(
        Object.fromEntries(Object.entries(expectObject(args[0])).map(([k, v]) => [k, expectString(v, k)])),
        args[1],
      )
    case 'start':
      return await engine.start(
        id(),
        expectString(args[1], 'code'),
        expectNumberMap(args[2]),
        args[3] == null ? undefined : expectString(args[3], 'prediction'),
      )
    case 'run':
      return engine.run(id())
    case 'cancel':
      engine.cancel(id())
      return null
    case 'answer':
      return engine.answer(
        id(),
        expectString(args[1], 'answer'),
        args[2] == null ? undefined : expectString(args[2], 'runId'),
      )
    case 'completeSimulator':
      return engine.completeSimulator(id(), expectString(args[1], 'summaryJson'))
    case 'hint':
      return engine.hint(id(), expectString(args[1], 'level') as HelpLevel)
    case 'beginIndependent':
      engine.beginIndependent(id())
      return null
    case 'dismissReview':
      engine.dismissReview(id())
      return null
    case 'tutor':
      return await askInfraTutor(
        engine,
        id(),
        expectString(args[1], 'question'),
        (args[2] == null ? 'concept' : expectString(args[2], 'mode')) as HelpLevel,
        args[3] == null ? undefined : expectString(args[3], 'runId'),
        tutor,
      )
    case 'exportData':
      return engine.exportData()
    case 'importData':
      return engine.importData(expectString(args[0], 'rawJson'))
    default:
      throw Error(`Unknown AI Infra Lab RPC method: ${method}`)
  }
}

export async function handleRequest(
  engine: Engine,
  req: IncomingMessage,
  res: ServerResponse,
  signal: AbortSignal,
  tutor: (prompt: string) => Promise<{ status: string; text: string }>,
): Promise<void> {
  const abort = () => req.destroy()
  signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, 30000)
  if (signal.aborted) {
    abort()
    clearTimeout(timeout)
    return
  }
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  try {
    if (
      req.method !== 'POST' ||
      !/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')
    ) {
      throw Error('JSON POST required')
    }
    if (
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (req.headers.origin &&
        (!URL.canParse(req.headers.origin) ||
          new URL(req.headers.origin).host !== req.headers.host))
    ) {
      throw Error('Origin refused')
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      signal.throwIfAborted()
      size += chunk.length
      // A 4 MB archive string can approach 8 MB once escaped inside the RPC envelope.
      if (size > 8_000_128) throw Error('请求体过大 / Request payload too large')
      chunks.push(Buffer.from(chunk))
    }
    const payload = expectObject(JSON.parse(Buffer.concat(chunks).toString('utf8')))
    if (!Array.isArray(payload.args) || payload.args.length > 5) {
      throw Error('Invalid RPC arguments')
    }
    clearTimeout(timeout)
    const result = await dispatch(engine, expectString(payload.method, 'method'), payload.args, tutor)
    res.end(JSON.stringify(result ?? null))
  } catch (error) {
    const internal = error instanceof Error && ('code' in error || error instanceof TypeError)
    res.statusCode = internal ? 500 : 400
    res.end(
      JSON.stringify({
        error: internal
          ? 'AI Infra Lab internal error'
          : error instanceof Error
            ? error.message
            : 'Invalid request',
      }),
    )
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

export async function apply(ctx: Context, config: Config): Promise<void> {
  const tutorTimeoutMs = config.tutorTimeoutMs ?? 180000
  if (!Number.isInteger(tutorTimeoutMs) || tutorTimeoutMs < 1000 || tutorTimeoutMs > 600000) {
    throw Error('Invalid tutorTimeoutMs: expected integer 1000..600000')
  }
  const profileDir = ctx.get('profileContext')?.dir
  const root = config.dataRoot ?? (profileDir && join(profileDir, 'ai-infra-lab'))
  if (!root || !isAbsolute(root)) {
    throw Error('AI Infra Lab requires an absolute profile directory or dataRoot')
  }

  const engine = await Engine.open(root, config.image, {
    timeoutMs: config.timeoutMs,
    maxCpus: config.maxCpus,
    outputBytes: config.outputBytes,
  })
  const lifetime = new AbortController()
  const pending = new Set<Promise<void>>()
  let tutoring = false

  const ask = async (prompt: string) => {
    if (tutoring) return { status: 'unavailable', text: '导师正在回答其他问题 / Tutor is busy' }
    tutoring = true
    try {
      return await mentor(
        ctx,
        prompt,
        AbortSignal.any([lifetime.signal, AbortSignal.timeout(tutorTimeoutMs)]),
      )
    } finally {
      tutoring = false
    }
  }

  ctx.on('connection/request', async (req, res, next) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/api/ai-infra-lab/rpc') {
      return next()
    }
    if (lifetime.signal.aborted) {
      res.statusCode = 503
      res.end()
      return
    }
    const task = handleRequest(engine, req, res, lifetime.signal, ask)
    pending.add(task)
    try {
      await task
    } finally {
      pending.delete(task)
    }
  })

  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled([...pending])
    await engine.close()
  })
}
