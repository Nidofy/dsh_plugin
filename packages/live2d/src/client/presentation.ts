/** Local character framing has no Session, model-request or permission authority. */
export type FramePreset = 'full' | 'half' | 'portrait'
export interface CharacterPresentation {
  /** Continuous full (0), half (.5), portrait (1) camera; static art supports .5–1. */
  camera?: number
  /** Older character consumers may still supply discrete framing. */
  frame?: FramePreset
  /** Older character consumers may still supply framing-relative magnification. */
  zoom?: number
  /** Fraction of the stage: positive X moves right, positive Y moves down. */
  panX: number
  panY: number
  animation: boolean
}
export const defaultPresentation: CharacterPresentation = { camera: .5, panX: 0, panY: 0, animation: false }
/** @param frame - A named camera anchor. @returns Its continuous camera position. */
export function cameraForFrame(frame: FramePreset): number { return frame === 'full' ? 0 : frame === 'portrait' ? 1 : .5 }
/** @param presentation - Current preferences or an older optional framing value. @returns A bounded camera position. */
export function cameraValue(presentation: Pick<CharacterPresentation, 'camera' | 'frame' | 'zoom'>): number {
  const camera = presentation.camera ?? cameraForFrame(presentation.frame ?? 'half') + Math.log2(presentation.zoom ?? 1) / 2
  return Number.isFinite(camera) ? Math.min(1, Math.max(0, camera)) : .5
}
/** @param width - Stage CSS width. @param height - Stage CSS height. @param presentation - Local camera and screen-relative position.
 * @returns Pixel geometry for the fixed 410×548 upper-body resource, keeping its head inside the stage.
 */
export function staticPortraitGeometry(width: number, height: number, presentation: CharacterPresentation): {
  width: number
  height: number
  left: number
  top: number
} {
  const progress = Math.max(.5, cameraValue(presentation)) * 2 - 1
  const half = Math.min(width / 410, height / 548)
  const portrait = Math.min(width / 230, height / 260)
  const scale = half > 0 && portrait > 0 ? Math.exp(Math.log(half) * (1 - progress) + Math.log(portrait) * progress) : 0
  const centerX = 205, centerY = 274 * (1 - progress) + 142 * progress
  const panX = Math.max(-.15, Math.min(.15, presentation.panX)), panY = Math.max(-.15, Math.min(.15, presentation.panY))
  // The calibrated head/shoulder region remains visible even at the position controls' limits.
  const left = Math.min(width - 290 * scale, Math.max(-120 * scale, width / 2 - centerX * scale + panX * width))
  const top = Math.min(height - 245 * scale, Math.max(-8 * scale, height / 2 - centerY * scale + panY * height))
  return { width: 410 * scale, height: 548 * scale, left, top }
}
/** Bound backing-store work independently of display scaling.
 * @param width - Measured CSS width. @param height - Measured CSS height. @param dpr - Device pixel ratio.
 * @returns Integer backing dimensions within a four-megapixel budget.
 */
export function rasterSize(width: number, height: number, dpr: number): { width: number; height: number } {
  if (![width, height, dpr].every(Number.isFinite) || width <= 0 || height <= 0 || dpr <= 0) return { width: 1, height: 1 }
  const ratio = Math.min(dpr, 2, Math.sqrt(4_000_000 / (width * height)))
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)) }
}
