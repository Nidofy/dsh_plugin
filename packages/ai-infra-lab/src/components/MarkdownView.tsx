import { useId, useMemo, useState, type ReactNode } from 'react'
import type { GlossaryEntry, Locale } from '../types.ts'
import { pickText, tr } from './i18n.ts'

export interface MarkdownViewProps {
  readonly markdown: string
  readonly locale: Locale
  readonly glossary?: readonly GlossaryEntry[]
  readonly onJumpLesson?: (lessonId: string) => void
}

interface TermMatcher {
  readonly needle: string
  readonly lowerNeedle: string
  readonly asciiBoundary: boolean
  readonly entry: GlossaryEntry
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false
  return /[A-Za-z0-9_]/.test(ch)
}

function buildTermMatchers(glossary: readonly GlossaryEntry[] | undefined): TermMatcher[] {
  if (!glossary || glossary.length === 0) return []
  const seen = new Set<string>()
  const list: TermMatcher[] = []

  for (const entry of glossary) {
    const candidates = [
      entry.term,
      ...(entry.aliases ?? []),
      entry.title.zh,
      entry.title.en,
    ]
    for (const raw of candidates) {
      const needle = raw.trim()
      if (needle.length < 2) continue
      const lowerNeedle = needle.toLowerCase()
      if (seen.has(lowerNeedle)) continue
      seen.add(lowerNeedle)
      const asciiBoundary = /^[A-Za-z0-9_.-]+$/.test(needle)
      list.push({ needle, lowerNeedle, asciiBoundary, entry })
    }
  }

  list.sort((a, b) => b.needle.length - a.needle.length)
  return list
}

function GlossaryInlineTerm({
  text,
  entry,
  locale,
  onJumpLesson,
}: {
  readonly text: string
  readonly entry: GlossaryEntry
  readonly locale: Locale
  readonly onJumpLesson?: (lessonId: string) => void
}) {
  const tipId = useId()
  return (
    <span className="ail-term-wrap">
      <span
        role="button"
        tabIndex={0}
        aria-describedby={tipId}
        className="ail-term-trigger"
        onClick={(e) => {
          e.stopPropagation()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onJumpLesson) {
            e.preventDefault()
            onJumpLesson(entry.firstLessonId)
          }
        }}
      >
        {text}
      </span>
      <span id={tipId} role="tooltip" className="ail-term-popover">
        <span className="ail-term-popover-head">
          <strong className="ail-term-popover-title">{pickText(entry.title, locale)}</strong>
          <span className="ail-term-popover-code">{entry.term}</span>
        </span>
        <span className="ail-term-popover-short">{pickText(entry.short, locale)}</span>
        <span className="ail-term-popover-analogy">
          <span className="ail-term-popover-label">{tr(locale, '直觉类比：', 'Analogy: ')}</span>
          {pickText(entry.analogy, locale)}
        </span>
        {onJumpLesson && (
          <span
            role="button"
            tabIndex={0}
            className="ail-term-popover-link"
            onClick={(e) => {
              e.stopPropagation()
              onJumpLesson(entry.firstLessonId)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onJumpLesson(entry.firstLessonId)
              }
            }}
          >
            {tr(locale, `首见于 ${entry.firstLessonId} →`, `Introduced in ${entry.firstLessonId} →`)}
          </span>
        )}
      </span>
    </span>
  )
}

function renderPlainWithGlossary(
  text: string,
  matchers: readonly TermMatcher[],
  locale: Locale,
  usedTermsInBlock: Set<string>,
  onJumpLesson?: (lessonId: string) => void,
  keyPrefix = 't',
): ReactNode[] {
  if (!text || matchers.length === 0) return [text]

  const lower = text.toLowerCase()
  const out: ReactNode[] = []
  let cursor = 0
  let tokenIdx = 0

  while (cursor < text.length) {
    let bestPos = -1
    let bestMatcher: TermMatcher | undefined = undefined

    for (const m of matchers) {
      if (usedTermsInBlock.has(m.entry.term)) continue
      let searchFrom = cursor
      while (searchFrom < text.length) {
        const idx = lower.indexOf(m.lowerNeedle, searchFrom)
        if (idx === -1) break
        const endIdx = idx + m.needle.length
        const validBoundary =
          !m.asciiBoundary || (!isWordChar(text[idx - 1]) && !isWordChar(text[endIdx]))
        if (validBoundary) {
          if (
            bestPos === -1 ||
            idx < bestPos ||
            (idx === bestPos && bestMatcher && m.needle.length > bestMatcher.needle.length)
          ) {
            bestPos = idx
            bestMatcher = m
          }
          break
        }
        searchFrom = idx + 1
      }
    }

    if (bestPos === -1 || !bestMatcher) {
      out.push(text.slice(cursor))
      break
    }

    if (bestPos > cursor) {
      out.push(text.slice(cursor, bestPos))
    }

    const matchedSlice = text.slice(bestPos, bestPos + bestMatcher.needle.length)
    usedTermsInBlock.add(bestMatcher.entry.term)
    out.push(
      <GlossaryInlineTerm
        key={`${keyPrefix}-${tokenIdx++}`}
        text={matchedSlice}
        entry={bestMatcher.entry}
        locale={locale}
        onJumpLesson={onJumpLesson}
      />,
    )
    cursor = bestPos + bestMatcher.needle.length
  }

  return out
}

