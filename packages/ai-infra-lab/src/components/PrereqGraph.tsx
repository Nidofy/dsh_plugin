import { useMemo, useState } from 'react'
import type { Evidence, Lesson, Locale } from '../types.ts'
import { pickText, tr } from './i18n.ts'

export interface PrereqGraphProps {
  readonly lessons: readonly Lesson[]
  readonly currentLessonId: string
  readonly readLessons: readonly string[]
  readonly fastTrackedLessons: readonly string[]
  readonly evidence: readonly Evidence[]
  readonly locale: Locale
  readonly onSelectLesson: (lessonId: string) => void
}

interface PositionedNode {
  readonly lesson: Lesson
  readonly col: number
  readonly row: number
  readonly x: number
  readonly y: number
  readonly isRead: boolean
  readonly isCompleted: boolean
  readonly isFastTracked: boolean
}

const NODE_W = 148
const NODE_H = 58
const COL_GAP = 42
const ROW_GAP = 20
const PAD_X = 16
const PAD_Y = 16

export function PrereqGraph({
  lessons,
  currentLessonId,
  readLessons,
  fastTrackedLessons,
  evidence,
  locale,
  onSelectLesson,
}: PrereqGraphProps) {
  const [stage, setStage] = useState('all')
  const stages = [...new Set(lessons.map(l => l.stage))]
  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const byId = new Map(lessons.map((l) => [l.id, l]))
    const depthMemo = new Map<string, number>()

    const getDepth = (id: string, visiting = new Set<string>()): number => {
      const cached = depthMemo.get(id)
      if (cached !== undefined) return cached
      if (visiting.has(id)) return 0
      visiting.add(id)
      const lesson = byId.get(id)
      if (!lesson || lesson.prerequisites.length === 0) {
        depthMemo.set(id, 0)
        return 0
      }
      let maxPre = -1
      for (const pre of lesson.prerequisites) {
        if (byId.has(pre)) {
          maxPre = Math.max(maxPre, getDepth(pre, visiting))
        }
      }
      const depth = maxPre + 1
      depthMemo.set(id, depth)
      return depth
    }

    const columns = new Map<number, Lesson[]>()
    let maxCol = 0
    for (const lesson of lessons.filter(l => stage === 'all' || l.stage === stage)) {
      const col = getDepth(lesson.id)
      maxCol = Math.max(maxCol, col)
      const bucket = columns.get(col) ?? []
      bucket.push(lesson)
      columns.set(col, bucket)
    }

    let maxRows = 1
    for (const bucket of columns.values()) {
      maxRows = Math.max(maxRows, bucket.length)
    }

    const passedExercises = new Set(
      evidence
        .filter(e => e.result === 'passed' || (e.kind === 'explanation' && e.result === 'inconclusive'))
        .map((e) => e.exerciseId),
    )
    const readSet = new Set(readLessons)
    const fastSet = new Set(fastTrackedLessons)

    const totalHeight = Math.max(
      NODE_H + PAD_Y * 2,
      maxRows * NODE_H + (maxRows - 1) * ROW_GAP + PAD_Y * 2,
    )
    const totalWidth = Math.max(
      320,
      (maxCol + 1) * NODE_W + maxCol * COL_GAP + PAD_X * 2,
    )

    const positioned: PositionedNode[] = []
    const posById = new Map<string, PositionedNode>()

    for (let col = 0; col <= maxCol; col++) {
      const bucket = columns.get(col) ?? []
      const colContentH = bucket.length * NODE_H + Math.max(0, bucket.length - 1) * ROW_GAP
      const startY = Math.round((totalHeight - colContentH) / 2)
      bucket.forEach((lesson, row) => {
        const x = PAD_X + col * (NODE_W + COL_GAP)
        const y = startY + row * (NODE_H + ROW_GAP)
        const isRead = readSet.has(lesson.id)
        const isFastTracked = fastSet.has(lesson.id)
        const allExercisesDone =
          lesson.exercises.length > 0 &&
          lesson.exercises.every((ex) => passedExercises.has(ex.id))
        const isCompleted = isFastTracked || (isRead && allExercisesDone) || allExercisesDone
        const node: PositionedNode = {
          lesson,
          col,
          row,
          x,
          y,
          isRead,
          isCompleted,
          isFastTracked,
        }
        positioned.push(node)
        posById.set(lesson.id, node)
      })
    }

    const edgeList: { from: PositionedNode; to: PositionedNode }[] = []
    for (const node of positioned) {
      for (const preId of node.lesson.prerequisites) {
        const fromNode = posById.get(preId)
        if (fromNode) {
          edgeList.push({ from: fromNode, to: node })
        }
      }
    }

    return {
      nodes: positioned,
      edges: edgeList,
      svgWidth: totalWidth,
      svgHeight: totalHeight,
    }
  }, [lessons, readLessons, fastTrackedLessons, evidence, stage])

  if (nodes.length === 0) return null

  return (
    <section
      className="ail-prereq-panel"
      aria-label={tr(locale, '课程前置关系图', 'Course prerequisites')}
    >
      <div className="ail-prereq-head">
        <span className="ail-prereq-title">
          {tr(locale, '课程前置关系（点击单元跳转）', 'Prerequisites (select a unit to open it)')}
        </span>
        <label>{tr(locale, '筛选阶段', 'Filter by stage')} <select value={stage} onChange={e => setStage(e.target.value)}>
          <option value="all">{tr(locale, '全部', 'All')}</option>
          {stages.map(s => <option key={s} value={s}>{tr(locale, '阶段', 'Stage')} {s}</option>)}
        </select></label>
        <div className="ail-prereq-legend">
          <span>
            <i className="ail-dot ail-dot-done" />
            {tr(locale, '已完成', 'Completed')}
          </span>
          <span>
            <i className="ail-dot ail-dot-read" />
            {tr(locale, '已读讲义', 'Read')}
          </span>
          <span>
            <i className="ail-dot ail-dot-todo" />
            {tr(locale, '待探索', 'Pending')}
          </span>
        </div>
      </div>

      <div className="ail-prereq-scroll">
        <svg
          className="ail-prereq-svg"
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="group"
          aria-label={tr(locale, '前置依赖关系图', 'Prerequisite DAG')}
        >
          <defs>
            <marker
              id="ail-prereq-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" />
            </marker>
          </defs>

          {edges.map(({ from, to }) => {
            const x1 = from.x + NODE_W
            const y1 = from.y + NODE_H / 2
            const x2 = to.x - 4
            const y2 = to.y + NODE_H / 2
            const midX = (x1 + x2) / 2
            const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
            return (
              <path
                key={`${from.lesson.id}->${to.lesson.id}`}
                d={d}
                className={
                  from.isCompleted
                    ? 'ail-prereq-edge ail-prereq-edge-done'
                    : 'ail-prereq-edge'
                }
                markerEnd="url(#ail-prereq-arrow)"
              />
            )
          })}

          {nodes.map((node) => {
            const active = node.lesson.id === currentLessonId
            const rawTitle = pickText(node.lesson.title, locale)
            const shortTitle =
              rawTitle.length > 14 ? `${rawTitle.slice(0, 13)}…` : rawTitle
            const statusText = node.isFastTracked
              ? tr(locale, '⚡ 快速通关', '⚡ Fast-track')
              : node.isCompleted
                ? tr(locale, '✓ 已完成', '✓ Completed')
                : node.isRead
                  ? tr(locale, '● 已读', '● Read')
                  : tr(locale, '○ 待学', '○ Pending')

            const cls = [
              'ail-prereq-node',
              active ? 'is-active' : '',
              node.isCompleted ? 'is-completed' : node.isRead ? 'is-read' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <g
                key={node.lesson.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={cls}
                role="button"
                tabIndex={0}
                aria-label={`${node.lesson.id} ${rawTitle} (${statusText})`}
                onClick={() => onSelectLesson(node.lesson.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectLesson(node.lesson.id)
                  }
                }}
              >
                <rect width={NODE_W} height={NODE_H} rx={9} ry={9} />
                <text x={10} y={20} className="ail-prereq-id">
                  {node.lesson.id}
                </text>
                <text x={NODE_W - 10} y={20} textAnchor="end" className="ail-prereq-status">
                  {statusText}
                </text>
                <text x={10} y={42} className="ail-prereq-label">
                  {shortTitle}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
