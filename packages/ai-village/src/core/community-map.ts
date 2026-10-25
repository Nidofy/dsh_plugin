import type { RegionId } from './living-state.ts'
import type { Point } from './world.ts'
import { bookhouseEntries } from './bookhouse-scene.ts'
import { teaSquareEntries } from './tea-square-scene.ts'

/** Navigation metadata only. Map coordinates never become world feet or a persistent identity. */
export type CommunityPlaceId = RegionId | 'tea-square' | 'lakeside-garden' | 'workshop'
type Text = { zh: string; en: string }
export interface CommunityPlace {
  id: CommunityPlaceId
  name: Text
  description: Text
  icon: 'home' | 'journal' | 'residents' | 'wishes' | 'decor'
  map: { x: number; y: number }
  status: 'available' | 'planned'
  scene: { id: RegionId; version: number; entries: readonly Point[]; returnPolicy: 'saved-feet' } | null
  art: { status: 'approved' | 'development-preview' | 'pending'; resource: string | null }
}
export const communityPlaces: readonly CommunityPlace[] = [
  { id:'courtyard', name:{zh:'白鲸小院',en:'Whale Courtyard'}, description:{zh:'和伙伴一起生活、布置小院，留住平凡日子里的小回忆。',en:'Make a home with your neighbors, arrange the courtyard, and keep everyday memories.'}, icon:'home', map:{x:55,y:45}, status:'available', scene:{id:'courtyard',version:3,entries:[],returnPolicy:'saved-feet'}, art:{status:'approved',resource:'scene/background.png'} },
  { id:'bookhouse', name:{zh:'AI 书屋',en:'AI Bookhouse'}, description:{zh:'选一本书、写下一句话，和朋友一起寻找书页里的秘密。',en:'Choose a book, write a thought, and discover the secrets of its pages with a friend.'}, icon:'journal', map:{x:22,y:33}, status:'available', scene:{id:'bookhouse',version:1,entries:bookhouseEntries,returnPolicy:'saved-feet'}, art:{status:'approved',resource:'bookhouse/bookhouse-scene-atlas.png'} },
  { id:'tea-square', name:{zh:'茶会广场',en:'Tea Square'}, description:{zh:'选一杯茶坐一会儿，邀三位朋友摆好杯垫，把共同的下午留在留言树上。',en:'Choose a tea, arrange coasters with three friends, and leave a shared afternoon on the message tree.'}, icon:'residents', map:{x:60,y:72}, status:'available', scene:{id:'tea-square',version:1,entries:teaSquareEntries,returnPolicy:'saved-feet'}, art:{status:'approved',resource:'tea-square/background.png'} },
  { id:'lakeside-garden', name:{zh:'湖畔花园',en:'Lakeside Garden'}, description:{zh:'未来可以沿着水边散步，发现花草与季节的小变化。',en:'A future place to stroll beside the water and notice flowers and the seasons.'}, icon:'wishes', map:{x:76,y:18}, status:'planned', scene:null, art:{status:'pending',resource:null} },
  { id:'workshop', name:{zh:'AI 工坊',en:'AI Workshop'}, description:{zh:'计划中的协作小屋，一起制作属于社区的小物件。',en:'A planned workshop for making little things together for the community.'}, icon:'decor', map:{x:23,y:82}, status:'planned', scene:null, art:{status:'pending',resource:null} },
]
export const communityConnections: readonly (readonly [CommunityPlaceId,CommunityPlaceId])[] = [
  ['courtyard','bookhouse'], ['courtyard','tea-square'], ['tea-square','lakeside-garden'], ['tea-square','workshop'],
]
export const communityPlace = (id: unknown) => communityPlaces.find(place => place.id === id)
export type TravelIssue = 'INVALID_REGION' | 'REGION_PLANNED' | 'REGION_UNCHANGED' | 'REGION_NOT_CONNECTED' | 'EVENT_ACTIVE' | 'REGION_DRAGGING' | 'REGION_ARRANGING' | 'REGION_PHOTO' | 'REGION_SAVING' | 'REGION_UNCONFIRMED' | 'REGION_CONNECTION' | 'REGION_NOT_READY' | 'REGION_FULL' | 'INVALID_REGION_WORLD'
export function communityTravelIssue(from: RegionId, target: unknown): TravelIssue | null {
  const place = communityPlace(target)
  if (!place) return 'INVALID_REGION'
  if (place.status !== 'available' || !place.scene) return 'REGION_PLANNED'
  if (from === target) return 'REGION_UNCHANGED'
  if (!communityConnections.some(([a,b]) => a === from && b === target || b === from && a === target)) return 'REGION_NOT_CONNECTED'
  return null
}
export function assertCommunityTravel(from: RegionId, target: unknown) {
  const issue = communityTravelIssue(from, target)
  if (issue) throw Error(issue)
}
const travelMessages: Record<TravelIssue, Text> = {
  INVALID_REGION:{zh:'这个地点不存在。',en:'This place does not exist.'},
  REGION_PLANNED:{zh:'建设中，尚未开放。',en:'Planned; not open yet.'},
  REGION_UNCHANGED:{zh:'你和伙伴们正在这里。',en:'You and your neighbors are here.'},
  REGION_NOT_CONNECTED:{zh:'当前地点没有通往这里的路线。',en:'There is no direct route here from your current place.'},
  EVENT_ACTIVE:{zh:'先完成或取消正在进行的故事或活动，再一起出发。',en:'Finish or cancel the current story or activity before traveling.'},
  REGION_DRAGGING:{zh:'先放下正在拖动的居民。',en:'Put down the resident you are holding first.'},
  REGION_ARRANGING:{zh:'先保存或取消布置草稿。',en:'Save or cancel your arrangement first.'},
  REGION_PHOTO:{zh:'先退出拍照模式。',en:'Leave photo mode first.'},
  REGION_SAVING:{zh:'正在保存，请稍等。',en:'Saving; please wait.'},
  REGION_UNCONFIRMED:{zh:'上次保存结果尚未确认，请先核对存档。',en:'The last save is unconfirmed. Check the saved state first.'},
  REGION_CONNECTION:{zh:'连接尚未恢复，请先重新连接小院。',en:'Reconnect to the village before traveling.'},
  REGION_NOT_READY:{zh:'场景尚未就绪，请等待画面准备完成。',en:'Wait for the scene to be ready.'},
  REGION_FULL:{zh:'目的地暂时没有足够的安全落脚位置。',en:'There are not enough safe arrival spots at the destination.'},
  INVALID_REGION_WORLD:{zh:'目的地的返回位置未通过校验，存档保持原样。',en:'The saved return positions could not be validated. Your save is unchanged.'},
}
export const travelMessage = (issue: string, locale: 'zh' | 'en') => travelMessages[issue as TravelIssue]?.[locale] ?? (locale === 'zh' ? '暂时无法出发，请查看诊断信息。' : 'Travel is unavailable. Please check diagnostics.')
