import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { win32 } from 'node:path'
import { SafetyError, type AuditEntry, type AuditReport, type RecoveryPlan } from './contracts.ts'

export function localPath(input: unknown): string {
  if (typeof input !== 'string' || !/^[a-z]:[\\/]/i.test(input) || input.slice(2).includes(':') ||
      /[\x00-\x1f*?<>|]/.test(input) || input.split(/[\\/]/).slice(1).some(p =>
        p === '..' || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))
    throw new SafetyError('LOCAL_ABSOLUTE_PATH_REQUIRED')
  return win32.normalize(input).replace(/\\$/, input.length === 3 ? '\\' : '')
}
function entry(value: unknown): AuditEntry {
  if (value === null || typeof value !== 'object') throw new SafetyError('INVALID_AUDIT')
  const e = value as AuditEntry
  for (const key of ['path', 'finalPath', 'identity', 'descriptor', 'descriptorHash', 'sddl', 'owner'] as const)
    if (typeof e[key] !== 'string') throw new SafetyError('INVALID_AUDIT')
  localPath(e.path); localPath(e.finalPath)
  if (localPath(e.path).toLowerCase() !== localPath(e.finalPath).toLowerCase() ||
      !/^[a-f0-9]{8}:[a-f0-9]{16}$/i.test(e.identity) || !/^[a-f0-9]{64}$/.test(e.descriptorHash) ||
      e.descriptor.length > 131072 || !/^[A-Za-z0-9+/]+={0,2}$/.test(e.descriptor)) throw new SafetyError('INVALID_AUDIT')
  const bytes = Buffer.from(e.descriptor, 'base64')
  if (bytes.toString('base64') !== e.descriptor || createHash('sha256').update(bytes).digest('hex') !== e.descriptorHash)
    throw new SafetyError('INVALID_DESCRIPTOR_HASH')
  for (const key of ['directory', 'reparsePoint', 'labelInherited', 'labelInheritable', 'daclProtected'] as const)
    if (typeof e[key] !== 'boolean') throw new SafetyError('INVALID_AUDIT')
  if (!Number.isSafeInteger(e.links) || e.links < 1 ||
      (e.integrityRid !== null && (!Number.isSafeInteger(e.integrityRid) || e.integrityRid < 0))) throw new SafetyError('INVALID_AUDIT')
  return e
}
export function parseAudit(value: unknown, expectedRoot: string): AuditReport {
  const r = value as AuditReport
  if (!r || r.protocol !== 1 || typeof r.root !== 'string' || typeof r.complete !== 'boolean' ||
      typeof r.capturedAt !== 'string' || !Number.isFinite(Date.parse(r.capturedAt)) ||
      !Array.isArray(r.entries) || !Array.isArray(r.ancestors) || !Array.isArray(r.failures) ||
      r.entries.length + r.failures.length > 10000 || r.ancestors.length > 1000 ||
      localPath(r.root).toLowerCase() !== localPath(expectedRoot).toLowerCase()) throw new SafetyError('INVALID_AUDIT')
  const root = localPath(expectedRoot).toLowerCase(), prefix = root.replace(/\\$/, '') + '\\'
  const seen = new Set<string>()
  for (const candidate of r.entries) {
    const e = entry(candidate), p = localPath(e.path).toLowerCase()
    if ((p !== root && !p.startsWith(prefix)) || seen.has(p)) throw new SafetyError('INVALID_AUDIT_SCOPE')
    seen.add(p)
  }
  const expectedAncestors = new Set<string>()
  for (let path = root; win32.dirname(path) !== path;) { path = win32.dirname(path); expectedAncestors.add(path) }
  const ancestors = new Set<string>()
  for (const candidate of r.ancestors) {
    const e = entry(candidate), p = localPath(e.path).toLowerCase()
    if (!expectedAncestors.has(p) || ancestors.has(p) || !e.directory || e.reparsePoint) throw new SafetyError('INVALID_ANCESTOR')
    ancestors.add(p)
  }
  for (const failure of r.failures)
    if (!failure || typeof failure.path !== 'string' || typeof failure.code !== 'string') throw new SafetyError('INVALID_AUDIT')
  if (r.complete && (r.failures.length || !seen.has(root))) throw new SafetyError('INCONSISTENT_AUDIT')
  if (r.complete && (ancestors.size !== expectedAncestors.size || r.entries.some(e => e.reparsePoint))) throw new SafetyError('INCONSISTENT_AUDIT')
  return r
}

