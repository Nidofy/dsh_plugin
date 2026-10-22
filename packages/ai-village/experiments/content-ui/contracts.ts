import type { Point } from '../../src/core/world.ts'
import type { CharacterId } from '../../src/core/roster.ts'
import type { BellSlot, Food } from '../../src/core/content-state.ts'
export { contentLimits as contractLimits } from '../../src/core/content-state.ts'
export type { ContentWorld as WorldV4, TeaEventV1, JournalEntryV1 } from '../../src/core/content-state.ts'
export type { SaveReceipt } from '../../src/client/save-transaction.ts'

/** Content and receipt types now come from M2 source; commands/frame v2 remain integration contracts. */
export type VillageCommand =
  | { type: 'invite'; participants: [CharacterId, CharacterId]; food: Food }
  | { type: 'cancel-event'; eventId: string }
  | { type: 'confirm-decoration'; slot: BellSlot; expectedLayoutRevision: number }
/** Frame keeps world coordinates; parent alone applies this CSS transform, without multiplying DPR. */
export interface FrameViewportV2 { viewportRevision: number; width: number; height: number; world: { scale: number; x: number; y: number }; dpr: number }
export interface FrameEnvelopeV2 { channel: 'nidofy-ai-village'; version: 2; token: string; sequence: number }
export type FrameMessageV2 = FrameEnvelopeV2 & (
  | { type: 'viewport'; viewport: FrameViewportV2 }
  | { type: 'pointer'; viewportRevision: number; intent: { type: 'down' | 'move' | 'up' | 'cancel'; id: number; point: Point; css: Point } }
)
