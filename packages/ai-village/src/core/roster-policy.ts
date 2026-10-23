/** Immutable historical boundary; current engines may explicitly validate expanded projections. */
export const legacyCharacterIds = ['bluewhale','claude','gemini','gpt','grok','kimi','qwen'] as const
export type RosterScope = 'legacy' | 'current'
export function checkRosterScope(value: unknown, scope: RosterScope) {
  if (scope === 'current') return
  const added = new Set(['seedance','glm','minimax','llama','mistral'])
  const visit = (v: unknown): void => {
    if (typeof v === 'string' && added.has(v)) throw Error('HISTORICAL_ROSTER_REQUIRED')
    if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object') for (const [key,item] of Object.entries(v)) {
      if (added.has(key)) throw Error('HISTORICAL_ROSTER_REQUIRED')
      visit(item)
    }
  }
  visit(value)
}
