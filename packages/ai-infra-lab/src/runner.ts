import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access, mkdir, readdir, rmdir, writeFile } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EnvironmentStatus, Exercise, ResourceProfile, RunEvent, RunRecord } from './types.ts'

const runtimeDir = fileURLToPath(new URL('../runtime', import.meta.url))
const prepareScriptPath = fileURLToPath(new URL('../scripts/prepare-image.ps1', import.meta.url))

const MAX_COMMAND_OUTPUT = 262144

export interface RunnerLimits {
  timeoutMs?: number
  outputBytes?: number
  maxCpus?: number
}

export interface RunnerBackend {
  readonly runnerProfile: 'cpu' | 'remote-gpu'
  environment(): Promise<EnvironmentStatus>
  execute(
    run: RunRecord,
    exercise: Exercise,
    signal: AbortSignal,
    onUpdate?: (run: RunRecord) => void,
  ): Promise<RunRecord>
  recover(run: RunRecord): Promise<void>
}

export interface ProfileEnvelope {
  cpus: number
  memoryMb: number
  pidsLimit: number
  tmpfsMb: number
  shmMb?: number
  extraEnv: string[]
}

export function resolveResourceEnvelope(
  profile: ResourceProfile,
  hostCpus = availableParallelism(),
  maxCap = 4,
): ProfileEnvelope {
  const effectiveMulti = Math.max(1, Math.min(hostCpus, maxCap, 4))
  switch (profile) {
    case 'multicore-cpu':
      return {
        cpus: effectiveMulti,
        memoryMb: 768,
        pidsLimit: 128,
        tmpfsMb: 64,
        extraEnv: ['OMP_NUM_THREADS=1', 'MKL_NUM_THREADS=1', 'OPENBLAS_NUM_THREADS=1'],
      }
    case 'distributed-gloo':
      return {
        cpus: effectiveMulti,
        memoryMb: 1536,
        pidsLimit: 256,
        tmpfsMb: 128,
        shmMb: 256,
        extraEnv: [
          'OMP_NUM_THREADS=1',
          'MKL_NUM_THREADS=1',
          'OPENBLAS_NUM_THREADS=1',
          'MASTER_ADDR=127.0.0.1',
          'GLOO_SOCKET_IFNAME=lo',
        ],
      }
    case 'scalar-cpu':
    default:
      return {
        cpus: 1,
        memoryMb: 512,
        pidsLimit: 64,
        tmpfsMb: 64,
        extraEnv: ['OMP_NUM_THREADS=1', 'MKL_NUM_THREADS=1', 'OPENBLAS_NUM_THREADS=1'],
      }
  }
}

