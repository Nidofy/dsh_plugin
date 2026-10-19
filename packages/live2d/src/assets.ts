/** Fixed offline closure. The route accepts these literal names only. */
export const assets: Record<string, { type: string; limit: number }> = {
  'upperbody.png': { type: 'image/png', limit: 4 * 1024 * 1024 },
  'live2d/live2dcubismcore.min.js': { type: 'text/javascript', limit: 512 * 1024 },
  'live2d/bluewhale-sdk.mjs': { type: 'text/javascript', limit: 1024 * 1024 },
  'live2d/bluewhale.model3.json': { type: 'application/json', limit: 65536 },
  'live2d/bluewhale.moc3': { type: 'application/octet-stream', limit: 8 * 1024 * 1024 },
  'live2d/bluewhale.cdi3.json': { type: 'application/json', limit: 65536 },
  'live2d/bluewhale.2048/texture_00.png': { type: 'image/png', limit: 16 * 1024 * 1024 },
  'live2d/motions/idle.motion3.json': { type: 'application/json', limit: 65536 },
}
