import { projectCamera, defaultCamera, type Camera } from '../core/camera.ts'
export function sceneViewport(width: number, height: number, camera: Camera = defaultCamera) {
  const world = projectCamera({ x: 0, y: 0, width, height }, camera)
  return { world, background: { x: world.x, y: world.y, width: 360 * world.scale, height: 480 * world.scale } }
}
