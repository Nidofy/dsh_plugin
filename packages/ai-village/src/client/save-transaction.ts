import type { Saved } from '../host/save-store.ts'
import { HostRequestError } from './json-response.ts'
export interface Authority { profileId: string; epoch: string }
export interface SaveState<W> extends Authority { saved: Saved<W> | null }
export interface SaveAttempt<W> extends Authority { lease: string; expectedRevision: number; operationId: string; world: W }
export type SaveReceipt =
  | { status: 'idle' }
  | { status: 'pending'; operationId: string }
  | { status: 'committed'; operationId: string; profileId: string; epoch: string; revision: number }
  | { status: 'unknown'; operationId: string; reason: 'ACK_LOST' | 'STATE_UNAVAILABLE' | 'HOST_CHANGED' | 'STATE_MISMATCH' }
  | { status: 'rejected'; operationId: string; reason: string }
export interface SaveTransport<W> {
  write(attempt: SaveAttempt<W>): Promise<unknown>
  read(): Promise<SaveState<W>>
}
/** One immutable candidate. Never retries a write after losing its acknowledgement. */
export class SaveTransaction<W> {
  receipt: SaveReceipt = { status: 'idle' }
  pending: SaveAttempt<W> | null = null
  private confirmed: { saved: Saved<W>; profileId: string } | null = null
  private executing = false
  constructor(private readonly validate: (value: unknown) => W) {}
  private matches(saved: Saved<W> | null, pending: SaveAttempt<W>): boolean {
    if (!saved || saved.operationId !== pending.operationId || saved.revision !== pending.expectedRevision + 1) return false
    try { return JSON.stringify(this.validate(saved.world)) === JSON.stringify(pending.world) } catch { return false }
  }
  private unknown(reason: Extract<SaveReceipt, { status: 'unknown' }>['reason']): SaveReceipt {
    return this.receipt = { status: 'unknown', operationId: this.pending!.operationId, reason }
  }
  confirms(state: SaveState<W>): boolean {
    const known = this.confirmed
    if (!known || state.profileId !== known.profileId || !state.saved || state.saved.operationId !== known.saved.operationId || state.saved.revision !== known.saved.revision) return false
    try { return JSON.stringify(this.validate(state.saved.world)) === JSON.stringify(known.saved.world) } catch { return false }
  }
  /** A fresh owner may supply its newly acquired identity; a late old-epoch response may not. */
  reconcile(state: SaveState<W>, authority?: Authority, fenced = false): SaveReceipt {
    const pending = this.pending
    if (!pending) return this.receipt
    const expected = authority ?? pending
    if (state?.profileId !== pending.profileId || expected.profileId !== pending.profileId || state.epoch !== expected.epoch) return this.unknown('HOST_CHANGED')
    if (this.matches(state.saved, pending)) {
      this.confirmed = { saved: { revision: state.saved!.revision, operationId: pending.operationId, world: structuredClone(pending.world) }, profileId: pending.profileId }
      this.pending = null
      return this.receipt = { status: 'committed', operationId: pending.operationId, profileId: state.profileId, epoch: state.epoch, revision: state.saved!.revision }
    }
    if (fenced && (state.saved?.revision ?? 0) === pending.expectedRevision) {
      this.pending = null
      return this.receipt = { status: 'rejected', operationId: pending.operationId, reason: 'SAVE_NOT_COMMITTED' }
    }
    return this.unknown('STATE_MISMATCH')
  }
  async submit(attempt: SaveAttempt<W>, transport: SaveTransport<W>): Promise<SaveReceipt> {
    if (this.executing || this.pending) throw Error('SAVE_UNRESOLVED')
    const world = this.validate(attempt.world)
    this.pending = structuredClone({ ...attempt, world })
    this.receipt = { status: 'pending', operationId: attempt.operationId }; this.executing = true
    let failure: unknown
    try {
      try {
        const ack = await transport.write(structuredClone(this.pending)) as Saved<W> & Authority
        if (ack?.profileId === attempt.profileId && ack.epoch === attempt.epoch && this.matches(ack, this.pending)) {
          this.confirmed = { saved: { revision: ack.revision, operationId: attempt.operationId, world: structuredClone(this.pending.world) }, profileId: attempt.profileId }
          this.pending = null
          return this.receipt = { status: 'committed', operationId: attempt.operationId, profileId: ack.profileId, epoch: ack.epoch, revision: ack.revision }
        }
        failure = Error('INVALID_SAVE_ACK')
      } catch (error) { failure = error }
      let observed: SaveState<W>
      try { observed = await transport.read() }
      catch {
        // Explicit pre-publication rejections are definitive; all other failures stay uncertain.
        if (failure instanceof HostRequestError && ['REVISION_CONFLICT', 'INVALID_SAVE_REQUEST', 'INVALID_WORLD', 'INVALID_CONTENT_WORLD', 'SAVE_TOO_LARGE'].includes(failure.message)) {
          this.pending = null
          return this.receipt = { status: 'rejected', operationId: attempt.operationId, reason: failure.message }
        }
        return this.unknown('STATE_UNAVAILABLE')
      }
      const receipt = this.reconcile(observed)
      if (receipt.status === 'committed') return receipt
      if (failure instanceof HostRequestError && observed.profileId === attempt.profileId && observed.epoch === attempt.epoch
        && ['OWNER_LOST', 'REVISION_CONFLICT', 'INVALID_SAVE_REQUEST', 'INVALID_WORLD', 'INVALID_CONTENT_WORLD', 'SAVE_TOO_LARGE'].includes(failure.message)) {
        this.pending = null
        return this.receipt = { status: 'rejected', operationId: attempt.operationId, reason: failure.message }
      }
      return receipt
    } finally { this.executing = false }
  }
  /** Used only after an explicit successful recovery replaced the authority. */
  reset(): void { if (this.executing) throw Error('SAVE_IN_PROGRESS'); this.pending = null; this.confirmed = null; this.receipt = { status: 'idle' } }
}
