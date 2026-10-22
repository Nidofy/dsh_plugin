export interface TraceState { reasons: string[]; code: string; connected: boolean; frameReady: boolean; receipt: string; ticks: number }
/** Closed field set: never accept request bodies, identities, leases or arbitrary error text. */
export class DiagnosticTrace {
  private start = Date.now()
  private rows: (TraceState & { ms: number })[] = []
  record(state: TraceState) {
    this.rows.push({ ms: Date.now() - this.start, reasons: state.reasons.slice(0, 16).map(r => r.replace(/[^a-z-]/g, '').slice(0, 32)), code: /^[A-Z_]{0,64}$/.test(state.code) ? state.code : 'UNEXPECTED_FAILURE', connected: state.connected, frameReady: state.frameReady, receipt: ['idle','pending','committed','unknown','rejected'].includes(state.receipt) ? state.receipt : 'unknown', ticks: state.ticks })
    while (this.rows.length > 200 || new TextEncoder().encode(JSON.stringify(this.rows)).length > 32768) this.rows.shift()
  }
  export() { return JSON.stringify(this.rows, null, 0) }
}
