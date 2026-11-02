import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

/** Own exactly one newly-created temporary directory, never a wildcard or shared parent. */
export async function temporaryDirectory(prefix, base = tmpdir()) {
  const parent = await realpath(base)
  const directory = await mkdtemp(join(parent, prefix))
  const expected = await realpath(directory)
  const same = (left, right) =>
    process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right

  return {
    directory,
    async cleanup() {
      const current = await realpath(directory).catch((error) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
      if (current === null) return
      if (
        !same(current, expected) ||
        !same(dirname(current), parent) ||
        !same(resolve(directory), expected) ||
        !basename(current).startsWith(prefix)
      ) {
        throw new Error('Refusing cleanup outside the temporary directory owned by this test')
      }
      await rm(current, { recursive: true, force: true })
    },
  }
}
