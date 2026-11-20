import { useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'

const INDENT = '    '

const PY_KEYWORDS = new Set([
  'def',
  'return',
  'if',
  'elif',
  'else',
  'for',
  'while',
  'in',
  'not',
  'and',
  'or',
  'import',
  'from',
  'as',
  'class',
  'with',
  'try',
  'except',
  'finally',
  'raise',
  'assert',
  'pass',
  'break',
  'continue',
  'lambda',
  'yield',
  'True',
  'False',
  'None',
])

const PY_BUILTINS = new Set([
  'len',
  'range',
  'sum',
  'min',
  'max',
  'abs',
  'int',
  'float',
  'str',
  'list',
  'dict',
  'tuple',
  'set',
  'enumerate',
  'zip',
  'print',
  'isinstance',
  'np',
  'numpy',
  'torch',
  'math',
  'time',
])

function highlightLine(line: string): ReactNode[] {
  if (line.length === 0) return ['\u200b']
  const tokens: ReactNode[] = []
  const pattern =
    /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gi
  let lastIdx = 0
  let keyIdx = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(line.slice(lastIdx, match.index))
    }
    const text = match[0]
    if (text.startsWith('#')) {
      tokens.push(
        <span key={keyIdx++} className="ail-tok-comment">
          {text}
        </span>,
      )
    } else if (text.startsWith('"') || text.startsWith("'")) {
      tokens.push(
        <span key={keyIdx++} className="ail-tok-string">
          {text}
        </span>,
      )
    } else if (/^\d/.test(text)) {
      tokens.push(
        <span key={keyIdx++} className="ail-tok-number">
          {text}
        </span>,
      )
    } else if (PY_KEYWORDS.has(text)) {
      tokens.push(
        <span key={keyIdx++} className="ail-tok-keyword">
          {text}
        </span>,
      )
    } else if (PY_BUILTINS.has(text)) {
      tokens.push(
        <span key={keyIdx++} className="ail-tok-builtin">
          {text}
        </span>,
      )
    } else {
      tokens.push(text)
    }
    lastIdx = match.index + text.length
  }

  if (lastIdx < line.length) {
    tokens.push(line.slice(lastIdx))
  }
  return tokens
}

export interface CodeEditorProps {
  readonly value: string
  readonly label: string
  readonly readOnly?: boolean
  readonly onChange: (next: string) => void
  readonly onRun?: () => void
  readonly onSelection?: (selected: string) => void
}

export function CodeEditor({
  value,
  label,
  readOnly = false,
  onChange,
  onRun,
  onSelection,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const composingRef = useRef(false)

  const lines = useMemo(() => value.split('\n'), [value])
  const highlightedRows = useMemo(
    () => lines.map((line) => highlightLine(line)),
    [lines],
  )

  const replaceRange = (start: number, end: number, insert: string, caret: number) => {
    if (readOnly) return
    const next = value.slice(0, start) + insert + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(caret, caret)
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onRun?.()
      return
    }

    const target = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = target

    if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      if (event.shiftKey) {
        const leading = value.slice(lineStart, lineStart + INDENT.length)
        const removable = /^ {1,4}/.exec(leading)?.[0].length ?? 0
        if (removable > 0) {
          replaceRange(
            lineStart,
            lineStart + removable,
            '',
            Math.max(lineStart, start - removable),
          )
        }
        return
      }
      replaceRange(start, end, INDENT, start + INDENT.length)
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && start === end) {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const currentLine = value.slice(lineStart, start)
      const indent = /^\s*/.exec(currentLine)?.[0] ?? ''
      const extraIndent = /:\s*(?:#.*)?$/.test(currentLine) ? INDENT : ''
      const insert = `\n${indent}${extraIndent}`
      replaceRange(start, end, insert, start + insert.length)
    }
  }

  const syncScroll = () => {
    const area = textareaRef.current
    if (!area) return
    if (preRef.current) {
      preRef.current.scrollTop = area.scrollTop
      preRef.current.scrollLeft = area.scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = area.scrollTop
    }
  }

  return (
    <div className="ail-editor">
      <div ref={gutterRef} className="ail-editor-gutter" aria-hidden="true">
        {lines.map((_line, idx) => (
          <div key={idx}>{idx + 1}</div>
        ))}
      </div>
      <div className="ail-editor-stage">
        <pre ref={preRef} className="ail-editor-highlight" aria-hidden="true">
          {highlightedRows.map((rowTokens, rowIdx) => (
            <div key={rowIdx} className="ail-editor-line">
              {rowTokens}
            </div>
          ))}
        </pre>
        <textarea
          ref={textareaRef}
          className="ail-editor-input"
          value={value}
          readOnly={readOnly}
          aria-label={label}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          onChange={(e) => onChange(e.currentTarget.value)}
          onSelect={(e) => {
            const el = e.currentTarget
            if (el.selectionStart !== el.selectionEnd) {
              onSelection?.(el.value.slice(el.selectionStart, el.selectionEnd).slice(0, 2000))
            }
          }}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
        />
      </div>
    </div>
  )
}
