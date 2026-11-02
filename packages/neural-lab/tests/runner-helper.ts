import { mkdtemp, realpath, rm, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { Runner } from '../src/runner.ts'
export async function temporaryRunner() {
  const base = await realpath(tmpdir())
  const root = await mkdtemp(join(base, 'neural-lab-runner-'))
  return {
    runner: new Runner(root),
    root,
    cleanup: async () => {
      const actual = await realpath(root)
      if (
        (await lstat(root)).isSymbolicLink() ||
        dirname(actual) !== base ||
        !basename(actual).startsWith('neural-lab-runner-')
      )
        throw new Error('Refusing to clean unexpected runner directory')
      await rm(actual, { recursive: true, force: true })
    },
  }
}
