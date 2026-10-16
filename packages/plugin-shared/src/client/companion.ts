/** Explicit Desktop scope and cancellable reads over official Client owners. */
import type {} from '@deepseek-ai/cordis'
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { CompanionFacts, HintPreferences } from '../shared/companion-facts.ts'
import type { Hint, HintId, CompanionReturnCard } from './hints.ts'

import type { CompanionScope, CompanionHostEpoch, CompanionWindowId, CompanionViewId } from '../shared/companion-scope.ts'
export type { CompanionScope, CompanionHostEpoch, CompanionWindowId, CompanionViewId } from '../shared/companion-scope.ts'
/** T11 receipt identity validated from the actual notification source. */
export type CompanionReceiptId = Branded<'nidofy.VerificationReceiptId'>
/** T12 notice identity; consumers neither mint it nor infer it from copy. */
export type CompanionNoticeId = Branded<'nidofy.NoticeId'>
/** Bounded facts for renderers; Session completion carries no test or acceptance conclusion. */
export interface CompanionView {
  readonly scope: CompanionScope
  readonly connected: boolean
  readonly state: 'idle' | 'working' | 'waiting' | 'disconnected'
  readonly notebook: 'available' | 'disabled' | 'unavailable'
  readonly model: 'known' | 'unknown'
  readonly receiptId: CompanionReceiptId | null
  readonly noticeIds: readonly CompanionNoticeId[]
  /** Current read-only evidence; withdrawn on every scope invalidation. */
  readonly facts: CompanionFacts | null
  readonly hintPreferences: HintPreferences | null
  readonly hints: readonly Hint[]
  readonly returnCard: CompanionReturnCard | null
  /** Registered navigation commands currently admitted by the observed official owners. */
  readonly actions: readonly CompanionAction[]
}
/** Local-user navigation only; execution, approval and acceptance stay with their existing owners. */
export type CompanionAction = 'builds' | 'artifacts' | 'protection' | 'pets' | 'connections' | 'environment' | 'approval' | 'conversation'
/** Desktop bridge installed by preload, without Electron or Host credentials in business components. */
export interface CompanionDesktop {
  windowIdentity(): Promise<number>
  openPanel(panel: string, workspace: string | undefined, scope: CompanionScope): Promise<void>
}
/** Public consumer face for the Environment, Notebook and character renderer. */
export interface Companion {
  readonly view: ObservableSnapshot<CompanionView>
  /** One explicitly retained attention target, independent of subsequent foreground navigation. */
  readonly attention: ObservableSnapshot<CompanionView | null>
  /** Retain the observed Session without changing the foreground or persisting a restart intention.
   * @param scope - Current foreground observation selected by the user.
   */
  follow(scope: CompanionScope): void
  /** Release the explicit attention reference and every attached subscription. */
  releaseAttention(): void
  /** Navigate only after checking the complete currently observed attention scope.
   * @param scope - Latest attention observation; an old Host or permission revision refuses.
   */
  openAttention(scope: CompanionScope): void
  /** Validate every field against the current scope.
   * @param scope - Previously observed full scope.
   * @returns Whether it still belongs to this connected owner.
   */
  current(scope: CompanionScope): boolean
  /** Cancel on scope invalidation and refuse late results, including operations ignoring cancellation.
   * @param scope - Exact scope observed by the user.
   * @param operation - Existing owner's operation, supplied with cancellation.
   * @param signal - Optional consumer lifetime.
   * @returns The result only while this scope is still current.
   */
  using<T>(scope: CompanionScope, operation: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T>
  /** Read bounded committed Notebook/notice facts on demand without synchronization or rebinding.
   * @param scope - Current explicit scope.
   * @returns Updated bounded view; old generation failures remain unavailable.
   */
  refresh(scope: CompanionScope): Promise<CompanionView>
  /** Persist one explicit viewing choice with the observed independent preference revision.
   * @param scope - Current complete scope; navigation invalidates the response without replaying a commit.
   * @param action - Ignore/snooze one current Hint, mute/unmute the actual project, or explicitly reset choices.
   * @param id - Current Hint identity for ignore or snooze.
   * @param until - Explicit future epoch time for snooze.
   * @returns Committed preferences; a lost result requires reread, never automatic retry.
   */
  preferHints(scope: CompanionScope, action: 'ignore' | 'snooze' | 'mute' | 'unmute' | 'reset', id?: HintId, until?: number): Promise<void>
  /** Acknowledge the currently displayed return offer without handling any notice.
   * @param scope - Complete scope of the visible card.
   * @returns Committed offer identities; unavailable/unknown results are not automatically replayed.
   */
  offeredHints(scope: CompanionScope): Promise<void>
  /** Delegate one explicit navigation to preload after checking the entire scope.
   * @param scope - Current explicit scope.
   * @param action - Registered navigation action.
   * @returns Completion while scope remains current.
   */
  open(scope: CompanionScope, action: CompanionAction): Promise<void>
}
declare module '@deepseek-ai/cordis' {
  interface Context { companion: Companion }
}
declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { companionAttention: unknown }
}
