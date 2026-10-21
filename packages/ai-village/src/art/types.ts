export type Expression = 'neutral' | 'happy' | 'surprised' | 'sleepy'
export type Action = 'idle' | 'walk' | 'pickup' | 'dragging' | 'put_down'
export interface Part {
  id: string
  parent: string | null
  file?: string
  expressions?: Record<Expression, string>
  offset: [number, number]
  size: [number, number]
  pivot: [number, number]
  z: number
  mirror: 'never'
}
export interface Character {
  schemaVersion: 1
  id: string
  canvas: [number, number]
  feet: [number, number]
  visibleHeight: number
  parts: Part[]
}
export type Property = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'
export interface Keyframe { time: number; value: number }
export interface Track { part: string; property: Property; keys: Keyframe[] }
export interface Clip {
  duration: number
  loop: boolean
  transition: number
  expression: Expression
  expressions?: { time: number; value: Expression }[]
  tracks: Track[]
}
export interface AnimationSet { schemaVersion: 1; actions: Record<Action, Clip> }
export interface Transform { x: number; y: number; rotation: number; scaleX: number; scaleY: number }
export interface Pose { transforms: Record<string, Transform>; expression: Expression; ended: boolean }
