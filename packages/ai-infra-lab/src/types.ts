export type RunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'interrupted'

export type CheckStatus = 'not_run' | 'passed' | 'failed' | 'inconclusive' | 'not_applicable'

export type HelpLevel = 'unknown' | 'none' | 'concept' | 'steps' | 'formula' | 'code' | 'answer'

export type Locale = 'zh' | 'en'

export type BilingualText = {
  zh: string
  en: string
}

/** Mandatory badge distinguishing how numbers were produced so CPU timings are never mistaken for GPU facts. */
export type DataSourceKind = 'formula' | 'cpu_measured' | 'simulated'

/** Server-owned Docker resource profile whitelist; clients cannot override container parameters. */
export type ResourceProfile = 'scalar-cpu' | 'multicore-cpu' | 'distributed-gloo'

export type UnitDimension =
  | 'scalar'
  | 'bytes'
  | 'flops'
  | 'rate_flops'
  | 'bandwidth'
  | 'time'
  | 'token_rate'

export interface EstimateSpec {
  dimension: UnitDimension
  /** Canonical expected value in the base unit of `dimension` (e.g. bytes, FLOPs, FLOP/s, B/s, seconds, or scalar). */
  expectedBase: number
  /** Canonical display answer shown in feedback/reference, e.g. "64 MiB" or "12.5 GFLOP/s". */
  canonicalDisplay: string
  /** Allowed relative error, e.g. 0.05 for +-5%. */
  relativeTolerance: number
}

export interface QuizOption {
  id: string
  label: BilingualText
}

export interface QuizSpec {
  options: QuizOption[]
  correctOptionId: string
}

export interface StepContract {
  name: string
  title: BilingualText
}

export type SimulatorWidgetKind = 'bit-layout' | 'roofline' | 'gpu-coalescing' | 'memory-waterfall' | 'pipeline-schedule' | 'serving-scheduler' | 'capacity-planner'

export interface SimulatorTargetSpec {
  widget: SimulatorWidgetKind
  goalDescription: BilingualText
}

export interface Exercise {
  id: string
  lessonId: string
  title: BilingualText
  kind: 'code' | 'estimate' | 'quiz' | 'simulator' | 'explanation'
  dataSource: DataSourceKind
  requiresPrediction?: boolean
  fastTrackSkipLesson?: boolean
  resourceProfile?: ResourceProfile
  runtimeKey?: string
  steps?: StepContract[]
  estimate?: EstimateSpec
  quiz?: QuizSpec
  simulator?: SimulatorTargetSpec
  prompt: BilingualText
  starter: string
  reference: string
  hints: BilingualText[]
  concepts: string[]
  testVersion: string
  commonErrors: BilingualText[]
}

export interface Lesson {
  id: string
  stage: 'A' | 'B' | 'C' | 'D' | 'E'
  title: BilingualText
  summary: BilingualText
  prerequisites: string[]
  objectives: BilingualText[]
  simulatorWidget?: SimulatorWidgetKind
  body: BilingualText
  exercises: Exercise[]
}

export interface GlossaryEntry {
  term: string
  aliases?: string[]
  title: BilingualText
  short: BilingualText
  analogy: BilingualText
  firstLessonId: string
}

export interface Catalog {
  id: string
  version: string
  stage: string
  lessons: Lesson[]
  glossary: GlossaryEntry[]
}

export interface RunEvent {
  runId: string
  seq: number
  type: 'metric' | 'check' | 'config' | 'roofline_point'
  name: string
  step?: string
  value?: number
  unit?: string
  passed?: boolean
  detail?: string
  message?: BilingualText
  timeline?: { rank: number; op: string; startMs: number; endMs: number }[]
  arithmeticIntensity?: number
  gflops?: number
  bandwidthGBps?: number
}

export interface RunRecord {
  id: string
  exerciseId: string
  code: string
  codeHash: string
  dataSource: DataSourceKind
  resourceProfile: ResourceProfile
  prediction?: string
  contentVersion: string
  testVersion: string
  seed: number
  config: Record<string, number>
  requestedImage?: string
  resolvedImageId?: string
  cleanupPending?: string
  attemptId: string
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

export interface AnswerRecord {
  id: string
  attemptId: string
  runId?: string
  text: string
  status: CheckStatus
  diagnostic: BilingualText
  contentVersion: string
  testVersion: string
  at: string
}

export interface Evidence {
  id: string
  runId?: string
  answerId?: string
  attemptId: string
  exerciseId: string
  concept: string
  kind: 'reading' | 'quiz' | 'estimate' | 'simulation' | 'implementation' | 'explanation'
  dataSource?: DataSourceKind
  source: 'program' | 'learner'
  help: HelpLevel
  result: string
  contentVersion: string
  testVersion?: string
  at: string
}

export interface ReviewItem {
  exerciseId: string
  lessonId: string
  reason: BilingualText
  due: string
  runId?: string
}

export interface Workspace {
  attemptId: string
  profileId: string
  exercise: Exercise
  draft: string
  revision: number
  note: string
  noteRevision: number
  runs: RunRecord[]
  hints: HelpLevel[]
  answers: AnswerRecord[]
  messages: { role: 'user' | 'tutor'; text: string; status: string; at: string }[]
}

export interface Overview {
  profileId: string
  profileRevision: number
  catalog: Catalog
  currentLesson: string
  readLessons: string[]
  fastTrackedLessons: string[]
  profile: Record<string, string>
  reviews: ReviewItem[]
  evidence: Evidence[]
  measuredRooflinePoints: {
    label: string
    exerciseId: string
    arithmeticIntensity: number
    gflops: number
    bandwidthGBps?: number
  }[]
}

export interface EnvironmentStatus {
  stage: 'ready' | 'docker_unavailable' | 'image_missing' | 'inspection_failed'
  available: boolean
  image: string
  resolvedImageId?: string
  hostCpus: number
  estimatedImageSizeGb: number
  prepareCommand: string
  detail: BilingualText
}

export interface InfraLabApi {
  overview(): Promise<Overview>
  workspace(id: string, signal?: AbortSignal): Promise<Workspace>
  environment(): Promise<EnvironmentStatus>
  selectLesson(id: string): Promise<void>
  readLesson(id: string): Promise<void>
  saveDraft(id: string, code: string, revision: number): Promise<number>
  saveNote(id: string, note: string, revision: number): Promise<number>
  saveProfile(profile: Record<string, string>, revision: number): Promise<number>
  start(
    id: string,
    code: string,
    config: Record<string, number>,
    prediction?: string,
  ): Promise<RunRecord>
  run(id: string, signal?: AbortSignal): Promise<RunRecord>
  cancel(id: string): Promise<void>
  answer(id: string, text: string, runId?: string): Promise<{ status: CheckStatus; diagnostic: BilingualText }>
  completeSimulator(id: string, summaryJson: string): Promise<{ status: CheckStatus; diagnostic: BilingualText }>
  hint(id: string, level: HelpLevel): Promise<BilingualText>
  beginIndependent(id: string): Promise<void>
  dismissReview(exerciseId: string): Promise<void>
  tutor(id: string, question: string, mode: HelpLevel, runId?: string, focusStep?: string): Promise<{ status: string; text: string }>
  exportData(): Promise<string>
  importData(rawJson: string): Promise<{ importedRuns: number; importedEvidence: number }>
}
