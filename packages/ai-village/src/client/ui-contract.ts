import { contract } from '../core/ui-v11-contract.ts'
export { contract }
const b = contract.breakpoints, g = contract.geometry
export const uiContract = { ...b, inspectorWidth: b.wideWidth, gutter: g.gutter, dockHeight: g.dockHeight, dockWidth: g.dockMaxWidth, drawerWidth: g.quick.normalMaxWidth, dragThreshold: contract.unchanged.dragThreshold, snapRadius: contract.unchanged.snapRadius }
export const villageTabs = ['residents', 'wishes', 'decor', 'journal'] as const
export type VillageTab = typeof villageTabs[number]
export function uiMetrics(width: number, height: number, textScale: number) {
  const short = height < b.shortHeight, wide = width >= b.wideWidth, density = short || width < b.fullHudWidth ? 'compact' : wide ? 'wide' : 'regular', type = contract.typography[density]
  const gutter = short ? g.shortGutter : g.gutter
  return { density, gutter, body: Math.max(12,type.body*textScale), secondary: Math.max(12,type.secondary*textScale), title:type.title*textScale, icon:type.icon,
    quickWidth: Math.min(width-2*gutter,short?g.quick.shortMaxWidth:wide?g.quick.wideWidth:g.quick.normalMaxWidth),
    quickHeight: short?g.quick.shortMaxHeight:wide?g.quick.wideMaxHeight:Math.max(128,Math.min(184,Math.round(.22*height))),
    detailWidth:Math.min(width-2*gutter,wide?g.detail.wideWidth:g.detail.normalMaxWidth), detailHeight:Math.min(wide?360:320,Math.floor(.52*height)),
    settingsWidth:Math.min(width-2*gutter,short?g.settings.shortMaxWidth:g.settings.normalMaxWidth), settingsHeight:Math.min(224,Math.floor(.42*height)),settingsDetailHeight:Math.min(320,Math.floor(.52*height)) }
}
