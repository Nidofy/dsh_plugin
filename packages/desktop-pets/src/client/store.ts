import type { Preferences } from '@nidofy/dsh-plugin-shared/state'
export type PetStatus = { preferences: Preferences | null; busy: boolean; error: string }
export class PetStore {
  private value: PetStatus = { preferences: null, busy: false, error: '' }
  private listeners = new Set<() => void>()
  private lifetime = new AbortController()
  private sequence = 0
  snapshot = () => this.value
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(value: Partial<PetStatus>) { this.value = { ...this.value, ...value }; for (const listener of this.listeners) listener() }
  async request<T>(method: string, input: object = {}): Promise<T> {
    const response = await fetch('/api/nidofy-pets/' + method, { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: this.lifetime.signal })
    const data = await response.json()
    if (!response.ok) throw Error(data.error || 'PET_PLUGIN_UNAVAILABLE')
    return data as T
  }
  async refresh() {
    if (this.value.busy || this.lifetime.signal.aborted) return
    const sequence = ++this.sequence
    try {
      const data = await this.request<{ preferences: Preferences }>('status')
      if (sequence === this.sequence && !this.lifetime.signal.aborted) this.publish({ preferences: data.preferences, error: '' })
    } catch (error) {
      if (sequence === this.sequence && !this.lifetime.signal.aborted) this.publish({ preferences: null, error: String(error) })
    }
  }
  async save(edit: (preferences: Preferences) => void) {
    if (this.value.busy || !this.value.preferences || this.lifetime.signal.aborted) return
    const sequence = ++this.sequence
    const next = structuredClone(this.value.preferences); edit(next)
    this.publish({ busy: true, error: '' })
    try {
      const saved = await this.request<Preferences>('preferences', next)
      if (sequence === this.sequence && !this.lifetime.signal.aborted) this.publish({ preferences: saved })
    } catch (error) {
      // A lost response may already have committed: read back, never replay the write.
      if (sequence === this.sequence && !this.lifetime.signal.aborted) {
        try { const data = await this.request<{ preferences: Preferences }>('status'); if(sequence === this.sequence)this.publish({ preferences: data.preferences }) } catch {}
        if(sequence === this.sequence)this.publish({ error: String(error) })
      }
    } finally { if (sequence === this.sequence && !this.lifetime.signal.aborted) this.publish({ busy: false }) }
  }
  reset() {
    this.lifetime.abort(); this.lifetime = new AbortController(); ++this.sequence
    this.publish({ preferences: null, busy: false, error: '' }); void this.refresh()
  }
  dispose() { this.lifetime.abort(); ++this.sequence; this.listeners.clear() }
}
