export type { Companion, CompanionView, CompanionScope } from './companion.ts'
import type { CompanionScope } from './companion.ts'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'nidofy.notebook': { kind: 'single'; scope: 'root'; owner: {
      sessionId: string; scope: CompanionScope; open: boolean; onOpenChange: (open: boolean) => void
      runWrite?: <T>(operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => Promise<T>
    } }
  }
}
