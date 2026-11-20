import { readFile } from 'node:fs/promises'
import type { BilingualText, Catalog, GlossaryEntry } from './types.ts'

function isBilingual(v: unknown): v is BilingualText {
  if (!v || typeof v !== 'object') return false
  const rec = v as Record<string, unknown>
  return typeof rec.zh === 'string' && rec.zh.trim().length > 0 && typeof rec.en === 'string' && rec.en.trim().length > 0
}

export async function loadCatalog(): Promise<Catalog> {
  const catalog: Catalog = JSON.parse(
    await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'),
  )
  const lectures: Record<string, { body: BilingualText; summary: BilingualText }> = JSON.parse(
    await readFile(new URL('../content/lectures.json', import.meta.url), 'utf8'),
  )
  const glossary: GlossaryEntry[] = JSON.parse(
    await readFile(new URL('../content/glossary.json', import.meta.url), 'utf8'),
  )

  for (const lesson of catalog.lessons) {
    const lecture = lectures[lesson.id]
    if (!lecture) throw Error(`Missing lecture content for lesson ${lesson.id}`)
    lesson.body = lecture.body
    lesson.summary = lecture.summary
  }
  catalog.glossary = glossary
  validateCatalog(catalog)
  return catalog
}

export function validateCatalog(c: Catalog): void {
  const counts: Record<string, number> = { '0.1.0': 8, '0.2.0': 13, '0.3.0': 17, '0.4.0': 22, '0.5.0': 26 }
  if (c.id !== 'ai-infra-lab' || !Object.hasOwn(counts, c.version)) {
    throw Error(`Unsupported catalog identity: ${c.id}@${c.version}`)
  }
  if (!Array.isArray(c.lessons) || c.lessons.length !== counts[c.version]) {
    throw Error('课程单元数量与版本不符 / Lesson count does not match catalog version')
  }
  const lessonIds = new Set(c.lessons.map((l) => l.id))
  if (lessonIds.size !== c.lessons.length) {
    throw Error('Duplicate lesson id in catalog')
  }

  // Acyclic prerequisite check
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) throw Error(`Prerequisite cycle detected at ${id}`)
    if (visited.has(id)) return
    const lesson = c.lessons.find((item) => item.id === id)
    if (!lesson) throw Error(`Unknown prerequisite lesson: ${id}`)
    visiting.add(id)
    for (const p of lesson.prerequisites) visit(p)
    visiting.delete(id)
    visited.add(id)
  }

  const exerciseIds = new Set<string>()
  for (const lesson of c.lessons) {
    if (!isBilingual(lesson.title) || !isBilingual(lesson.body) || !isBilingual(lesson.summary)) {
      throw Error(`Incomplete bilingual text on lesson ${lesson.id}`)
    }
    visit(lesson.id)
    if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) {
      throw Error(`Lesson ${lesson.id} must define at least one exercise`)
    }
    for (const ex of lesson.exercises) {
      if (exerciseIds.has(ex.id) || ex.lessonId !== lesson.id) {
        throw Error(`Invalid or duplicate exercise identity: ${ex.id}`)
      }
      if (!isBilingual(ex.title) || !isBilingual(ex.prompt)) {
        throw Error(`Missing bilingual title/prompt on exercise ${ex.id}`)
      }
      if (ex.testVersion !== '1') {
        throw Error(`Unsupported testVersion on ${ex.id}: ${ex.testVersion}`)
      }
      if (!Array.isArray(ex.hints) || ex.hints.length < 4 || !ex.hints.every(isBilingual)) {
        throw Error(`Exercise ${ex.id} must provide at least 4 bilingual hints`)
      }
      if (!Array.isArray(ex.commonErrors) || ex.commonErrors.length < 2 || !ex.commonErrors.every(isBilingual)) {
        throw Error(`Exercise ${ex.id} must provide at least 2 bilingual commonErrors`)
      }
      if (ex.kind === 'code') {
        if (!ex.runtimeKey || !ex.starter.trim() || !ex.reference.trim()) {
          throw Error(`Code exercise ${ex.id} requires runtimeKey, starter, and reference`)
        }
        if (ex.resourceProfile && !['scalar-cpu', 'multicore-cpu', 'distributed-gloo'].includes(ex.resourceProfile)) {
          throw Error(`Invalid resourceProfile on ${ex.id}`)
        }
      } else if (ex.kind === 'estimate') {
        if (!ex.estimate || !Number.isFinite(ex.estimate.expectedBase) || ex.estimate.relativeTolerance <= 0) {
          throw Error(`Estimate exercise ${ex.id} requires valid estimate spec`)
        }
      } else if (ex.kind === 'quiz') {
        if (
          !ex.quiz ||
          ex.quiz.options.length < 2 ||
          !ex.quiz.options.some((o) => o.id === ex.quiz!.correctOptionId)
        ) {
          throw Error(`Quiz exercise ${ex.id} requires valid options and correctOptionId`)
        }
      } else if (ex.kind === 'simulator') {
        if (!ex.simulator || !['bit-layout', 'roofline', 'gpu-coalescing', 'memory-waterfall', 'pipeline-schedule'].includes(ex.simulator.widget)) {
          throw Error(`Simulator exercise ${ex.id} requires valid widget spec`)
        }
      }
      exerciseIds.add(ex.id)
    }
  }

  if (!Array.isArray(c.glossary) || c.glossary.length < 10) {
    throw Error('Catalog glossary requires at least 10 core terms')
  }
  for (const g of c.glossary) {
    if (!g.term || !isBilingual(g.title) || !isBilingual(g.short) || !lessonIds.has(g.firstLessonId)) {
      throw Error(`Invalid glossary entry: ${g.term}`)
    }
  }
}
