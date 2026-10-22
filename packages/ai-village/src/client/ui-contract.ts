/** AV-UI-20261022. Dimensions refer to the plugin's CSS viewport. */
export const uiContract = { minimumWidth: 320, minimumHeight: 360, fullHudWidth: 560, inspectorWidth: 900, shortHeight: 480, gutter: 12, dockHeight: 56, dockWidth: 352, drawerWidth: 480, dragThreshold: 5, snapRadius: 26 } as const
export const villageTabs = ['residents', 'wishes', 'decor', 'journal'] as const
export type VillageTab = typeof villageTabs[number]
