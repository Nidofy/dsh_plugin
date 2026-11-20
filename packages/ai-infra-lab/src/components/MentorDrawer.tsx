import { useState } from 'react'
import type {
  GlossaryEntry,
  HelpLevel,
  Locale,
  RunRecord,
  Workspace,
} from '../types.ts'
import { MarkdownView } from './MarkdownView.tsx'
import { tr } from './i18n.ts'

export interface MentorDrawerProps {
  readonly open: boolean
  readonly locale: Locale
  readonly workspace?: Workspace
  readonly activeRun?: RunRecord
  readonly selectedCode: string
  readonly mentorBusy: boolean
  readonly glossary: readonly GlossaryEntry[]
  readonly onToggle: () => void
  readonly onClearSelection: () => void
  readonly onAsk: (question: string, mode: HelpLevel, runId?: string, focusStep?: string) => Promise<void>
  readonly onJumpLesson: (lessonId: string) => void
}

export function MentorDrawer({
  open,
  locale,
  workspace,
  activeRun,
  selectedCode,
  mentorBusy,
  glossary,
  onToggle,
  onClearSelection,
  onAsk,
  onJumpLesson,
}: MentorDrawerProps) {
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<HelpLevel>('concept')
  const [attachRun, setAttachRun] = useState(true)
  const [focus, setFocus] = useState({ runId:'', step:'' })
  const current = activeRun?.exerciseId === workspace?.exercise.id ? activeRun : undefined
  const failures = current?.events.filter(e => e.type==='check' && e.passed===false)
    .map(e=>e.step ?? e.name).filter(name=>workspace?.exercise.steps?.some(s=>s.name===name)) ?? []
  const focusStep = focus.runId === current?.id && failures.includes(focus.step) ? focus.step : ''

  if (!open) {
    return (
      <aside className="ail-mentor-collapsed">
        <button
          type="button"
          className="ail-mentor-rail-btn"
          onClick={onToggle}
          title={tr(locale, '展开 AI 导师问答栏', 'Expand AI Mentor Drawer')}
        >
          <span>🤖</span>
          <span className="ail-mentor-rail-text">
            {tr(locale, 'AI 导师', 'Mentor')}
          </span>
        </button>
      </aside>
    )
  }

  const submitQuestion = async (overrideText?: string) => {
    const baseText = (overrideText ?? question).trim()
    if (!baseText || !workspace || mentorBusy) return
    const composed = selectedCode
      ? `${baseText}\n\n\`\`\`python\n${selectedCode}\n\`\`\``
      : baseText
    setQuestion('')
    await onAsk(composed, mode, attachRun ? current?.id : undefined, attachRun && focusStep ? focusStep : undefined)
  }

  const quickPrompts = [
    tr(
      locale,
      '不直接给代码，帮我建立这道题的物理与硬件直觉',
      'Give me the hardware intuition without spoiling code',
    ),
    tr(
      locale,
      '为什么这里的吞吐受限于访存带宽而不是峰值算力？',
      'Why is throughput memory-bound rather than compute-bound here?',
    ),
    tr(
      locale,
      '帮我检查一下字节数与单位换算的易错点',
      'Help me verify byte widths and unit conversion pitfalls',
    ),
  ]

  return (
    <aside
      className="ail-mentor-drawer"
      aria-label={tr(locale, 'AI 算力导师问答栏', 'AI Infra Mentor Drawer')}
    >
      <div className="ail-drawer-header">
        <div>
          <strong>{tr(locale, '🤖 AI 系统导师', '🤖 AI Systems Mentor')}</strong>
          <small>
            {workspace
              ? `${workspace.exercise.id} · ${tr(locale, '苏格拉底式启发引导', 'Socratic Guidance')}`
              : tr(locale, '选择任意练习后可针对性提问', 'Select an exercise to ask context-aware questions')}
          </small>
        </div>
        <button type="button" className="ail-btn ail-btn-xs" onClick={onToggle}>
          {tr(locale, '收起 ›', 'Collapse ›')}
        </button>
      </div>

      <div className="ail-mentor-controls">
        <label>
          <span>{tr(locale, '回答尺度控制：', 'Guidance Level:')}</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as HelpLevel)}
          >
            <option value="concept">
              {tr(locale, '仅概念启发 (concept)', 'Concept Intuition Only')}
            </option>
            <option value="steps">
              {tr(locale, '推导步骤引导 (steps)', 'Step-by-step Guidance')}
            </option>
            <option value="formula">
              {tr(locale, '核对公式与边界', 'Check formulas and edge cases')}
            </option>
            <option value="code">
              {tr(locale, '允许代码级诊断 (code)', 'Code-level Diagnostics')}
            </option>
          </select>
        </label>

        {current && (
          <label className="ail-checkbox-row">
            <input
              type="checkbox"
              checked={attachRun}
              onChange={(e) => setAttachRun(e.target.checked)}
            />
            <span>
              {tr(
                locale,
                `附带所选运行 (${current.run_status})`,
                `Attach selected run (${current.run_status})`,
              )}
            </span>
          </label>
        )}
      </div>

      {attachRun && current && failures.length > 0 && <label className="ail-focus-step">
        {tr(locale,'聚焦失败步骤','Focus on a failed step')}
        <select value={focusStep} onChange={e=>setFocus({ runId:current.id, step:e.target.value })}>
          <option value="">{tr(locale,'整次运行','Whole run')}</option>
          {[...new Set(failures)].map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>}
      <div className="ail-mentor-messages">
        {!workspace || workspace.messages.length === 0 ? (
          <div className="ail-mentor-empty">
            <p>
              {tr(
                locale,
                '遇到量纲困惑、步长切片迷思或实测数据反直觉？点击下方快捷提问或输入你的思考：',
                'Curious about a roofline bottleneck, tensor stride, or unexpected timing? Ask below:',
              )}
            </p>
            <div className="ail-mentor-chips">
              {quickPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="ail-btn ail-btn-xs"
                  disabled={!workspace || mentorBusy}
                  onClick={() => void submitQuestion(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          workspace.messages.map((msg, idx) => (
            <div
              key={`${msg.at}-${idx}`}
              className={`ail-msg ail-msg-${msg.role}`}
            >
              <div className="ail-msg-meta">
                <strong>
                  {msg.role === 'user'
                    ? tr(locale, '你', 'You')
                    : tr(locale, 'AI 导师', 'Mentor')}
                </strong>
                <small>{msg.at.slice(11, 16)}</small>
              </div>
              <div className="ail-msg-content">
                <MarkdownView
                  markdown={msg.text}
                  locale={locale}
                  glossary={glossary}
                  onJumpLesson={onJumpLesson}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {selectedCode && (
        <div className="ail-mentor-selection">
          <div className="ail-mentor-selection-top">
            <small>
              {tr(locale, '已附带编辑器选中代码片段', 'Attached selected code snippet')}
            </small>
            <button
              type="button"
              className="ail-btn ail-btn-ghost ail-btn-xs"
              onClick={onClearSelection}
            >
              ×
            </button>
          </div>
          <code>{selectedCode.slice(0, 140)}</code>
        </div>
      )}

      <div className="ail-mentor-composer">
        <textarea
          rows={3}
          value={question}
          disabled={!workspace || mentorBusy}
          placeholder={tr(
            locale,
            '输入你的问题与当前猜想（Ctrl+Enter 发送）…',
            'Ask a question and share your hypothesis (Ctrl+Enter to send)…',
          )}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void submitQuestion()
            }
          }}
        />
        <button
          type="button"
          className="ail-btn ail-btn-primary"
          disabled={!workspace || mentorBusy || !question.trim()}
          onClick={() => void submitQuestion()}
        >
          {mentorBusy
            ? tr(locale, '导师思考中…', 'Thinking…')
            : tr(locale, '发送提问', 'Ask Mentor')}
        </button>
      </div>
    </aside>
  )
}
