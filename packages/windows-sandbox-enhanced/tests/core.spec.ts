import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { localPath, parseAudit, recoveryPlan } from '../src/audit.ts'
import { protectionStatus, type AuditEntry, type AuditReport } from '../src/contracts.ts'
import { Lifetime } from '../src/lifecycle.ts'
import { decodeJournal, withLedger } from '../src/journal.ts'

const descriptor = Buffer.from('test security descriptor'), sha = createHash('sha256').update(descriptor).digest('hex')
function item(p = 'C:\\project'): AuditEntry {
  return { path: p, finalPath: p, identity: '12345678:0000000000000001', descriptor: descriptor.toString('base64'),
    descriptorHash: sha, sddl: 'D:', directory: true, reparsePoint: false, links: 1, integrityRid: null,
    labelInherited: false, labelInheritable: false, daclProtected: false, owner: 'S-1-5-21-1' }
}
function report(): AuditReport {
  return { protocol: 1, root: 'C:\\project', capturedAt: new Date().toISOString(), complete: true, entries: [item()], ancestors: [item('C:\\')], failures: [] }
}
describe('untrusted paths and audit data', () => {
  it.each(['relative', '\\\\server\\share', '\\\\?\\C:\\project', 'C:\\project\\..\\other', 'C:\\project\\f:stream',
    'C:\\project\\NUL', 'C:\\project\\aux.txt', 'C:\\project\\name.', 'C:\\project\\name ', 'C:\\project\0x'])('refuses %j', path => expect(() => localPath(path)).toThrow())
  it('retains drive roots and normalizes separators', () => { expect(localPath('C:\\')).toBe('C:\\'); expect(localPath('C:/project')).toBe('C:\\project') })
  it('validates descriptor hashes', () => { const r = report(); r.entries[0]!.descriptorHash = '0'.repeat(64); expect(() => parseAudit(r, r.root)).toThrow('INVALID_DESCRIPTOR_HASH') })
  it('rejects out-of-root and duplicate observations', () => {
    const r = report(); r.entries.push(item('C:\\project-other'))
    expect(() => parseAudit(r, r.root)).toThrow('INVALID_AUDIT_SCOPE')
    r.entries = [item(), item()]; expect(() => parseAudit(r, r.root)).toThrow('INVALID_AUDIT_SCOPE')
  })
  it('does not promote an incomplete scan to complete', () => {
    const r = report(); r.failures.push({ path: 'C:\\project\\locked', code: 'ACCESS_DENIED' })
    expect(() => parseAudit(r, r.root)).toThrow('INCONSISTENT_AUDIT')
  })
  it('refuses missing and duplicate ancestors in complete reports', () => {
    const r = report(); r.ancestors = []
    expect(() => parseAudit(r, r.root)).toThrow('INCONSISTENT_AUDIT')
    r.ancestors = [item('C:\\'), item('C:\\')]
    expect(() => parseAudit(r, r.root)).toThrow('INVALID_ANCESTOR')
  })
})
describe('conservative recovery planning', () => {
  it('never produces an executable ACL reset', () => {
    const plan = recoveryPlan(report(), report()); expect(plan.executable).toBe(false)
    expect(plan.items[0]!.disposition).toBe('unchanged')
  })
  it.each(['identity', 'owner', 'reparsePoint', 'links'] as const)('blocks changed or ambiguous %s', key => {
    const before = report(), after = report(), e = after.entries[0]!
    if (key === 'identity') e.identity = '12345678:0000000000000002'
    if (key === 'owner') e.owner = 'S-1-5-21-2'
    if (key === 'reparsePoint') { e.reparsePoint = true; after.complete = false }
    if (key === 'links') { e.directory = false; e.links = 2 }
    expect(recoveryPlan(before, after).items[0]!.disposition).toBe('blocked')
  })
  it('blocks missing baseline, incomplete scans and removed objects', () => {
    const before = report(), after = report(); after.entries.push(item('C:\\project\\new'))
    expect(recoveryPlan(before, after).items[1]!.reasons).toContain('NO_BASELINE')
    after.complete = false; expect(recoveryPlan(before, after).items[0]!.reasons).toContain('INCOMPLETE_SCAN')
    after.entries = []; expect(recoveryPlan(before, after).items[0]!.reasons).toContain('OBJECT_MISSING')
  })
  it('does not infer ownership of label changes from an ACL pattern', () => {
    const before = report(), after = report(), e = after.entries[0]!, data = Buffer.from('changed descriptor')
    e.descriptor = data.toString('base64'); e.descriptorHash = createHash('sha256').update(data).digest('hex'); e.integrityRid = 4096
    const change = recoveryPlan(before, after).items[0]!
    expect(change.disposition).toBe('review'); expect(change.reasons).toContain('ORIGIN_UNPROVEN_REQUIRES_REVIEW')
  })
})
describe('lifetime and ledger', () => {
  it('joins cleanup and prevents new work during draining', async () => {
    const life = new Lifetime(); let finish!: () => void
    life.track(() => new Promise<void>(resolve => { finish = resolve }))
    const closed = life.close(); expect(life.close()).toBe(closed)
    expect(() => life.track(async () => {})).toThrow('DRAINING'); expect(life.status.active).toBe(1)
    finish(); await closed; expect(life.status).toEqual({ state: 'closed', active: 0 })
  })
  it('does not claim cleanup after failure', async () => {
    const life = new Lifetime(); life.track(async () => { throw Error('still running') })
    await expect(life.close()).rejects.toThrow('CLEANUP_UNCONFIRMED')
    expect(life.status).toEqual({ state: 'failed', active: 1 })
  })
  it('serializes concurrent records and excludes another ledger owner', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-ledger-test-'))
    try {
      await withLedger(directory, async append => {
        await expect(withLedger(directory, async () => {})).rejects.toThrow('LEDGER_LOCKED')
        await Promise.all([append('PREPARED', { id: 1 }), append('REVIEWED', { id: 1 })])
      })
      const text = await readFile(join(directory, 'events.jsonl'), 'utf8')
      expect(decodeJournal(text).map(e => e.sequence)).toEqual([0, 1])
      expect(() => decodeJournal(text.slice(0, -1))).toThrow('TORN_JOURNAL')
      expect(() => decodeJournal(text.replace('PREPARED', 'EXECUTED'))).toThrow('CORRUPT_JOURNAL')
      await withLedger(directory, append => append('CLOSED', {}))
      expect(decodeJournal(await readFile(join(directory, 'events.jsonl'), 'utf8'))).toHaveLength(3)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('never steals a stale lock based on PID or age', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-ledger-test-'))
    try {
      await writeFile(join(directory, 'owner.lock'), '{"pid":99999999,"createdAt":"2000-01-01"}')
      await expect(withLedger(directory, async () => {})).rejects.toThrow('LEDGER_LOCKED')
      expect(await readFile(join(directory, 'owner.lock'), 'utf8')).toContain('99999999')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('reports all execution paths unqualified', () => {
    const status = protectionStatus(); expect(status.protected).toBe(false)
    expect(status.coverage.every(p => p.status === 'not-qualified')).toBe(true)
  })
})
