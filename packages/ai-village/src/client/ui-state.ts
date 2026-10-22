import { defaultCamera, type Camera } from '../core/camera.ts'
import type { VillageTab } from './ui-contract.ts'
import type { CharacterId } from '../core/roster.ts'
export type Overlay = null | 'more' | 'view' | 'notifications' | 'settings' | 'resident'
export interface PresentationState {
  tab: VillageTab; drawer: 'closed' | 'half' | 'full'; overlay: Overlay; camera: Camera; expanded: boolean;
  selectedFurniture: 'work' | 'eat' | 'bench' | 'corner'; accessoryTarget: CharacterId | null;
  subpages: { wishes: 'wishes' | 'activities'; decor: 'furniture' | 'hanging' | 'atmosphere'; journal: 'memories' | 'album' };
  confirmClose: boolean; zoomHint: number; toastIds: string[]; noticeTarget: string | null
}
export const initialPresentation = (): PresentationState => ({ tab: 'residents', drawer: 'closed', overlay: null, camera: { ...defaultCamera }, expanded: false, selectedFurniture: 'work', accessoryTarget: null, subpages: { wishes: 'wishes', decor: 'furniture', journal: 'memories' }, confirmClose: false, zoomHint: 0, toastIds: [], noticeTarget: null })
export type UIAction = { type: 'tab'; tab: VillageTab; short?: boolean } | { type: 'overlay'; overlay: Overlay } | { type: 'close' } | { type: 'patch'; patch: Partial<PresentationState> }
export function presentationReducer(state: PresentationState, action: UIAction): PresentationState {
  if (action.type === 'tab') return { ...state, tab: action.tab, overlay: null, drawer: state.tab === action.tab && state.drawer !== 'closed' ? 'closed' : action.short ? 'full' : state.drawer === 'closed' ? 'half' : state.drawer }
  if (action.type === 'overlay') return { ...state, drawer: 'closed', overlay: state.overlay === action.overlay ? null : action.overlay }
  if (action.type === 'close') return { ...state, drawer: 'closed', overlay: null }
  return { ...state, ...action.patch }
}
