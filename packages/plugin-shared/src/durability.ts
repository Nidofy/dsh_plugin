/** Additive provider contract implemented by runtime-adapter/jsonl. */
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionInspection, SessionPersistenceOpenOptions } from '@deepseek-ai/dsh-session-persistence'
export type SessionPersistenceGeneration = Branded<'SessionPersistenceGeneration'>
export function SessionPersistenceGeneration(value: string): SessionPersistenceGeneration { return value as SessionPersistenceGeneration }
export interface SessionDurableObservation extends SessionInspection {
  readonly generation: SessionPersistenceGeneration
  readonly durableThrough: number
}
declare module '@deepseek-ai/dsh-session-persistence' {
  interface SessionPersistence {
    observeDurable(id: SessionId, options?: SessionPersistenceOpenOptions): Promise<SessionDurableObservation>
    withGeneration<T>(id: SessionId, generation: SessionPersistenceGeneration, publish: () => Promise<T>, options?: SessionPersistenceOpenOptions): Promise<T>
  }
}
