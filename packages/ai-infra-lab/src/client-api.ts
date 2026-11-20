import type { InfraLabApi } from './types.ts'

function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null) {
    if ('error' in payload && typeof (payload as { error: unknown }).error === 'string') {
      return (payload as { error: string }).error
    }
    if ('message' in payload && typeof (payload as { message: unknown }).message === 'string') {
      return (payload as { message: string }).message
    }
  }
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload.trim().slice(0, 300)
  }
  return `HTTP ${status}`
}

export function createApi(): InfraLabApi {
  async function call<T>(method: string, args: unknown[] = [], signal?: AbortSignal): Promise<T> {
    const response = await fetch('/api/ai-infra-lab/rpc', {
      method: 'POST',
      signal,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, args }),
    })

    const rawText = await response.text()
    let parsed: unknown = undefined
    if (rawText.length > 0) {
      try {
        parsed = JSON.parse(rawText) as unknown
      } catch {
        parsed = rawText
      }
    }

    if (!response.ok) {
      throw new Error(extractErrorMessage(parsed, response.status))
    }

    return parsed as T
  }

  return {
    overview: () => call('overview'),
    workspace: (id, signal) => call('workspace', [id], signal),
    environment: () => call('environment'),
    selectLesson: (id) => call('selectLesson', [id]),
    readLesson: (id) => call('readLesson', [id]),
    saveDraft: (id, code, revision) => call('saveDraft', [id, code, revision]),
    saveNote: (id, note, revision) => call('saveNote', [id, note, revision]),
    saveProfile: (profile, revision) => call('saveProfile', [profile, revision]),
    start: (id, code, config, prediction) =>
      call('start', prediction === undefined ? [id, code, config] : [id, code, config, prediction]),
    run: (id, signal) => call('run', [id], signal),
    cancel: (id) => call('cancel', [id]),
    answer: (id, text, runId) =>
      call('answer', runId === undefined ? [id, text] : [id, text, runId]),
    completeSimulator: (id, summaryJson) => call('completeSimulator', [id, summaryJson]),
    hint: (id, level) => call('hint', [id, level]),
    beginIndependent: (id) => call('beginIndependent', [id]),
    dismissReview: (exerciseId) => call('dismissReview', [exerciseId]),
    tutor: (id, question, mode, runId) =>
      call('tutor', runId === undefined ? [id, question, mode] : [id, question, mode, runId]),
    exportData: () => call('exportData'),
    importData: (rawJson) => call('importData', [rawJson]),
  }
}
