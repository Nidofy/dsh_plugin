import { arrangeHome, furnitureIds, homeScene, type HomeWorld, type Home } from './home-state.ts'
import type { Scene, Rect } from './world.ts'
import type { LayoutId } from './neighborhood-catalog.ts'
export interface ArrangementObject { id: string; rect: Rect; anchors: { x: number; y: number; legal: boolean }[] }
/** Presentation derives targets from the same bounded scene used by simulation. */
export function arrangementObjects(base: Scene, world: HomeWorld, draft: { home: Home; layout: LayoutId }): ArrangementObject[] {
  const geometry = homeScene(base, draft.layout, draft.home)
  return furnitureIds.map(id => {
    const rectFor = (g: typeof geometry): Rect => {
      const furniture = g.furniture.find(f => f.id === id)
      if (furniture) return furniture.rect
      if (id === 'corner' && draft.layout === 'courtyard') return g.cushion
      const spots = g.hotspots.filter(h => id === 'corner' ? !['work', 'eat', 'bench'].includes(h.id) : h.id === id)
      const x = Math.min(...spots.map(h => h.hit.x)), y = Math.min(...spots.map(h => h.hit.y))
      return { x, y, width: Math.max(...spots.map(h => h.hit.x + h.hit.width)) - x, height: Math.max(...spots.map(h => h.hit.y + h.hit.height)) - y }
    }
    return { id, rect: rectFor(geometry), anchors: ([0, 1] as const).map(index => {
      const home = { ...draft.home, positions: { ...draft.home.positions, [id]: index } }, rect = rectFor(homeScene(base, draft.layout, home))
      let legal = true
      try { arrangeHome(world, base, home, draft.layout, draft.home.revision) } catch { legal = false }
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, legal }
    }) }
  })
}
