export type RunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'interrupted'
export type CheckStatus = 'not_run' | 'passed' | 'failed' | 'inconclusive' | 'not_applicable'
export type HelpLevel = 'unknown' | 'none' | 'concept' | 'steps' | 'code' | 'answer'
export interface Exercise {
  evidenceKind?: 'explanation' | 'implementation' | 'debugging' | 'transfer'
  id: string
  lessonId: string
  title: string
  kind: 'code' | 'numeric' | 'explanation' | 'experiment'
  prompt: string
  starter: string
  reference: string
  hints: string[]
  concepts: string[]
  testVersion: string
  answer?: string
  runtimeKey?: string
  inputDomain: string
  commonErrors: string[]
}
export interface Lesson {
  id: string
  title: string
  kind: 'concept' | 'practice' | 'experiment'
  prerequisites: string[]
  objectives: string[]
  body: string
  summary: string
  exercises: Exercise[]
  sources: string[]
}
export interface Catalog {
  id: string
  version: string
  lessons: Lesson[]
}
export type ExperimentConfig = Record<string, number | boolean | number[]>
export interface TrainingManifest {
  protocol: string
  dataset: string
  splitHash: string
  initialHash: string
  batchHash: string
}
export interface RunEvent {
  source?: 'student' | 'program'
  manifest?: TrainingManifest
  runId: string
  seq: number
  type: 'metric' | 'tensor' | 'artifact' | 'check' | 'config' | 'manifest' | 'sample'
  name: string
  config?: ExperimentConfig
  value?: number
  step?: number
  data?: number[][]
  path?: string
  passed?: boolean
  detail?: string
}
export interface RunRecord {
  prediction?: string
  trainingManifest?: TrainingManifest
  id: string
  exerciseId: string
  code: string
  contentVersion: string
  testVersion: string
  seed: number
  config: Record<string, number>
  effectiveConfig?: ExperimentConfig
  requestedImage?: string
  resolvedImageId?: string
  cleanupPending?: string
  attemptId?: string
  environment: string
  run_status: RunStatus
  check_status: CheckStatus
  createdAt: string
  finishedAt?: string
  events: RunEvent[]
  log: string
  reason?: string
  help: HelpLevel
}
export interface Evidence {
  provenance?: 'legacy' | 'recorded'
  id?: string
  runId?: string
  answerId?: string
  attemptId?: string
  contentVersion?: string
  testVersion?: string
  exerciseId: string
  concept: string
  kind: 'reading' | 'observation' | 'explanation' | 'implementation' | 'debugging' | 'transfer'
  source: 'program' | 'learner' | 'mentor'
  help: HelpLevel
  result: string
  at: string
}
export interface Workspace {
  profileId: string
  exercise: Exercise
  draft: string
  revision: number
  note: string
  noteRevision: number
  runs: RunRecord[]
  hints: HelpLevel[]
  snapshots?: { code: string; revision: number; reason: string; at: string }[]
  answers?: {
    runId?: string
    id?: string
    text: string
    status: string
    contentVersion: string
    testVersion: string
  }[]
  messages: { role: string; text: string; status: string }[]
}
export interface Overview {
  catalog: Catalog
  currentLesson: string
  readLessons: string[]
  profile: Record<string, string>
  reviews: { exerciseId: string; reason: string; due: string; runId?: string }[]
  evidence: Evidence[]
}
export interface EnvironmentStatus {
  requestedImage?: string
  resolvedImageId?: string
  available: boolean
  detail: string
  image: string
}
export interface LabApi {
  overview(): Promise<Overview>
  workspace(id: string, signal?: AbortSignal): Promise<Workspace>
  saveDraft(id: string, code: string, revision: number): Promise<number>
  saveNote(id: string, note: string, revision: number): Promise<number>
  readLesson(id: string): Promise<void>
  selectLesson(id: string): Promise<void>
  saveProfile(profile: Record<string, string>): Promise<void>
  start(
    id: string,
    code: string,
    config: Record<string, number>,
    prediction?: string,
  ): Promise<RunRecord>
  run(id: string, signal?: AbortSignal): Promise<RunRecord>
  cancel(id: string): Promise<void>
  answer(id: string, text: string, runId?: string): Promise<CheckStatus>
  hint(id: string, level: HelpLevel): Promise<string>
  tutor(
    id: string,
    text: string,
    selection: string,
    mode?: HelpLevel,
  ): Promise<{ status: string; text: string }>
  environment(): Promise<EnvironmentStatus>
  exportData(): Promise<string>
  snooze(id: string, runId?: string): Promise<void>
  finishReview(runId: string): Promise<void>
  independent(id: string): Promise<void>
}
