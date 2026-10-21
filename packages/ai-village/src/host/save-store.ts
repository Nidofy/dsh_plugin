import { lstat, readFile, realpath, copyFile, constants, readdir, unlink } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { ensureDurableDirectory, writeFileDurable } from '@nidofy/dsh-plugin-shared/durable-file'
import { validateWorld } from '../core/world.ts'
import type { Scene, World } from '../core/world.ts'
export interface Saved { revision: number; operationId: string; world: World }
interface Pointer { schemaVersion: 1; revision: number; snapshot: string; operationId: string; hash: string }
const limit = 64 * 1024
export const retainedSnapshots = 32
const managedName = /^managed-v1-[a-f0-9-]{36}\.json$/
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex')
async function readSafe(path: string): Promise<string | null> {
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > limit) throw Error('SAVE_FILE_REFUSED')
    const bytes = await readFile(path)
    if (bytes.length > limit) throw Error('SAVE_FILE_REFUSED')
    return bytes.toString('utf8')
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
function pointer(bytes: string): Pointer {
  const p = JSON.parse(bytes) as Pointer
  if (p.schemaVersion !== 1 || !Number.isSafeInteger(p.revision) || p.revision < 1
    || !/^(?:managed-v1-)?[a-f0-9-]{36}\.json$/.test(p.snapshot) || !/^[a-f0-9-]{36}$/.test(p.operationId) || !/^[a-f0-9]{64}$/.test(p.hash)) throw Error('INVALID_SAVE_POINTER')
  return p
}
/** Immutable snapshots with a synced current pointer. Profile root is supplied by the trusted adapter. */
export class SaveStore {
  retention: { limit: number; removed: number; diagnostic?: string } = { limit: retainedSnapshots, removed: 0 }
  private constructor(readonly directory: string, readonly scene: Scene) {}
  static async open(profileDirectory: string, scene: Scene): Promise<SaveStore> {
    if (!isAbsolute(profileDirectory)) throw Error('PROFILE_DIRECTORY_REQUIRED')
    const profile = await realpath(profileDirectory)
    const directory = join(profile, 'nidofy-ai-village')
    await ensureDurableDirectory(directory)
    const info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('PROFILE_DIRECTORY_REFUSED')
    await ensureDurableDirectory(join(directory, 'snapshots'))
    const snapshots = await lstat(join(directory, 'snapshots'))
    if (!snapshots.isDirectory() || snapshots.isSymbolicLink()) throw Error('PROFILE_DIRECTORY_REFUSED')
    return new SaveStore(directory, scene)
  }
  async read(name = 'current.json'): Promise<Saved | null> {
    if (!['current.json', 'previous.json'].includes(name)) throw Error('SAVE_PATH_REFUSED')
    const bytes = await readSafe(join(this.directory, name))
    if (bytes === null) return null
    const p = pointer(bytes)
    const snapshot = await readSafe(join(this.directory, 'snapshots', p.snapshot))
    if (!snapshot || digest(snapshot) !== p.hash) throw Error('SAVE_HASH_MISMATCH')
    const saved = JSON.parse(snapshot) as Saved
    if (saved.revision !== p.revision || saved.operationId !== p.operationId) throw Error('SAVE_REVISION_MISMATCH')
    return { revision: saved.revision, operationId: saved.operationId, world: validateWorld(saved.world, this.scene) }
  }
  async save(expectedRevision: number, world: unknown, operationId: string, ownerValid: () => boolean = () => true): Promise<Saved> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !/^[a-f0-9-]{36}$/.test(operationId)) throw Error('INVALID_SAVE_REQUEST')
    const canonical = validateWorld(world, this.scene)
    return withFileLock(join(this.directory, 'transaction'), async () => {
      if (!ownerValid()) throw Error('OWNER_LOST')
      const current = await this.read()
      if (current?.operationId === operationId) {
        if (JSON.stringify(current.world) !== JSON.stringify(canonical)) throw Error('OPERATION_MISMATCH')
        return current
      }
      if ((current?.revision ?? 0) !== expectedRevision) throw Error('REVISION_CONFLICT')
      await this.read('previous.json') // Refuse to overwrite an invalid recovery pointer.
      const previous = await readSafe(join(this.directory, 'current.json'))
      return this.publish(expectedRevision + 1, canonical, operationId, previous, ownerValid)
    })
  }
  private async publish(revision: number, world: World, operationId: string, previous: string | null, ownerValid: () => boolean): Promise<Saved> {
    const saved: Saved = { revision, world, operationId }, snapshot = JSON.stringify(saved)
    if (Buffer.byteLength(snapshot) > limit) throw Error('SAVE_TOO_LARGE')
    const name = 'managed-v1-' + randomUUID() + '.json'
    await writeFileDurable(join(this.directory, 'snapshots', name), snapshot)
    if (!ownerValid()) throw Error('OWNER_LOST')
    if (previous !== null) await writeFileDurable(join(this.directory, 'previous.json'), previous)
    if (!ownerValid()) throw Error('OWNER_LOST')
    const next: Pointer = { schemaVersion: 1, revision, snapshot: name, operationId, hash: digest(snapshot) }
    await writeFileDurable(join(this.directory, 'current.json'), JSON.stringify(next))
    // Publication is already durable. Cleanup failure never makes callers replay this save.
    try { await this.prune(ownerValid) }
    catch (error) { this.retention = { limit: retainedSnapshots, removed: 0, diagnostic: error instanceof Error
      && /^[A-Z_]+$/.test(error.message) ? error.message : 'SAVE_RETENTION_FAILED' } }
    return saved
  }
  private async prune(ownerValid: () => boolean): Promise<void> {
    const directory = join(this.directory, 'snapshots'), info = await lstat(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('PROFILE_DIRECTORY_REFUSED')
    const protectedNames = new Set<string>()
    for (const name of ['current.json', 'previous.json']) {
      await this.read(name) // Refuse cleanup when either recovery chain is damaged.
      const bytes = await readSafe(join(this.directory, name))
      if (bytes) protectedNames.add(pointer(bytes).snapshot)
    }
    const rootFiles = await readdir(this.directory)
    if (rootFiles.length > 10000) throw Error('SAVE_RETENTION_SCAN_LIMIT')
    for (const name of rootFiles.filter(name => /^recovery-[a-f0-9-]{36}\.json$/.test(name))) {
      const bytes = await readSafe(join(this.directory, name))
      if (!bytes) continue
      let recovered: unknown
      try { recovered = JSON.parse(bytes) } catch { continue /* Exact malformed evidence is kept at the root. */ }
      if (recovered && typeof recovered === 'object' && 'snapshot' in recovered
        && typeof recovered.snapshot === 'string' && managedName.test(recovered.snapshot)) protectedNames.add(recovered.snapshot)
    }
    const files = await readdir(directory)
    if (files.length > 10000) throw Error('SAVE_RETENTION_SCAN_LIMIT')
    const candidates: { name: string; revision: number }[] = []
    for (const name of files) {
      if (!managedName.test(name)) continue // Old saves and unknown files are never garbage.
      if (!ownerValid()) throw Error('OWNER_LOST')
      const bytes = await readSafe(join(directory, name))
      if (!bytes) continue
      const value = JSON.parse(bytes) as Saved
      if (!Number.isSafeInteger(value.revision) || value.revision < 1 || !/^[a-f0-9-]{36}$/.test(value.operationId)) throw Error('INVALID_SAVE_POINTER')
      validateWorld(value.world, this.scene)
      candidates.push({ name, revision: value.revision })
    }
    candidates.sort((a, b) => b.revision - a.revision || a.name.localeCompare(b.name))
    const keep = new Set([...protectedNames, ...candidates.slice(0, retainedSnapshots).map(row => row.name)])
    let removed = 0
    for (const row of candidates) if (!keep.has(row.name)) {
      if (!ownerValid()) throw Error('OWNER_LOST')
      await readSafe(join(directory, row.name))
      await unlink(join(directory, row.name)); removed++
    }
    this.retention = { limit: retainedSnapshots, removed }
  }
  /** Explicit recovery only; preserve the exact damaged pointer before publishing a recovered revision. */
  async recover(ownerValid: () => boolean): Promise<Saved> {
    return withFileLock(join(this.directory, 'transaction'), async () => {
      if (!ownerValid()) throw Error('OWNER_LOST')
      const old = await this.read('previous.json')
      if (!old) throw Error('NO_PREVIOUS_SAVE')
      const original = join(this.directory, 'current.json')
      const info = await lstat(original)
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw Error('SAVE_FILE_REFUSED')
      await copyFile(original, join(this.directory, 'recovery-' + randomUUID() + '.json'), constants.COPYFILE_EXCL)
      // The damaged current normally follows previous by one. Do not reuse that revision.
      const current = await this.read().catch(() => null)
      const revision = Math.max(old.revision + 2, (current?.revision ?? 0) + 1)
      return this.publish(revision, old.world, randomUUID(), await readSafe(join(this.directory, 'previous.json')), ownerValid)
    })
  }
}
