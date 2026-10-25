import { defaultCamera, type Camera } from '../core/camera.ts'
import type { VillageTab } from './ui-contract.ts'
import type { CharacterId } from '../core/roster.ts'
export type Overlay = null | 'more' | 'view' | 'notifications' | 'settings' | 'resident' | 'map'
export type Page = 'quick' | 'residents' | 'admissions' | 'activities' | 'bonds' | 'wishes' | 'furniture' | 'hanging' | 'atmosphere' | 'memories' | 'album' | 'appearance' | 'controls' | 'status'
export interface NavEntry { tab: VillageTab; drawer: PresentationState['drawer']; overlay: Overlay; page: Page; scrollTop: number; focusKey: string; accessoryTarget: CharacterId | null; residentTarget: CharacterId | null; subpages: PresentationState['subpages']; noticeTarget: string | null }
export interface PresentationState {
  page: Page; history: NavEntry[]; scrollTop: number; focusKey: string; residentTarget: CharacterId | null
  tab: VillageTab; drawer: 'closed' | 'half' | 'full'; overlay: Overlay; camera: Camera; expanded: boolean;
  selectedFurniture: 'work' | 'eat' | 'bench' | 'corner'; accessoryTarget: CharacterId | null;
  subpages: { wishes: 'wishes' | 'activities'; decor: 'furniture' | 'hanging' | 'atmosphere'; journal: 'memories' | 'album' };
  confirmClose: boolean; confirmTarget: 'plugin' | 'arrangement'; zoomHint: number; toastIds: string[]; noticeTarget: string | null
}
export const initialPresentation = (): PresentationState => ({ page: 'quick', history: [], scrollTop: 0, focusKey: '', residentTarget: null, tab: 'residents', drawer: 'closed', overlay: null, camera: { ...defaultCamera }, expanded: false, selectedFurniture: 'work', accessoryTarget: null, subpages: { wishes: 'wishes', decor: 'furniture', journal: 'memories' }, confirmClose: false, confirmTarget: 'plugin', zoomHint: 0, toastIds: [], noticeTarget: null })
export type UIAction = { type: 'tab'; tab: VillageTab; short?: boolean } | { type: 'overlay'; overlay: Overlay } | { type: 'close' } | { type: 'back' } | { type: 'push'; patch: Partial<NavEntry> } | { type: 'patch'; patch: Partial<PresentationState> }
const entry = (s: PresentationState): NavEntry => ({ tab:s.tab,drawer:s.drawer,overlay:s.overlay,page:s.page,scrollTop:s.scrollTop,focusKey:s.focusKey,accessoryTarget:s.accessoryTarget,residentTarget:s.residentTarget,subpages:{...s.subpages},noticeTarget:s.noticeTarget })
export function presentationReducer(state: PresentationState, action: UIAction): PresentationState {
  if (action.type === 'tab') return { ...state, tab: action.tab, overlay: null, page:'quick', residentTarget:null, history:[],scrollTop:0,focusKey:'',drawer: state.tab === action.tab && state.drawer !== 'closed' ? 'closed' : 'half' }
  if (action.type === 'overlay') return state.overlay === action.overlay ? presentationReducer(state,{type:'back'}) : presentationReducer(state,{type:'push',patch:{drawer:'closed',overlay:action.overlay,page:'quick'}})
  if (action.type === 'push') return {...state,...action.patch,history:[...state.history,entry(state)].slice(-8),scrollTop:0,focusKey:''}
  if (action.type === 'back') { const previous=state.history.at(-1); return previous?{...state,...previous,history:state.history.slice(0,-1)}:presentationReducer(state,{type:'close'}) }
  if (action.type === 'close') return { ...state, drawer: 'closed', overlay: null, page:'quick',history:[],scrollTop:0,focusKey:'' }
  return { ...state, ...action.patch }
}
