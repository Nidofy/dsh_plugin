import { HostRequestError } from './json-response.ts'
export const recoveryDelays = [1000, 2000, 4000] as const
export function recoveryCode(error: unknown, source: 'heartbeat' | 'operation' = 'operation'): string {
  if (source === 'heartbeat' && (error instanceof TypeError || error instanceof Error && error.name === 'TimeoutError')) return 'CONNECTION_TEMPORARY'
  if (source === 'heartbeat' && error instanceof HostRequestError && [502, 503, 504].includes(error.status)) return 'CONNECTION_TEMPORARY'
  return error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'UNEXPECTED_FAILURE'
}
export const canRecover = (code: string) => ['CONNECTION_TEMPORARY', 'SAVE_UNCONFIRMED', 'PREFERENCES_UNCONFIRMED'].includes(code)
