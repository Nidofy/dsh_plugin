import type { Resources } from '../protocol.ts'
const base = '/api/nidofy-live2d/assets/live2d/'
const files = ['bluewhale.model3.json', 'bluewhale.moc3', 'bluewhale.2048/texture_00.png', 'bluewhale.cdi3.json', 'motions/idle.motion3.json'] as const
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('LIVE2D_RESOURCE_INVALID')
  return value as Record<string, unknown>
}
async function bytes(path: typeof files[number], signal: AbortSignal): Promise<Uint8Array> {
  const limit = path.endsWith('.png') ? 16 * 1024 * 1024 : path.endsWith('.moc3') ? 8 * 1024 * 1024 : 64 * 1024
  const response = await fetch(base + path, { signal, redirect: 'error' })
  if (!response.ok || !response.body) throw Error('LIVE2D_RESOURCE_UNAVAILABLE')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      signal.throwIfAborted()
      const row = await reader.read()
      if (row.done) break
      size += row.value.byteLength; if (size > limit) throw Error('LIVE2D_RESOURCE_LIMIT')
      chunks.push(row.value)
    }
  } finally { try { await reader.cancel() } finally { reader.releaseLock() } }
  signal.throwIfAborted()
  const result = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  if (!size) throw Error('LIVE2D_RESOURCE_INVALID')
  return result
}
/** Load the exact fixed resource closure, refusing arbitrary paths and extra references.
 * @param signal - Loading lifetime. @returns Validated model bytes.
 */
export async function loadBluewhale(signal: AbortSignal): Promise<Resources> {
  const model = await bytes(files[0], signal), value = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(model)))
  const refs = record(value.FileReferences), motions = record(refs.Motions)
  if (value.Version !== 3 || Object.keys(refs).sort().join() !== 'DisplayInfo,Moc,Motions,Textures'
    || refs.Moc !== files[1] || refs.DisplayInfo !== files[3] || JSON.stringify(refs.Textures) !== JSON.stringify([files[2]])
    || Object.keys(motions).join() !== 'Idle' || !Array.isArray(motions.Idle) || motions.Idle.length !== 1
    || record(motions.Idle[0]).File !== files[4]
    || Object.keys(record(motions.Idle[0])).some(key => !['File', 'FadeInTime', 'FadeOutTime'].includes(key))) throw Error('LIVE2D_REFERENCE_REFUSED')
  const [moc, texture, display, idle] = await Promise.all(files.slice(1).map(path => bytes(path, signal)))
  if (!moc || !texture || !display || !idle || new TextDecoder().decode(moc.slice(0, 4)) !== 'MOC3') throw Error('LIVE2D_RESOURCE_INVALID')
  record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(display)))
  const motion = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(idle)))
  if (motion.Version !== 3 || !Array.isArray(motion.Curves) || motion.Curves.length !== 1
    || record(motion.Curves[0]).Id !== 'ParamBodySway') throw Error('LIVE2D_MOTION_REFUSED')
  return { model, moc, texture, display, idle }
}
