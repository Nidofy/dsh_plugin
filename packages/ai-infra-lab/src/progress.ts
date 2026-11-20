import type { Evidence } from './types.ts'

export function completesActivity(evidence: Evidence): boolean {
  return evidence.result === 'passed' || (evidence.kind === 'explanation' && evidence.result === 'inconclusive')
}
