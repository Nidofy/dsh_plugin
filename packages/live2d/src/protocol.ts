import type { CharacterPresentation } from './client/presentation.ts'
export const channel = 'nidofy-live2d-v1'
export type DisplayStatus = 'idle' | 'working' | 'waiting' | 'disconnected'
export interface Resources { model: Uint8Array; moc: Uint8Array; texture: Uint8Array; display: Uint8Array; idle: Uint8Array }
export interface Viewport { width: number; height: number; camera: number; panX: number; panY: number }
export interface Display { presentation: CharacterPresentation; status: DisplayStatus }
export interface Renderer {
  draw(time: number, state: DisplayStatus): void
  setViewport(viewport: Viewport): void
  dispose(): void
}
export type Factory = (canvas: HTMLCanvasElement, resources: Resources, signal: AbortSignal) => Promise<Renderer>
