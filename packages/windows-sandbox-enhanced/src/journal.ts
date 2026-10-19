import { open, readFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { SafetyError } from './contracts.ts'

export interface JournalRecord { sequence: number; previous: string; event: string; payload: unknown; hash: string }
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
/** Integrity chain detects torn/corrupt records, NOT malicious alteration by the same user. */
export function decodeJournal(text: string): JournalRecord[] {
  if (text && !text.endsWith('\n')) throw new SafetyError('TORN_JOURNAL')
  let previous = ''; const records: JournalRecord[] = []
  for (const line of text.split('\n').filter(Boolean)) {
    let r: JournalRecord
    try { r = JSON.parse(line) as JournalRecord } catch { throw new SafetyError('CORRUPT_JOURNAL') }
    if (r.sequence !== records.length || r.previous !== previous || typeof r.event !== 'string' ||
        r.hash !== hash(JSON.stringify({ sequence: r.sequence, previous: r.previous, event: r.event, payload: r.payload }))) throw new SafetyError('CORRUPT_JOURNAL')
    previous = r.hash; records.push(r)
  }
  return records
}

/** Cooperative cross-process lock. Crashed locks are never stolen by age or PID reuse. */
export async function withLedger<T>(directory: string, operation: (append: (event: string, payload: unknown) => Promise<void>) => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true })
  const lockPath = join(directory, 'owner.lock'), journalPath = join(directory, 'events.jsonl')
  let lock
  try { lock = await open(lockPath, 'wx') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new SafetyError('LEDGER_LOCKED_REVIEW_REQUIRED')
    throw error
  }
  const nonce = randomUUID()
  try {
    await lock.writeFile(JSON.stringify({ nonce, pid: process.pid, createdAt: new Date().toISOString() })); await lock.sync()
    const text = await readFile(journalPath, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error })
    const records = decodeJournal(text)
    let queue = Promise.resolve(), poisoned = false
    const append = (event: string, payload: unknown): Promise<void> => {
      const work = queue.then(async () => {
        if (poisoned) throw new SafetyError('JOURNAL_UNCERTAIN')
        if (!/^[A-Z_]{1,64}$/.test(event)) throw new SafetyError('INVALID_EVENT')
        const body = { sequence: records.length, previous: records.at(-1)?.hash ?? '', event, payload }
        const encoded = JSON.stringify(body)
        if (Buffer.byteLength(encoded) > 1024 * 1024) throw new SafetyError('RECORD_LIMIT')
        const record = { ...body, hash: hash(encoded) }, file = await open(journalPath, 'a')
        try { await file.writeFile(JSON.stringify(record) + '\n'); await file.sync(); records.push(record) }
        catch (error) { poisoned = true; throw error } finally { await file.close() }
      })
      queue = work
      return work
    }
    try { return await operation(append) } finally { await queue }
  } finally {
    await lock.close()
    // Do not unlink an externally replaced lock or blindly clean an uncertain state.
    const current = JSON.parse(await readFile(lockPath, 'utf8')) as { nonce?: string }
    if (current.nonce !== nonce) throw new SafetyError('LOCK_CHANGED')
    await unlink(lockPath)
  }
}