async function resolveDockerExecutable(): Promise<string> {
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

export async function runDockerCommand(
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
      out = (out + d.toString()).slice(-MAX_COMMAND_OUTPUT)
    })
    p.stderr.on('data', (d: Buffer) => {
      out = (out + d.toString()).slice(-MAX_COMMAND_OUTPUT)
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

export function validateRunEvent(e: RunEvent, expectedRunId: string, expectedSeq: number): void {
  if (
    e.runId !== expectedRunId ||
    e.seq !== expectedSeq ||
    !['metric', 'check', 'config', 'roofline_point'].includes(e.type) ||
    typeof e.name !== 'string' ||
    e.name.length === 0 ||
    e.name.length > 200
  ) {
    throw Error('Invalid run event identity')
  }
  if (e.step !== undefined && (typeof e.step !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(e.step))) {
    throw Error('Invalid step identifier')
  }
  if (e.detail !== undefined && (typeof e.detail !== 'string' || e.detail.length > 4000)) {
    throw Error('Invalid event detail')
  }
  if (e.value !== undefined && (typeof e.value !== 'number' || !Number.isFinite(e.value))) {
    throw Error('Invalid metric value')
  }
  if (e.type === 'check' && typeof e.passed !== 'boolean') {
    throw Error('Check event must provide boolean passed')
  }
  if (e.type === 'roofline_point') {
    if (
      typeof e.arithmeticIntensity !== 'number' ||
      !Number.isFinite(e.arithmeticIntensity) ||
      e.arithmeticIntensity <= 0 ||
      typeof e.gflops !== 'number' ||
      !Number.isFinite(e.gflops) ||
      e.gflops < 0
    ) {
      throw Error('Invalid roofline_point payload')
    }
  }
}

export class LocalDockerCpuRunner implements RunnerBackend {
  readonly runnerProfile = 'cpu' as const
  private limits: Required<RunnerLimits>

  constructor(
    private root: string,
    private image = 'dsh-ai-infra-lab-cpu:0.1',
    limits: RunnerLimits = {},
    private dockerCommand: typeof runDockerCommand = runDockerCommand,
  ) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9./_:@-]{0,254}$/.test(image)) {
      throw Error('Invalid Docker image reference')
    }
    this.limits = {
      timeoutMs: limits.timeoutMs ?? 90000,
      outputBytes: limits.outputBytes ?? 262144,
      maxCpus: limits.maxCpus ?? 4,
    }
  }

  private ownerLabel(): string {
    return createHash('sha256').update(resolve(this.root)).digest('hex').slice(0, 12)
  }

  private prepareCmd(): string {
    return `powershell -ExecutionPolicy Bypass -File "${prepareScriptPath}" -Image "${this.image}"`
  }

  async environment(): Promise<EnvironmentStatus> {
    const hostCpus = availableParallelism()
    const prepareCommand = this.prepareCmd()
    try {
      const exe = await resolveDockerExecutable()
      const daemon = await this.dockerCommand(exe, ['version', '--format', '{{.Server.Os}}/{{.Server.Version}}'])
      if (daemon.code !== 0) {
        return {
          stage: 'docker_unavailable',
          available: false,
          image: this.image,
          hostCpus,
          estimatedImageSizeGb: 1.34,
          prepareCommand,
          detail: {
            zh: 'Docker Linux 守护进程未启动。请先打开 Docker Desktop；在此之前，讲义阅读、小测、容量估算题与交互模拟器仍可正常使用。',
            en: 'Docker Linux daemon is not running. Start Docker Desktop for code labs; lectures, quizzes, estimates, and interactive simulators remain usable.',
          },
        }
      }
      const inspect = await this.dockerCommand(exe, ['image', 'inspect', this.image, '--format', '{{.Id}}'])
      if (inspect.code !== 0) {
        return {
          stage: 'image_missing',
          available: false,
          image: this.image,
          hostCpus,
          estimatedImageSizeGb: 1.34,
          prepareCommand,
          detail: {
            zh: `本地尚未准备实验镜像 ${this.image}（解压约 1.34 GB）。请复制下方命令在终端显式构建或导入镜像。`,
            en: `Local lab image ${this.image} (~1.34 GB unpacked) is not prepared yet. Run the preparation command below.`,
          },
        }
      }
      const id = inspect.out.trim()
      if (!/^sha256:[a-f0-9]{64}$/.test(id)) {
        return {
          stage: 'inspection_failed',
          available: false,
          image: this.image,
          hostCpus,
          estimatedImageSizeGb: 1.34,
          prepareCommand,
          detail: {
            zh: `镜像标识校验异常：${id.slice(0, 120)}`,
            en: `Unexpected image digest output: ${id.slice(0, 120)}`,
          },
        }
      }
      return {
        stage: 'ready',
        available: true,
        image: this.image,
        resolvedImageId: id,
        hostCpus,
        estimatedImageSizeGb: 1.34,
        prepareCommand,
        detail: {
          zh: `Docker CPU 隔离环境已就绪（宿主机 ${hostCpus} 逻辑核，镜像 ${id.slice(7, 19)}）。`,
          en: `Docker CPU sandbox ready (${hostCpus} host logical cores, image ${id.slice(7, 19)}).`,
        },
      }
    } catch (error) {
      return {
        stage: 'docker_unavailable',
        available: false,
        image: this.image,
        hostCpus,
        estimatedImageSizeGb: 1.34,
        prepareCommand,
        detail: {
          zh: `无法连接 Docker：${String(error).slice(0, 160)}`,
          en: `Cannot reach Docker: ${String(error).slice(0, 160)}`,
        },
      }
    }
  }

  async recover(run: RunRecord): Promise<void> {
    if (!run.cleanupPending) return
    const exe = await resolveDockerExecutable()
    const owner = this.ownerLabel()
    const listed = await this.dockerCommand(exe, [
      'ps',
      '-aq',
      '--filter',
      'label=ai-infra-lab.owner=' + owner,
      '--filter',
      `name=^ai-infra-lab-${owner}-${run.id}$`,
    ])
    if (listed.code !== 0) throw Error(listed.out || 'Failed to inspect leftover containers')
    const ids = listed.out.split(/\r?\n/).filter(Boolean)
    if (ids.length) {
      const removed = await this.dockerCommand(exe, ['rm', '-f', ...ids])
      if (removed.code !== 0) throw Error(removed.out || 'Failed to remove leftover container')
    }
  }

  async execute(
    run: RunRecord,
    exercise: Exercise,
    signal: AbortSignal,
    onUpdate?: (run: RunRecord) => void,
  ): Promise<RunRecord> {
    const r: RunRecord = structuredClone(run)
    r.run_status = 'running'
    const env = await this.environment()
    r.requestedImage = this.image
    r.resolvedImageId = env.resolvedImageId
    const profile: ResourceProfile = exercise.resourceProfile ?? 'scalar-cpu'
    r.resourceProfile = profile
    const envelope = resolveResourceEnvelope(profile, env.hostCpus, this.limits.maxCpus)
    r.environment = `${env.detail.en} [profile=${profile}, cpus=${envelope.cpus}, mem=${envelope.memoryMb}m]`

    const finish = async (): Promise<RunRecord> => {
      r.finishedAt = new Date().toISOString()
      const dir = resolve(this.root, r.id)
      try {
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'result.json'), JSON.stringify(r, null, 2))
        await writeFile(join(dir, 'events.jsonl'), r.events.map((e) => JSON.stringify(e)).join('\n'))
      } catch {}
      return r
    }

    if (!env.available || !env.resolvedImageId) {
      r.run_status = 'failed'
      r.check_status = 'inconclusive'
      r.reason = `${env.detail.zh} / ${env.detail.en}`
      return finish()
    }

    onUpdate?.({ ...r, cleanupPending: 'Pending container execution confirmation' })
    const dir = resolve(this.root, r.id)
    await mkdir(this.root, { recursive: true })
    await mkdir(dir, { recursive: true })
    if ((await readdir(this.root)).length > 4096) {
      await rmdir(dir).catch(() => {})
      throw Error('运行归档已满，请先导出并清理旧记录 / Run archive full')
    }
    await writeFile(join(dir, 'submission.py'), r.code)
    await writeFile(join(dir, 'snapshot.json'), JSON.stringify(r))

    const exe = await resolveDockerExecutable()
    const owner = this.ownerLabel()
    const containerName = `ai-infra-lab-${owner}-${r.id}`
    let created = false
    let containerId = containerName
    let cancelled = false
    let timedOut = false
    let overflow = false
    let complete = false
    let lastFlush = 0
    let buffer = ''
    let totalBytes = 0
    const stderrDecoder = new TextDecoder()

    let cleanupPromise: Promise<void> | undefined
    const cleanup = (): Promise<void> =>
      (cleanupPromise ??= (async () => {
        try {
          const removed = await this.dockerCommand(exe, ['rm', '-f', containerId])
          if (removed.code !== 0 && !removed.out.includes('No such container')) {
            throw Error(removed.out)
          }
        } catch (error) {
          r.cleanupPending = containerName
          r.log += '\nContainer cleanup not confirmed: ' + String(error)
        }
      })())

    try {
      if (signal.aborted) {
        r.run_status = 'cancelled'
        r.check_status = 'inconclusive'
        return finish()
      }

      const createArgs: string[] = [
        'create',
        '--label',
        'ai-infra-lab.owner=' + owner,
        '--pull=never',
        '--rm',
        '--name',
        containerName,
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
        String(envelope.pidsLimit),
        '--memory',
        `${envelope.memoryMb}m`,
        '--cpus',
        String(envelope.cpus),
        '--tmpfs',
        `/tmp:rw,noexec,nosuid,size=${envelope.tmpfsMb}m`,
        ...(envelope.shmMb ? ['--shm-size', `${envelope.shmMb}m`] : []),
        '--user',
        '0:0',
        '-e',
        'PYTHONDONTWRITEBYTECODE=1',
        ...envelope.extraEnv.flatMap((pair) => ['-e', pair]),
        '--mount',
        `type=bind,source=${dir},target=/work,readonly`,
        '--mount',
        `type=bind,source=${runtimeDir},target=/runtime,readonly`,
        env.resolvedImageId,
        'python',
        '/runtime/controller.py',
        exercise.runtimeKey!,
        r.id,
        String(r.seed),
        JSON.stringify(r.config ?? {}),
      ]

      const creation = await this.dockerCommand(exe, createArgs)
      if (creation.code !== 0) throw Error(creation.out || 'Failed to create container')
      containerId = creation.out.trim()
      if (!/^[a-f0-9]{64}$/.test(containerId)) throw Error('Missing container ID from docker create')
      created = true

      if (signal.aborted) {
        r.run_status = 'cancelled'
        r.check_status = 'inconclusive'
      } else {
        await new Promise<void>((resolveRun, rejectRun) => {
          const p = spawn(exe, ['start', '-a', containerId], { windowsHide: true })
          const stop = () => {
            void cleanup()
            p.kill()
          }
          const onAbort = () => {
            cancelled = true
            stop()
          }
          signal.addEventListener('abort', onAbort, { once: true })
          if (signal.aborted) onAbort()

          const timer = setTimeout(() => {
            timedOut = true
            stop()
          }, this.limits.timeoutMs)

          p.stdout.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > this.limits.outputBytes) {
              overflow = true
              stop()
              return
            }
            buffer += chunk.toString('utf8')
            let nl: number
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).trim()
              buffer = buffer.slice(nl + 1)
              if (!line) continue
              try {
                if (complete) throw Error('Unexpected output after controller_complete')
                const parsed: unknown = JSON.parse(line)
                if (!parsed || typeof parsed !== 'object') throw Error('Malformed event JSON')
                if ('controller_complete' in parsed) {
                  complete = (parsed as { controller_complete?: unknown }).controller_complete === true
                  continue
                }
                const ev = parsed as RunEvent
                if (r.events.length >= 512) throw Error('Event count limit exceeded')
                validateRunEvent(ev, r.id, r.events.length + 1)
                r.events.push(ev)
                if (Date.now() - lastFlush > 150) {
                  lastFlush = Date.now()
                  onUpdate?.({ ...r })
                }
              } catch (err) {
                r.log += `\nProtocol violation: ${String(err)} (${line.slice(0, 120)})`
                overflow = true
                stop()
                return
              }
            }
          })

          p.stderr.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > this.limits.outputBytes) {
              overflow = true
              stop()
              return
            }
            r.log = (r.log + stderrDecoder.decode(chunk, { stream: true })).slice(-this.limits.outputBytes)
          })

          p.on('error', (err) => {
            clearTimeout(timer)
            signal.removeEventListener('abort', onAbort)
            rejectRun(err)
          })

          p.on('close', (code) => {
            clearTimeout(timer)
            signal.removeEventListener('abort', onAbort)
            r.log = (r.log + stderrDecoder.decode()).slice(-this.limits.outputBytes)
            const checks = r.events.filter((e) => e.type === 'check')
            if (cancelled) {
              r.run_status = 'cancelled'
              r.check_status = 'inconclusive'
              r.reason = '已取消运行 / Run cancelled'
            } else if (timedOut) {
              r.run_status = 'timed_out'
              r.check_status = 'inconclusive'
              r.reason = '运行超时（可能存在死循环或进程阻塞） / Execution timed out'
            } else if (overflow || buffer.trim().length > 0) {
              r.run_status = 'failed'
              r.check_status = 'inconclusive'
              r.reason = overflow ? '标准输出超出上限或协议异常 / Output limit or protocol error' : 'Incomplete trailing output'
            } else if (code === 0 && complete) {
              r.run_status = 'completed'
              r.check_status = checks.length === 0 ? 'inconclusive' : checks.every((c) => c.passed) ? 'passed' : 'failed'
            } else {
              r.run_status = 'failed'
              r.check_status = 'inconclusive'
              r.reason = `容器退出码 / Container exit code ${code ?? -1}`
            }
            resolveRun()
          })
        })
      }
    } finally {
      if (created) await cleanup()
    }

    if (!r.cleanupPending) delete r.cleanupPending
    return finish()
  }
}
