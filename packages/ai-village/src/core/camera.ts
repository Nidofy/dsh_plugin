export interface Camera { zoom: number; panX: number; panY: number }
export interface Workspace { x: number; y: number; width: number; height: number }
export const defaultCamera: Camera = { zoom: 1, panX: 0, panY: 0 }
export function validCamera(c: unknown): c is Camera {
  const v = c as Camera | null
  return !!v && [v.zoom, v.panX, v.panY].every(Number.isFinite) && v.zoom >= 1 && v.zoom <= 1.5 && Math.abs(v.panX) < 50000 && Math.abs(v.panY) < 50000
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export function projectCamera(w: Workspace, c: Camera = defaultCamera) {
  const scale = Math.min(w.width / 360, w.height / 480) * c.zoom, dx = w.width - 360 * scale, dy = w.height - 480 * scale
  return { scale, x: w.x + (dx >= 0 ? dx / 2 : clamp(dx / 2 + c.panX, dx, 0)), y: w.y + (dy >= 0 ? dy / 2 : clamp(dy / 2 + c.panY, dy, 0)) }
}
export function clampCamera(w: Workspace, c: Camera): Camera {
  const zoom = clamp(c.zoom, 1, 1.5), p = projectCamera(w, { ...c, zoom })
  return { zoom, panX: p.x - w.x - (w.width - 360 * p.scale) / 2, panY: p.y - w.y - (w.height - 480 * p.scale) / 2 }
}
export function zoomCamera(w: Workspace, c: Camera, zoom: number, point = { x: w.x + w.width / 2, y: w.y + w.height / 2 }): Camera {
  const old = projectCamera(w, c), next = projectCamera(w, { ...defaultCamera, zoom: clamp(zoom, 1, 1.5) })
  return clampCamera(w, { zoom: clamp(zoom, 1, 1.5), panX: point.x - (point.x - old.x) / old.scale * next.scale - next.x, panY: point.y - (point.y - old.y) / old.scale * next.scale - next.y })
}
