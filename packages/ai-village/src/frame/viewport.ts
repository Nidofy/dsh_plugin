/** Fill the backdrop while keeping the complete interactive world visible and undistorted. */
export function sceneViewport(width: number, height: number) {
  const scale = Math.min(width / 360, height / 480)
  const cover = Math.max(width / 360, height / 480)
  return {
    world: { scale, x: (width - 360 * scale) / 2, y: (height - 480 * scale) / 2 },
    background: { x: (width - 360 * cover) / 2, y: (height - 480 * cover) / 2, width: 360 * cover, height: 480 * cover },
  }
}
