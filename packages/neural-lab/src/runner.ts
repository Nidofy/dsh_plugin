import { trainingDataset } from './training-protocol.ts'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

import { mkdir, readdir, rmdir, writeFile, access } from 'node:fs/promises'

import { join, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'

import type { EnvironmentStatus, Exercise, RunEvent, RunRecord } from './types.ts'

const runtime = fileURLToPath(new URL('../runtime', import.meta.url))

const MAX_OUTPUT = 262144

async function dockerPath(): Promise<string> {
  if (process.platform === 'win32') {
    const candidate = join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'Docker',
      'Docker',
      'resources',
      'bin',
      'docker.exe',
    )
    try {
      await access(candidate)
      return candidate
    } catch {}
  }
  return 'docker'
}

async function command(
  exe: string,
  args: string[],
  timeout = 15000,
): Promise<{ code: number; out: string }> {
  return await new Promise((res, rej) => {
    const p = spawn(exe, args, { windowsHide: true })
    let out = ''
    const timer = setTimeout(() => {
      p.kill()
      rej(new Error('Docker command timed out'))
    }, timeout)
    p.stdout.on('data', (d: Buffer) => {
      out = (out + d.toString()).slice(-MAX_OUTPUT)
    })
    p.stderr.on('data', (d: Buffer) => {
      out = (out + d.toString()).slice(-MAX_OUTPUT)
    })
    p.on('error', (e) => {
      clearTimeout(timer)
      rej(e)
    })
    p.on('close', (code) => {
      clearTimeout(timer)
      res({ code: code ?? -1, out })
    })
  })
}

export interface RunnerLimits {
  timeoutMs?: number
  memoryMb?: number
  cpus?: number
  outputBytes?: number
}

export class Runner {
  private limits: Required<RunnerLimits>

