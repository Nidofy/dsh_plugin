/** Durable notebook file publication; never falls back to unsynced writes. */
import { writeFile, open, rename, rm, stat, mkdir, mkdtemp, rmdir } from 'node:fs/promises'
import { dirname, toNamespacedPath, resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
let move: ((source: string, target: string, flags: number) => number) | undefined
let lastError: (() => number) | undefined
export async function syncFile(path: string): Promise<void> {
  const handle = await open(path, 'r+')
  try { await handle.sync() } finally { await handle.close() }
}
export async function syncDirectory(path: string): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await open(path, 'r')
  try { await handle.sync() } finally { await handle.close() }
}
export async function publishSyncedFile(source: string, target: string, replace = true): Promise<void> {
  if (process.platform !== 'win32') { await rename(source, target); await syncDirectory(dirname(target)); return }
  if (!move) {
    const koffi = (await import('koffi')).default, kernel = koffi.load('kernel32.dll')
    move = kernel.func('__stdcall', 'MoveFileExW', 'int', ['str16', 'str16', 'uint'])
    lastError = kernel.func('__stdcall', 'GetLastError', 'uint', [])
  }
  for (let attempt = 0;; attempt++) {
    if (move!(toNamespacedPath(source), toNamespacedPath(target), replace ? 0x9 : 0x8)) return
    const code = lastError!()
    if (![5, 32, 33].includes(code) || attempt >= 8) throw Error(`NOTEBOOK_DURABLE_RENAME_FAILED:${code}`)
    await new Promise(resolve => setTimeout(resolve, Math.min(20 * 2 ** attempt, 200)))
  }
}
/** Publish missing directory entries before a pointer inside them can be acknowledged. */
export async function ensureDurableDirectory(path: string): Promise<void> {
  const absolute = resolve(path)
  const exists = async () => {
    try { if (!(await stat(absolute)).isDirectory()) throw Error('NOTEBOOK_DIRECTORY_REQUIRED'); return true }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error }
  }
  if (await exists()) return
  const parent = dirname(absolute)
  if (parent === absolute) throw Error('NOTEBOOK_VOLUME_UNAVAILABLE')
  await ensureDurableDirectory(parent)
  if (process.platform !== 'win32') {
    try { await mkdir(absolute, { mode: 0o700 }) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || !await exists()) throw error }
    await syncDirectory(parent)
    return
  }
  const staging = await mkdtemp(join(parent, '.notebook-dir-'))
  try { await publishSyncedFile(staging, absolute, false) }
  catch (error) { if (!await exists()) throw error }
  finally {
    // Only remove our empty staging directory, never a recursively discovered path.
    await rmdir(staging).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error })
  }
}
export async function writeFileDurable(path: string, bytes: string, options: { mode?: number } = {}): Promise<void> {
  const temp = path + '.' + randomUUID() + '.tmp'
  try {
    await writeFile(temp, bytes, { flag: 'wx', mode: options.mode ?? 0o600, flush: true })
    await publishSyncedFile(temp, path)
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw error
  }
}
