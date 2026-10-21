/** Phase 1 experiment only. No Host routes, user profile access or automatic migration. */
import type { ProfileContext } from '@deepseek-ai/dsh-app-boot'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { writeFileDurable, ensureDurableDirectory } from '@nidofy/dsh-plugin-shared/durable-file'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'

export interface ProbeWorld { schemaVersion: 1; revision: number; x: number; y: number }
const limit = 16 * 1024

/** Use the actual profile directory, not profile name, cwd, session ID or shared home. */
export async function worldPath(profile: Pick<ProfileContext, 'dir'>): Promise<string> {
  if (!isAbsolute(profile.dir)) throw Error('PROFILE_DIRECTORY_REQUIRED')
  const root = await realpath(profile.dir)
  if (!(await lstat(root)).isDirectory()) throw Error('PROFILE_DIRECTORY_REQUIRED')
  return join(root, 'nidofy-ai-village', 'world.json')
}

function validate(value: unknown): ProbeWorld {
  if (!value || typeof value !== 'object') throw Error('INVALID_SAVE')
  const v = value as ProbeWorld
  if (v.schemaVersion !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0
    || !Number.isFinite(v.x) || v.x < 0 || v.x > 360
    || !Number.isFinite(v.y) || v.y < 0 || v.y > 480) throw Error('INVALID_SAVE')
  return { schemaVersion: 1, revision: v.revision, x: v.x, y: v.y }
}

export async function readWorld(path: string): Promise<ProbeWorld | null> {
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > limit) throw Error('SAVE_REFUSED')
    const bytes = await readFile(path)
    if (bytes.byteLength > limit) throw Error('SAVE_REFUSED')
    return validate(JSON.parse(bytes.toString('utf8')))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** A lifetime lock demonstrates a single simulator across local Host processes.
 * The operation must await all work before returning. Client ownership/epoch is P3/P4 work.
 */
export async function withWorldOwner<T>(path: string, operation: () => Promise<T>, waitMs = 100): Promise<T> {
  await ensureDurableDirectory(dirname(path))
  return withFileLock(path + '.owner', operation, { waitMs })
}

/** Caller holds the lifetime owner lock. Separate transaction lock also protects CAS.
 * Previous complete snapshot remains available if publication fails.
 */
export async function saveWorld(path: string, expectedRevision: number, position: { x: number; y: number }): Promise<ProbeWorld> {
  return withFileLock(path, async () => {
    const previous = await readWorld(path)
    if ((previous?.revision ?? 0) !== expectedRevision) throw Error('REVISION_CONFLICT')
    const next = validate({ schemaVersion: 1, revision: expectedRevision + 1, ...position })
    if (previous) await writeFileDurable(path + '.previous', JSON.stringify(previous))
    await writeFileDurable(path, JSON.stringify(next))
    return next
  })
}
