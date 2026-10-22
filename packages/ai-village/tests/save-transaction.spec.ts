import { describe, expect, it } from 'vitest'
import { SaveTransaction, type SaveAttempt } from '../src/client/save-transaction.ts'
import { HostRequestError, readJsonResponse } from '../src/client/json-response.ts'
import { validateContentWorld } from '../src/core/content-state.ts'
import { candidateScene } from '../experiments/content-ui/scene.ts'
import { completedContent } from './helpers/content.ts'
const transaction = () => new SaveTransaction(v => validateContentWorld(v, candidateScene))
const attempt = (): SaveAttempt<ReturnType<typeof completedContent>> => ({ profileId: 'profile', epoch: 'epoch-1', lease: 'lease', expectedRevision: 9,
  operationId: '10000000-0000-0000-0000-000000000001', world: completedContent() })
const state = (a = attempt()) => ({ profileId: a.profileId, epoch: a.epoch, saved: { revision: a.expectedRevision + 1, operationId: a.operationId, world: a.world } })
describe('save receipt reconciliation', () => {
  it('confirms a lost ACK by reading exactly once, with no second write', async () => {
    const tx = transaction(), a = attempt(); let writes = 0, reads = 0
    const result = await tx.submit(a, { write: async () => { writes++; throw Error('ACK_LOST') }, read: async () => { reads++; return state(a) } })
    expect(result.status).toBe('committed'); expect(writes).toBe(1); expect(reads).toBe(1); expect(tx.pending).toBeNull()
  })
  it('keeps an immutable unknown candidate and refuses all further writes until reconciled', async () => {
    const tx = transaction(), a = attempt(); let writes = 0
    const transport = { write: async () => { writes++; throw Error('NETWORK') }, read: async () => { throw Error('OFFLINE') } }
    const result = await tx.submit(a, transport)
    expect(result.status).toBe('unknown'); a.world.journal = []
    expect(tx.pending!.world.journal).toHaveLength(1)
    await expect(tx.submit(attempt(), transport)).rejects.toThrow('SAVE_UNRESOLVED'); expect(writes).toBe(1)
    expect(tx.reconcile(state()).status).toBe('committed')
  })
  it('does not accept mismatched profile, epoch, operation, revision or candidate contents', async () => {
    for (const field of ['profileId', 'epoch', 'operationId', 'revision', 'world']) {
      const tx = transaction(), a = attempt(), bad = state(a)
      if (field === 'profileId' || field === 'epoch') bad[field] = 'another'
      if (field === 'operationId') bad.saved.operationId = 'another'
      if (field === 'revision') bad.saved.revision++
      if (field === 'world') bad.saved.world = { ...bad.saved.world, ticks: bad.saved.world.ticks + 1 }
      const receipt = await tx.submit(a, { write: async () => ({ ...bad.saved, profileId: bad.profileId, epoch: bad.epoch }), read: async () => bad })
      expect(receipt.status).toBe('unknown')
    }
  })
  it('only accepts a new epoch after acquiring that new authority and rereading state', async () => {
    const tx = transaction(), a = attempt(), observed = { ...state(a), epoch: 'epoch-2' }
    expect((await tx.submit(a, { write: async () => { throw Error('OFFLINE') }, read: async () => observed })).status).toBe('unknown')
    expect(tx.reconcile(observed).status).toBe('unknown')
    expect(tx.reconcile(observed, { profileId: a.profileId, epoch: 'epoch-2' }, true).status).toBe('committed')
  })
  it('rejects a definite CAS failure and a fenced unchanged revision without replay', async () => {
    const tx = transaction(), a = attempt()
    const receipt = await tx.submit(a, { write: async () => { throw new HostRequestError('REVISION_CONFLICT') }, read: async () => { throw Error('OFFLINE') } })
    expect(receipt).toMatchObject({ status: 'rejected', reason: 'REVISION_CONFLICT' })
    const tx2 = transaction()
    await tx2.submit(a, { write: async () => { throw Error('OFFLINE') }, read: async () => { throw Error('OFFLINE') } })
    const unchanged = state(a); unchanged.saved.revision = a.expectedRevision; unchanged.saved.operationId = 'older'
    expect(tx2.reconcile(unchanged, a, true)).toMatchObject({ status: 'rejected', reason: 'SAVE_NOT_COMMITTED' })
  })
  it('uses bounded UTF-8 reads, cancels oversized streams and rejects invalid UTF-8', async () => {
    await expect(readJsonResponse(new Response(JSON.stringify({ text: '院'.repeat(23000) })))).rejects.toThrow('RESPONSE_TOO_LARGE')
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(33000)) }, cancel() { cancelled = true } })
    await expect(readJsonResponse(new Response(stream))).rejects.toThrow('RESPONSE_TOO_LARGE'); expect(cancelled).toBe(true)
    await expect(readJsonResponse(new Response(new Uint8Array([0xff])))).rejects.toThrow()
    await expect(readJsonResponse(new Response('{"error":"REVISION_CONFLICT"}', { status: 409 }))).rejects.toBeInstanceOf(HostRequestError)
  })
})