function renderEmphasisAndGlossary(
  segment: string,
  matchers: readonly TermMatcher[],
  locale: Locale,
  usedTermsInBlock: Set<string>,
  onJumpLesson?: (lessonId: string) => void,
  keyPrefix = 'e',
): ReactNode[] {
  // Match **bold** or *italic* via pure React inline elements
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g
  const parts = segment.split(pattern)
  const nodes: ReactNode[] = []

  parts.forEach((part, idx) => {
    if (!part) return
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2)
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx}`}>
          {renderPlainWithGlossary(
            inner,
            matchers,
            locale,
            usedTermsInBlock,
            onJumpLesson,
            `${keyPrefix}-bi-${idx}`,
          )}
        </strong>,
      )
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      const inner = part.slice(1, -1)
      nodes.push(
        <em key={`${keyPrefix}-i-${idx}`}>
          {renderPlainWithGlossary(
            inner,
            matchers,
            locale,
            usedTermsInBlock,
            onJumpLesson,
            `${keyPrefix}-ii-${idx}`,
          )}
        </em>,
      )
    } else {
      nodes.push(
        ...renderPlainWithGlossary(
          part,
          matchers,
          locale,
          usedTermsInBlock,
          onJumpLesson,
          `${keyPrefix}-p-${idx}`,
        ),
      )
    }
  })

  return nodes
}

function renderInline(
  text: string,
  matchers: readonly TermMatcher[],
  locale: Locale,
  onJumpLesson?: (lessonId: string) => void,
  keyPrefix = 'in',
): ReactNode[] {
  const usedTermsInBlock = new Set<string>()
  const codePattern = /(`[^`\n]+`)/g
  const segments = text.split(codePattern)
  const result: ReactNode[] = []

  segments.forEach((seg, idx) => {
    if (!seg) return
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      result.push(
        <code key={`${keyPrefix}-c-${idx}`} className="ail-inline-code">
          {seg.slice(1, -1)}
        </code>,
      )
    } else {
      result.push(
        ...renderEmphasisAndGlossary(
          seg,
          matchers,
          locale,
          usedTermsInBlock,
          onJumpLesson,
          `${keyPrefix}-s-${idx}`,
        ),
      )
    }
  })

  return result
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const core = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const withoutTrailing = core.endsWith('|') ? core.slice(0, -1) : core
  return withoutTrailing.split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string | undefined): boolean {
  if (!line) return false
  const trimmed = line.trim()
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false
  const cells = splitTableRow(trimmed)
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))
}

