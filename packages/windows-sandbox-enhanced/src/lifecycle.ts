import { randomUUID } from 'node:crypto'
import { SafetyError } from './contracts.ts'

/** Pure coordinator; not a security backend. No caller can enable execution here. */
export class Lifetime {
  private readonly tasks = new Map<string, { stop: () => Promise<void> }>()
  private state: 'open' | 'draining' | 'closed' | 'failed' = 'open'
  private closing: Promise<void> | undefined
  get status() { return { state: this.state, active: this.tasks.size } }
  track(stop: () => Promise<void>): () => void {
    if (this.state !== 'open') throw new SafetyError('DRAINING')
    const id = randomUUID(); this.tasks.set(id, { stop })
    return () => { this.tasks.delete(id) }
  }
  close(): Promise<void> {
    return this.closing ??= this.drain()
  }
  private async drain(): Promise<void> {
    this.state = 'draining'
    const results = await Promise.allSettled([...this.tasks].map(async ([id, task]) => { await task.stop(); this.tasks.delete(id) }))
    if (results.some(r => r.status === 'rejected')) { this.state = 'failed'; throw new SafetyError('CLEANUP_UNCONFIRMED') }
    this.state = 'closed'
  }
}
