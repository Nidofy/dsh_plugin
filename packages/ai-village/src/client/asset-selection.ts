import { character, roster, resources } from '../definitions.ts'
import type { CharacterId } from '../core/roster.ts'
import type { Character } from '../art/types.ts'
export function residentAssets(ids: readonly CharacterId[], region: 'courtyard' | 'bookhouse' = 'courtyard'): Set<string> {
  if (region !== 'courtyard' && region !== 'bookhouse') throw Error('INVALID_REGION')
  const keys = new Set<string>(region === 'courtyard' ? ['scene/background.png','scene/cushion.png','scene/desk-back.png','scene/desk-front.png','scene/table-back.png','scene/table-front.png','scene/bowl.png'] : [])
  for (const id of ids) {
    const art: Character = id === 'bluewhale' ? character : roster[id]!.character
    const prefix = id === 'bluewhale' ? 'scene/' : roster[id]!.activityPrefix
    for (const part of art.parts) { if (part.file) keys.add(part.file); for (const key of Object.values(part.expressions ?? {})) keys.add(key) }
    for (const file of ['rest-pose','work-left','work-right','eat-left','eat-right']) keys.add(prefix+file+'.png')
  }
  if ([...keys].some(key=>!resources.some(r=>r.key===key))) throw Error('ASSET_UNAVAILABLE')
  return keys
}
