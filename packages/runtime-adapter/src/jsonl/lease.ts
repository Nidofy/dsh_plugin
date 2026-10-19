/** Cross-process session ownership. POSIX uses flock on session.lock; Windows
 * holds an exclusive, non-delete-shared handle to that physical file. Aliases
 * and different Windows sessions contend on the same kernel file object.
 * Process exit releases ownership; the empty lock file is intentionally retained.
 * Deleting a live Windows lock file is refused. No time-based lease stealing. */

import { mkdir, open, stat } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import { SessionAlreadyOwnedError } from '@deepseek-ai/dsh-session-persistence'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { acquireLockHandleWin32, releaseLockHandleWin32 } from './win32.ts'

/** Base name of the kernel lock file inside a session's directory. */
export const LEASE_FILENAME = 'session.lock'

/** The held kernel lock: a POSIX descriptor or a Win32 semaphore handle. */
type HeldLock =
  | { readonly kind: 'posix'; readonly handle: FileHandle }
  | { readonly kind: 'win32'; readonly handle: number }

/** Whether a flock failure means another descriptor holds the lock. */
function isLockContention(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code
  // flock(2) reports EAGAIN; some libcs spell it EWOULDBLOCK.
  return code === 'EAGAIN' || code === 'EWOULDBLOCK'
}

/**
 * One held write lock. Constructed only by {@link SessionWriteLease.acquire};
 * `release` closes the descriptor or handle, which is what releases the lock.
 */
export class SessionWriteLease {
  private released = false

  private constructor(private readonly held: HeldLock) {}

  /**
   * Acquire the session directory's kernel write lock.
   * @param dir - the session's artifact directory (created if absent).
   * @param id - the session the lock guards, for error identities.
   * @returns the held lock.
   * @throws {SessionAlreadyOwnedError} while another holder keeps the lock.
   */
  static async acquire(dir: string, id: SessionId): Promise<SessionWriteLease> {
    const path = join(dir, LEASE_FILENAME)
    // Owner-only like materializePosix's directories: the lock may create the
    // session directory first, and both creators must agree on the mode.
    await mkdir(dir, { recursive: true, mode: 0o700 })
    /* v8 ignore start -- native Windows coverage exercises this platform branch; Linux covers the POSIX peer */
    if (process.platform === 'win32') {
      let handle: number
      try {
        handle = await acquireLockHandleWin32(path)
      } catch (error: unknown) {
        // Sharing violation: another handle already holds the write exclusion.
        if ((error as NodeJS.ErrnoException | null)?.code === 'EBUSY') throw new SessionAlreadyOwnedError(id)
        throw error
      }
      return new SessionWriteLease({ kind: 'win32', handle })
    }
    /* v8 ignore stop */
    // Bounded retry: locking an inode a releasing creator just unlinked (or a
    // recreated path) re-opens the fresh file; steady state needs one pass.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const handle = await open(path, 'w')
      try {
        try {
          const { tryLockExclusive } = await import('@deepseek-ai/node-addon-system/flock')
          await tryLockExclusive(handle.fd)
        } catch (error: unknown) {
          if (isLockContention(error)) throw new SessionAlreadyOwnedError(id)
          throw error
        }
        const held = await handle.stat({ bigint: true })
        const current = await stat(path, { bigint: true }).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return undefined
          throw error
        })
        if (current !== undefined && current.ino === held.ino && current.dev === held.dev) {
          return new SessionWriteLease({ kind: 'posix', handle })
        }
      } catch (error: unknown) {
        await handle.close()
        throw error
      }
      // The locked inode is no longer the file at the lock path: start over
      // against whatever now stands there.
      await handle.close()
    }
    throw new SessionAlreadyOwnedError(id)
  }

  /**
   * Release the kernel lock by closing its descriptor or handle. The POSIX
   * lock file is never removed: every acquired lock belongs to a
   * materialized or materializing session, and keeping the file preserves
   * the stable inode later lockers verify against. Idempotent.
   */
  async release(): Promise<void> {
    if (this.released) return
    /* v8 ignore start -- native Windows coverage exercises this platform branch; Linux covers the POSIX peer */
    if (this.held.kind === 'win32') {
      await releaseLockHandleWin32(this.held.handle)
      this.released = true
      return
    }
    /* v8 ignore stop */
    await this.held.handle.close()
    this.released = true
  }
}
