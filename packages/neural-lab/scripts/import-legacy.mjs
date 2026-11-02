/** Offline, explicit import of one legacy learning root into one stopped profile. */
import { DatabaseSync, backup } from 'node:sqlite'
import { cp, lstat, mkdtemp, realpath, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function importLegacy(source, profile) {
  const root = await realpath(source)
  const parent = await realpath(profile)
  const target = join(parent, 'neural-lab')
  if (target === root || target.startsWith(root + sep) || root.startsWith(target + sep))
    throw Error('Source and destination overlap')
  if (
    await lstat(target).catch((e) => {
      if (e.code !== 'ENOENT') throw e
    })
  )
    throw Error('Destination exists. Preserve it and choose an empty profile.')
  for (const file of ['owner.sqlite', 'neural-lab.sqlite'])
    if (!(await lstat(join(root, file))).isFile()) throw Error('Expected regular file: ' + file)
  const owner = new DatabaseSync(join(root, 'owner.sqlite'))
  let stage
  try {
    owner.exec('BEGIN IMMEDIATE')
    if (owner.prepare('SELECT pid FROM owner WHERE slot=1').get())
      throw Error('Finish clean shutdown of the legacy owner before import')
    const db = new DatabaseSync(join(root, 'neural-lab.sqlite'), { readOnly: true })
    try {
      if (db.prepare('PRAGMA application_id').get().application_id !== 1313620290)
        throw Error('Unrecognized learning database')
      for (const { body } of db.prepare('SELECT body FROM runs').iterate()) {
        const r = JSON.parse(body)
        if (r.cleanupPending || ['queued', 'running'].includes(r.run_status))
          throw Error('Finish recovery in the original root before importing')
      }
      stage = await mkdtemp(join(parent, '.neural-import-'))
      await backup(db, join(stage, 'neural-lab.sqlite'))
    } finally {
      db.close()
    }
    const runs = join(root, 'runs')
    const found = await lstat(runs).catch((e) => {
      if (e.code !== 'ENOENT') throw e
    })
    if (found) {
      if (!found.isDirectory()) throw Error('Expected regular runs directory')
      await cp(runs, join(stage, 'runs'), {
        recursive: true,
        errorOnExist: true,
        force: false,
        filter: async (file) => {
          const stat = await lstat(file)
          if (!stat.isDirectory() && !stat.isFile())
            throw Error('Unexpected link or special file: ' + basename(file))
          return true
        },
      })
    }
    // Browser recovery buffers must be scoped to the new profile after a copy.
    const copy = new DatabaseSync(join(stage, 'neural-lab.sqlite'))
    try {
      copy.prepare("DELETE FROM kv WHERE key='bufferScope'").run()
    } finally {
      copy.close()
    }
    await rename(stage, target)
    stage = undefined
    return target
  } finally {
    owner.close()
    if (stage && dirname(stage) === parent && basename(stage).startsWith('.neural-import-'))
      await rm(stage, { recursive: true, force: true })
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4)
    throw Error('Usage: node import-legacy.mjs OLD_ROOT TARGET_PROFILE_DIR')
  console.log(await importLegacy(process.argv[2], process.argv[3]))
}
