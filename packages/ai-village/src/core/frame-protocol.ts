import { isCharacterId, type CharacterId } from './roster.ts'
import { validCamera, type Camera } from './camera.ts'
import type { PointerIntent } from './controller.ts'
export const frameChannel = 'nidofy-ai-village', frameVersion = 3
export type UIInput = { kind: 'camera'; camera: Camera } | { kind: 'scene' } | { kind: 'resident'; id: CharacterId } | { kind: 'arrange'; phase: 'down' | 'up' | 'cancel'; pointerId: number; id: string; index?: number }
export function validPointer(value: unknown): value is PointerIntent {
  const p = value as PointerIntent | null
  return !!p && ['down', 'move', 'up', 'cancel'].includes(p.type) && Number.isSafeInteger(p.id) && p.id >= 0 && !!p.css && !!p.point && [p.point.x, p.point.y, p.css.x, p.css.y].every(n => Number.isFinite(n) && Math.abs(n) < 50000)
}
export function validUIInput(value: unknown): value is UIInput {
  const p = value as UIInput | null
  if (!p) return false
  if (p.kind === 'resident') return Object.keys(p).length === 2 && isCharacterId(p.id)
  if (p.kind === 'scene') return Object.keys(p).length === 1
  if (p.kind === 'camera') return Object.keys(p).length === 2 && validCamera(p.camera)
  return p.kind === 'arrange' && ['down', 'up', 'cancel'].includes(p.phase) && Number.isSafeInteger(p.pointerId) && p.pointerId >= 0 && ['work', 'eat', 'bench', 'corner', 'windChime', 'lantern', 'planter'].includes(p.id) && (p.index === undefined || Number.isSafeInteger(p.index) && p.index >= 0 && p.index <= (['work', 'eat', 'bench', 'corner'].includes(p.id) ? 1 : 2))
}