function CodeFenceBlock({
  lang,
  code,
  locale,
}: {
  readonly lang: string
  readonly code: string
  readonly locale: Locale
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard error
    }
  }
  return (
    <div className="ail-md-codeblock">
      <div className="ail-md-codehead">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          className="ail-btn ail-btn-ghost ail-btn-xs"
          onClick={() => void handleCopy()}
        >
          {copied ? tr(locale, '已复制', 'Copied') : tr(locale, '复制', 'Copy')}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MarkdownView({
  markdown,
  locale,
  glossary,
  onJumpLesson,
}: MarkdownViewProps) {
  const matchers = useMemo(() => buildTermMatchers(glossary), [glossary])

  const blocks = useMemo(() => {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')
    const rendered: ReactNode[] = []
    let i = 0
    let blockKey = 0

    while (i < lines.length) {
      const line = lines[i] ?? ''
      const trimmed = line.trim()

      if (trimmed === '') {
        i += 1
        continue
      }

      // Code fence ```
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim()
        const codeLines: string[] = []
        i += 1
        while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
          codeLines.push(lines[i] ?? '')
          i += 1
        }
        if (i < lines.length) i += 1
        rendered.push(
          <CodeFenceBlock
            key={`b-${blockKey++}`}
            lang={lang}
            code={codeLines.join('\n')}
            locale={locale}
          />,
        )
        continue
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        rendered.push(<hr key={`b-${blockKey++}`} className="ail-md-hr" />)
        i += 1
        continue
      }

      // Headings #, ##, ###, ####
      const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
      if (headingMatch) {
        const level = headingMatch[1]!.length
        const content = renderInline(
          headingMatch[2]!,
          matchers,
          locale,
          onJumpLesson,
          `h-${blockKey}`,
        )
        if (level === 1) rendered.push(<h1 key={`b-${blockKey++}`}>{content}</h1>)
        else if (level === 2) rendered.push(<h2 key={`b-${blockKey++}`}>{content}</h2>)
        else if (level === 3) rendered.push(<h3 key={`b-${blockKey++}`}>{content}</h3>)
        else rendered.push(<h4 key={`b-${blockKey++}`}>{content}</h4>)
        i += 1
        continue
      }

      // GFM Table
      if (trimmed.includes('|') && isTableSeparator(lines[i + 1])) {
        const headers = splitTableRow(trimmed)
        i += 2
        const rows: string[][] = []
        while (i < lines.length) {
          const rowLine = (lines[i] ?? '').trim()
          if (!rowLine || !rowLine.includes('|')) break
          rows.push(splitTableRow(rowLine))
          i += 1
        }
        const currentKey = blockKey++
        rendered.push(
          <div key={`b-${currentKey}`} className="ail-md-table-wrap">
            <table className="ail-md-table">
              <thead>
                <tr>
                  {headers.map((h, colIdx) => (
                    <th key={colIdx}>
                      {renderInline(h, matchers, locale, onJumpLesson, `th-${currentKey}-${colIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {headers.map((_h, colIdx) => (
                      <td key={colIdx}>
                        {renderInline(
                          row[colIdx] ?? '',
                          matchers,
                          locale,
                          onJumpLesson,
                          `td-${currentKey}-${rowIdx}-${colIdx}`,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        )
        continue
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = []
        while (i < lines.length && (lines[i] ?? '').trim().startsWith('>')) {
          quoteLines.push((lines[i] ?? '').trim().replace(/^>\s?/, ''))
          i += 1
        }
        const currentKey = blockKey++
        rendered.push(
          <blockquote key={`b-${currentKey}`} className="ail-md-quote">
            {renderInline(
              quoteLines.join(' '),
              matchers,
              locale,
              onJumpLesson,
              `q-${currentKey}`,
            )}
          </blockquote>,
        )
        continue
      }

      // Unordered list
      if (/^[-*+]\s+/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^[-*+]\s+/.test((lines[i] ?? '').trim())) {
          items.push((lines[i] ?? '').trim().replace(/^[-*+]\s+/, ''))
          i += 1
        }
        const currentKey = blockKey++
        rendered.push(
          <ul key={`b-${currentKey}`} className="ail-md-list">
            {items.map((item, idx) => (
              <li key={idx}>
                {renderInline(item, matchers, locale, onJumpLesson, `ul-${currentKey}-${idx}`)}
              </li>
            ))}
          </ul>,
        )
        continue
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        const items: string[] = []
        while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
          items.push((lines[i] ?? '').trim().replace(/^\d+\.\s+/, ''))
          i += 1
        }
        const currentKey = blockKey++
        rendered.push(
          <ol key={`b-${currentKey}`} className="ail-md-list">
            {items.map((item, idx) => (
              <li key={idx}>
                {renderInline(item, matchers, locale, onJumpLesson, `ol-${currentKey}-${idx}`)}
              </li>
            ))}
          </ol>,
        )
        continue
      }

      // Paragraph
      const paraLines: string[] = []
      while (i < lines.length) {
        const cur = (lines[i] ?? '').trim()
        if (
          cur === '' ||
          cur.startsWith('```') ||
          cur.startsWith('#') ||
          cur.startsWith('>') ||
          /^(-{3,}|\*{3,})$/.test(cur) ||
          /^[-*+]\s+/.test(cur) ||
          /^\d+\.\s+/.test(cur) ||
          (cur.includes('|') && isTableSeparator(lines[i + 1]))
        ) {
          break
        }
        paraLines.push(cur)
        i += 1
      }
      const currentKey = blockKey++
      rendered.push(
        <p key={`b-${currentKey}`} className="ail-md-p">
          {renderInline(
            paraLines.join(' '),
            matchers,
            locale,
            onJumpLesson,
            `p-${currentKey}`,
          )}
        </p>,
      )
    }

    return rendered
  }, [markdown, matchers, locale, onJumpLesson])

  return <div className="ail-markdown">{blocks}</div>
}