/** Preview only. Historical labels are not proof of ownership; no reset is emitted. */
export function recoveryPlan(before: AuditReport, after: AuditReport): RecoveryPlan {
  parseAudit(before, before.root); parseAudit(after, before.root)
  const original = new Map(before.entries.map(e => [e.path.toLowerCase(), e]))
  const ancestorChanged = JSON.stringify(before.ancestors.map(e => [e.identity, e.descriptorHash])) !==
    JSON.stringify(after.ancestors.map(e => [e.identity, e.descriptorHash]))
  const items = after.entries.map(e => {
    const prior = original.get(e.path.toLowerCase()), reasons: string[] = []
    if (!before.complete || !after.complete) reasons.push('INCOMPLETE_SCAN')
    if (!prior) reasons.push('NO_BASELINE')
    if (prior && prior.identity !== e.identity) reasons.push('OBJECT_REPLACED')
    if (e.reparsePoint || prior?.reparsePoint) reasons.push('REPARSE_POINT')
    if ((!e.directory && e.links > 1) || (prior && !prior.directory && prior.links > 1)) reasons.push('HARDLINK_ALIASES')
    if (ancestorChanged) reasons.push('ANCESTOR_CHANGED')
    if (prior && prior.owner !== e.owner) reasons.push('OWNER_CHANGED')
    const same = prior?.descriptorHash === e.descriptorHash
    return { path: e.path, identity: e.identity, expectedHash: e.descriptorHash,
      originalHash: prior?.descriptorHash ?? '', disposition: reasons.length ? 'blocked' as const : same ? 'unchanged' as const : 'review' as const,
      reasons: reasons.length ? reasons : same ? [] : ['ORIGIN_UNPROVEN_REQUIRES_REVIEW'] }
  })
  for (const prior of before.entries) if (!after.entries.some(e => e.path.toLowerCase() === prior.path.toLowerCase()))
    items.push({ path: prior.path, identity: prior.identity, expectedHash: '', originalHash: prior.descriptorHash,
      disposition: 'blocked', reasons: ['OBJECT_MISSING'] })
  return { executable: false, reason: 'REVIEW_ONLY_NO_MUTATION_BACKEND', items }
}

export interface NativeAuditOptions { executable: string; sha256: string; maxEntries?: number }
export async function scanNative(options: NativeAuditOptions, root: string, signal?: AbortSignal): Promise<AuditReport> {
  if (process.platform !== 'win32') throw new SafetyError('WINDOWS_REQUIRED')
  const path = localPath(root), max = options.maxEntries ?? 2000
  if (!Number.isInteger(max) || max < 1 || max > 10000 || !/^[a-f0-9]{64}$/.test(options.sha256)) throw new SafetyError('INVALID_CONFIG')
  // Helper location must be deployment-owned. A digest is integrity checking, not a signature or protection from a local same-user attacker.
  const digest = createHash('sha256').update(await readFile(options.executable)).digest('hex')
  if (digest !== options.sha256) throw new SafetyError('HELPER_HASH_MISMATCH')
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const child = spawn(options.executable, ['scan', path, String(max)], { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []; let bytes = 0, failure: Error | undefined
    const stop = (error: Error) => { failure ??= error; child.kill() }
    const abort = () => stop(new SafetyError('CANCELLED'))
    const timer = setTimeout(() => stop(new SafetyError('AUDIT_TIMEOUT')), 60000)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) stop(new SafetyError('OUTPUT_LIMIT')); else chunks.push(chunk) })
    child.stderr.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) stop(new SafetyError('OUTPUT_LIMIT')) })
    child.on('error', error => { failure ??= error })
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
      if (failure) return reject(failure)
      if (code !== 0) return reject(new SafetyError('NATIVE_AUDIT_FAILED'))
      try { resolve(parseAudit(JSON.parse(Buffer.concat(chunks).toString('utf8')), path)) } catch (error) { reject(error) }
    })
  })
}
