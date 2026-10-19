export const BASELINE = { version: '0.2.1-rc.2', revision: '687f282e8625c6b8d11ff58211a90524be2e4317' } as const
export class SafetyError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SafetyError' }
}
export interface AuditEntry {
  path: string; finalPath: string; identity: string; descriptor: string; descriptorHash: string; sddl: string
  directory: boolean; reparsePoint: boolean; links: number; integrityRid: number | null
  labelInherited: boolean; labelInheritable: boolean; daclProtected: boolean; owner: string
}
export interface AuditReport {
  protocol: 1; root: string; capturedAt: string; complete: boolean
  entries: AuditEntry[]; ancestors: AuditEntry[]; failures: { path: string; code: string }[]
}
export interface RecoveryItem {
  path: string; identity: string; expectedHash: string; originalHash: string
  disposition: 'unchanged' | 'review' | 'blocked'; reasons: string[]
}
export interface RecoveryPlan {
  executable: false; reason: 'REVIEW_ONLY_NO_MUTATION_BACKEND'; items: RecoveryItem[]
}
export const COVERAGE = [
  'powershell', 'bash', 'terminal', 'files', 'ptc', 'internal-subagents', 'external-subagents',
  'desktop-file-view', 'workspace-publish', 'crash-recovery',
] as const
export function protectionStatus() {
  return { baseline: BASELINE, mode: 'diagnostics-only' as const, protected: false,
    isolatedExecutionQualified: false, recoveryExecutionAvailable: false,
    coverage: COVERAGE.map(path => ({ path, status: 'not-qualified' as const })) }
}
