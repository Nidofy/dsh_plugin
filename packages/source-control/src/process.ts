import { spawn } from 'node:child_process'
import { join, delimiter, isAbsolute, relative, sep, extname } from 'node:path'
import { access, realpath, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import type { Vcs } from './shared.ts'

export class VcsError extends Error {
  constructor(public code: string) { super(code) }
}
export interface Executables { git?: string; hg?: string }
/** Resolve only explicit absolute paths or absolute PATH entries outside the repository.
 * Never ask Windows to search the command's working directory. */
export async function resolveExecutable(name: string, cwd: string): Promise<string> {
  if (!name || (!isAbsolute(name) && /[\\/]/.test(name))) throw new VcsError('ABSOLUTE_EXECUTABLE_REQUIRED')
  const candidates = isAbsolute(name) ? [name] : (process.env.PATH ?? '').split(delimiter)
    .filter(dir => isAbsolute(dir)).flatMap(dir => process.platform === 'win32' && !extname(name) ? [join(dir, name + '.exe')] : [join(dir, name)])
  for (const candidate of candidates) {
    try {
      const path = await realpath(candidate), root = await realpath(cwd), rel = relative(root, path)
      if (rel === '' || (!rel.startsWith('..' + sep) && !isAbsolute(rel))) continue
      if (!(await stat(path)).isFile()) continue
      await access(path, constants.X_OK)
      return path
    } catch (error) { if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error }
  }
  throw new VcsError('TOOL_MISSING')
}
/** No shell or user-controlled options. Repo configuration/hooks retain normal CLI semantics. */
export async function command(vcs: Vcs, args: string[], cwd: string, signal: AbortSignal, executables: Executables = {}, accepted = [0]): Promise<string> {
  signal.throwIfAborted()
  const executable = await resolveExecutable(executables[vcs] ?? vcs, cwd)
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', GIT_LITERAL_PATHSPECS: '1', GIT_OPTIONAL_LOCKS: '0', HGPLAIN: '1', HGENCODING: 'utf-8', LC_ALL: 'C', PAGER: 'cat' }
    for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG|CEILING_DIRECTORIES)/.test(key)) delete env[key as keyof typeof env]
    const child = spawn(executable, vcs === 'git' ? ['--no-pager', ...args] : ['--noninteractive', ...args], {
      cwd, env, shell: false, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []; let size = 0, failure: Error | undefined
    let forcedClose: ReturnType<typeof setTimeout> | undefined
    const stop = (error: Error) => {
      if (failure) return
      failure = error
      // A descendant may retain pipes after the direct child has exited. Bound the
      // request lifetime independently of close; cancellation never implies rollback.
      forcedClose = setTimeout(() => {
        child.stdout.destroy(); child.stderr.destroy()
        clearTimeout(timer); signal.removeEventListener('abort', abort); reject(error)
      }, 1000)
      if (child.pid && child.exitCode === null) {
        if (process.platform === 'win32') {
          // Git hooks and credential helpers can hold pipes open: cancel the owned process tree.
          const killer = spawn(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
          killer.once('error', () => child.kill())
          killer.once('close', code => { if (code !== 0) child.kill() })
        } else { try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill() } }
      } else child.kill()
    }
    const abort = () => stop(new VcsError('CANCELLED'))
    const timer = setTimeout(() => stop(new VcsError('TIMEOUT')), 45000)
    signal.addEventListener('abort', abort, { once: true })
    const collect = (chunk: Buffer, output: boolean) => { size += chunk.length; if (size > 4 * 1024 * 1024) stop(new VcsError('OUTPUT_LIMIT')); else if (output) chunks.push(chunk) }
    child.stdout.on('data', chunk => collect(chunk, true))
    child.stderr.on('data', chunk => collect(chunk, false))
    child.on('error', error => { failure = new VcsError((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'TOOL_MISSING' : 'COMMAND_FAILED') })
    child.once('close', code => {
      clearTimeout(forcedClose); clearTimeout(timer); signal.removeEventListener('abort', abort)
      if (failure) reject(failure)
      else if (!accepted.includes(code ?? -1)) reject(new VcsError('COMMAND_FAILED'))
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    if (signal.aborted) abort()
  })
}
