import { DatabaseSync } from 'node:sqlite'
/** The OS releases this SQLite writer lock even if the host dies or its PID is reused. */
export async function acquireOwner(path: string): Promise<() => Promise<void>> {
  const db = new DatabaseSync(path)
  try {
    db.exec('BEGIN IMMEDIATE')
  } catch (error) {
    db.close()
    if ((error as { errcode?: number }).errcode === 5)
      throw Error('Neural Lab data root already has an active owner')
    throw error
  }
  try {
    db.exec(
      'CREATE TABLE IF NOT EXISTS owner(slot INTEGER PRIMARY KEY CHECK(slot=1),pid INTEGER NOT NULL,token TEXT NOT NULL)',
    )
    // Older versions commit a PID row and release the database lock.
    const prior = db.prepare('SELECT pid FROM owner WHERE slot=1').get()
    if (prior) {
      const pid = Number(prior.pid)
      if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Invalid owner identity')
      try {
        process.kill(pid, 0)
        throw Error('Neural Lab data root already has an active owner')
      } catch (probe) {
        if (!(probe instanceof Error && 'code' in probe && probe.code === 'ESRCH')) throw probe
      }
    }
    db.exec('DELETE FROM owner')
  } catch (error) {
    db.exec('ROLLBACK')
    db.close()
    throw error
  }
  let released = false
  return async () => {
    if (released) return
    released = true
    try {
      db.exec('COMMIT')
    } finally {
      db.close()
    }
  }
}