  constructor(
    private root: string,
    private image = 'dsh-neural-lab-cpu:0.1',
    limits: RunnerLimits = {},
    private dockerCommand: typeof command = command,
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9./_:@-]{0,254}$/.test(image))
      throw Error('Invalid Docker image reference')
    this.limits = {
      timeoutMs: limits.timeoutMs ?? 120000,
      memoryMb: limits.memoryMb ?? 1024,
      cpus: limits.cpus ?? 1,
      outputBytes: limits.outputBytes ?? 262144,
    }

    const l = this.limits
    if (
      !Number.isInteger(l.timeoutMs) ||
      l.timeoutMs < 1000 ||
      l.timeoutMs > 600000 ||
      !Number.isInteger(l.memoryMb) ||
      l.memoryMb < 256 ||
      l.memoryMb > 8192 ||
      !Number.isFinite(l.cpus) ||
      l.cpus < 0.25 ||
      l.cpus > 8 ||
      !Number.isInteger(l.outputBytes) ||
      l.outputBytes < 4096 ||
      l.outputBytes > 4194304
    )
      throw new Error('Invalid runner resource limits')
  }

  private ownerLabel(): string {
    return createHash('sha256').update(resolve(this.root)).digest('hex').slice(0, 16)
  }
  async recover(run: RunRecord): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(run.id)) return
    const owner = this.ownerLabel()
    const name = 'neural-lab-' + owner + '-' + run.id
    const exe = await dockerPath()
    const found = await this.dockerCommand(exe, [
      'ps',
      '-aq',
      '--no-trunc',
      '--filter',
      'name=^/' + name + '$',
      '--filter',
      'label=neural-lab.owner=' + owner,
    ])
    if (found.code !== 0) throw Error(found.out)
    const id = found.out.trim()
    if (id) {
      if (!/^[a-f0-9]{64}$/.test(id)) throw Error('Ambiguous recovery identity')
      const removed = await this.dockerCommand(exe, ['rm', '-f', id])
      if (removed.code && !removed.out.includes('No such container')) throw Error(removed.out)
    }
  }

  async environment(): Promise<EnvironmentStatus> {
    try {
      const exe = await dockerPath()
      const r = await this.dockerCommand(exe, [
        'image',
        'inspect',
        this.image,
        '--format',
        '{{.Id}}',
      ])
      if (r.code !== 0) throw new Error(r.out)
      const p = await this.dockerCommand(exe, ['version', '--format', '{{.Server.Version}}'])
      if (p.code !== 0) throw new Error(p.out)
      if (!/^sha256:[0-9a-f]{64}$/.test(r.out.trim())) throw Error('Invalid Docker image identity')
      return {
        available: true,
        requestedImage: this.image,
        resolvedImageId: r.out.trim(),
        detail: r.out.trim() + ' ' + p.out.trim(),
        image: this.image,
      }
    } catch (e) {
      return { available: false, requestedImage: this.image, detail: String(e), image: this.image }
    }
  }

  async execute(
    original: RunRecord,
    exercise: Exercise,
    signal: AbortSignal,
    onUpdate?: (r: RunRecord) => void,
  ): Promise<RunRecord> {
    const r: RunRecord = {
      ...original,
      effectiveConfig: undefined,
      events: [],
      log: '',
      check_status: 'not_run',
      run_status: 'running',
    }

    const finish = () => {
      r.finishedAt = new Date().toISOString()
      onUpdate?.({ ...r })
      return r
    }

    if (signal.aborted) {
      r.run_status = 'cancelled'
      return finish()
    }

    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) ||
      !exercise.runtimeKey ||
      !/^(code\d{2}|grad|mlp|train-mlp-v1|train-char-v1|softmax|attention|causal|lm)$/.test(
        exercise.runtimeKey,
      )
    )
      throw new Error('Invalid run identity')

    const env = await this.environment()
    if (signal.aborted) {
      r.run_status = 'cancelled'
      return finish()
    }
    r.environment = env.detail
    r.requestedImage = env.requestedImage
    r.resolvedImageId = env.resolvedImageId
    if (!env.available || !env.resolvedImageId) {
      r.run_status = 'failed'
      r.reason = env.detail
      return finish()
    }

    onUpdate?.({ ...r, cleanupPending: 'Check labelled container after interrupted execution' })
    const dir = resolve(this.root, r.id)
    await mkdir(this.root, { recursive: true })
    await mkdir(dir)
    if ((await readdir(this.root)).length > 4096) {
      await rmdir(dir)
      throw Error(
        '运行归档已满，请停用后归档较早的运行目录 / Archive older run directories before retrying',
      )
    }
    await writeFile(join(dir, 'submission.py'), r.code)
    await writeFile(join(dir, 'snapshot.json'), JSON.stringify(r))

    const exe = await dockerPath()
    const owner = this.ownerLabel()
    const name = `neural-lab-${owner}-${r.id}`
    let created = false
    let containerId = name
    let cancelled = false,
      timedOut = false,
      overflow = false,
      complete = false
    let lastUpdate = 0
    const stderrDecoder = new TextDecoder()
    let buffer = '',
      size = 0

    const limit = this.limits.timeoutMs
    const outputLimit = this.limits.outputBytes

    let cleanupPromise: Promise<void> | undefined
    const cleanup = (): Promise<void> =>
      (cleanupPromise ??= (async () => {
        try {
          const removed = await this.dockerCommand(exe, ['rm', '-f', containerId])
          if (removed.code !== 0 && !removed.out.includes('No such container'))
            throw Error(removed.out)
        } catch (error) {
          r.cleanupPending = name
          r.log += '\nContainer cleanup not confirmed: ' + String(error)
        }
      })())

    try {
      if (signal.aborted) {
        r.run_status = 'cancelled'
        return finish()
      }
      const creation = await this.dockerCommand(exe, [
        'create',
        '--label',
        'neural-lab.owner=' + owner,
        '--pull=never',
        '--rm',
        '--name',
        name,
        '--network',
        'none',
        '--read-only',
        '--cap-drop',
        'ALL',
        '--cap-add',
        'SETUID',
        '--cap-add',
        'SETGID',
        '--cap-add',
        'KILL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '64',
        '--memory',
        String(this.limits.memoryMb) + 'm',
        '--cpus',
        String(this.limits.cpus),
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=64m',
        '--user',
        '0:0',
        '-e',
        'OMP_NUM_THREADS=1',
        '-e',
        'MKL_NUM_THREADS=1',
        '-e',
        'PYTHONDONTWRITEBYTECODE=1',
        '--mount',
        `type=bind,source=${dir},target=/work,readonly`,
        '--mount',
        `type=bind,source=${runtime},target=/runtime,readonly`,
        env.resolvedImageId,
        'python',
        '/runtime/controller.py',
        exercise.runtimeKey!,
        r.id,
        String(r.seed),
        ...(trainingDataset(exercise.runtimeKey) ? [String(r.config.learningRate ?? 0.05)] : []),
      ])
      if (creation.code !== 0) throw Error(creation.out)
      containerId = creation.out.trim()
      if (!/^[a-f0-9]{64}$/.test(containerId)) throw Error('Missing container identity')
      created = true
      if (signal.aborted) {
        r.run_status = 'cancelled'
      } else
        await new Promise<void>((resolvePromise, reject) => {
          const p = spawn(exe, ['start', '-a', containerId], { windowsHide: true })

          const stop = () => {
            void cleanup()
            p.kill()
          }
          const abort = () => {
            cancelled = true
            stop()
          }
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()

          const timer = setTimeout(() => {
            timedOut = true
            stop()
          }, limit)

          p.stdout.on('data', (data: Buffer) => {
            size += data.length
            if (size > outputLimit) {
              overflow = true
              stop()
              return
            }
            // Python json.dumps escapes non-ASCII protocol text.
            buffer += data.toString()
            let nl: number
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl)
              buffer = buffer.slice(nl + 1)
              try {
                if (complete) throw new Error('Event after completion')
                const event: unknown = JSON.parse(line)
                if (typeof event !== 'object' || event === null) throw new Error('Invalid event')
                if ('controller_complete' in event) {
                  complete = event.controller_complete === true
                  continue
                }
                const e = event as RunEvent
                if (
                  e.runId !== r.id ||
                  e.seq !== r.events.length + 1 ||
                  !['metric', 'tensor', 'check', 'config', 'manifest', 'sample'].includes(e.type) ||
                  typeof e.name !== 'string' ||
                  e.name.length > 200 ||
                  (e.detail !== undefined &&
                    (typeof e.detail !== 'string' || e.detail.length > 4000))
                )
                  throw new Error('Invalid event identity')
                if (
                  e.type === 'sample' &&
                  (exercise.runtimeKey !== 'train-char-v1' ||
                    typeof e.detail !== 'string' ||
                    !/^[abcde]{17}$/.test(e.detail))
                )
                  throw Error('Invalid character sample')
                if (e.type === 'manifest') {
                  const m = e.manifest
                  if (
                    !trainingDataset(exercise.runtimeKey) ||
                    r.trainingManifest ||
                    !m ||
                    m.protocol !== exercise.runtimeKey ||
                    m.dataset !== trainingDataset(exercise.runtimeKey) ||
                    ![m.splitHash, m.initialHash, m.batchHash].every(
                      (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h),
                    )
                  )
                    throw Error('Invalid training manifest')
                  r.trainingManifest = m
                }
                if (e.type === 'config') {
                  if (
                    r.effectiveConfig !== undefined ||
                    e.config === undefined ||
                    typeof e.config !== 'object' ||
                    e.config === null ||
                    Object.keys(e.config).length > 8 ||
                    Object.values(e.config).some(
                      (v) =>
                        typeof v !== 'boolean' &&
                        (typeof v === 'number'
                          ? !Number.isFinite(v)
                          : !Array.isArray(v) ||
                            v.length > 12 ||
                            v.some((n) => typeof n !== 'number' || !Number.isFinite(n))),
                    )
                  )
                    throw new Error('Invalid effective configuration')
                  r.effectiveConfig = e.config
                }
                if (e.type === 'metric' && !Number.isFinite(e.value))
                  throw new Error('Invalid metric')
                if (
                  e.type === 'tensor' &&
                  (!Array.isArray(e.data) ||
                    e.data.length > 128 ||
                    e.data.some(
                      (row) =>
                        !Array.isArray(row) ||
                        row.length > 128 ||
                        row.some((v) => !Number.isFinite(v)),
                    ))
                )
                  throw new Error('Invalid tensor')
                if (e.type === 'check' && typeof e.passed !== 'boolean')
                  throw new Error('Invalid check')
                r.events.push(e)
                if (r.events.length === 1 || Date.now() - lastUpdate >= 250) {
                  lastUpdate = Date.now()
                  onUpdate?.({
                    ...r,
                    cleanupPending: 'Check labelled container after interrupted execution',
                  })
                }
              } catch (err) {
                r.log += String(err) + '\n'
                overflow = true
                stop()
              }
            }
          })

          p.stderr.on('data', (data: Buffer) => {
            size += data.length
            r.log = (r.log + stderrDecoder.decode(data, { stream: true })).slice(0, outputLimit)
            if (size > outputLimit) {
              overflow = true
              stop()
            }
          })

          p.on('error', (error) => {
            clearTimeout(timer)
            signal.removeEventListener('abort', abort)
            reject(error)
          })
          p.on('close', (code) => {
            clearTimeout(timer)
            signal.removeEventListener('abort', abort)
            if (cancelled) r.run_status = 'cancelled'
            else if (timedOut) r.run_status = 'timed_out'
            else if (overflow || code !== 0 || !complete || buffer.trim() !== '') {
              r.run_status = 'failed'
              r.reason = overflow
                ? 'Output/protocol limit'
                : `Controller exit ${code}; completion=${complete}`
            } else {
              r.run_status = 'completed'
              const checks = r.events.filter((e) => e.type === 'check')
              r.check_status =
                checks.length === 0
                  ? 'inconclusive'
                  : checks.every((e) => e.passed)
                    ? 'passed'
                    : 'failed'
            }
            resolvePromise()
          })
        })
    } catch (e) {
      r.run_status = 'failed'
      r.reason = String(e)
    } finally {
      if (created) await cleanup()
      else if (r.run_status === 'failed') r.cleanupPending = name
      if (r.cleanupPending && r.run_status === 'completed') {
        r.run_status = 'failed'
        r.check_status = 'inconclusive'
      }
    }

    r.finishedAt = new Date().toISOString()
    await writeFile(join(dir, 'events.jsonl'), r.events.map((e) => JSON.stringify(e)).join('\n'))
    r.events.push({
      runId: r.id,
      seq: r.events.length + 1,
      type: 'artifact',
      name: 'Raw execution events / 原始运行事件',
      path: 'events.jsonl',
    })
    r.events.push({
      runId: r.id,
      seq: r.events.length + 1,
      type: 'artifact',
      name: 'Run snapshot / 运行快照',
      path: 'result.json',
    })
    await writeFile(join(dir, 'result.json'), JSON.stringify(r))
    return finish()
  }
}
