// Adapted from deepseek-harness-leetcode. Copyright (c) 2026 kapelame. MIT; see LICENSE.
/**
 * Code editor built from a native textarea over the shared Shiki highlighter.
 * The textarea keeps native selection, IME, undo, and accessibility; the
 * highlighted layer underneath is decorative.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useCodeHighlighter } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CodeLanguage } from './editor-types.ts'
import { complete, type CompletionList } from './completions.ts'

const INDENT = '    '

/** Editor props. */
export interface CodeEditorProps {
  readonly value: string
  readonly language: CodeLanguage
  readonly label: string
  readonly completionLabel: string
  readonly completionHint: string
  readonly readOnly?: boolean
  readonly onChange: (value: string) => void
  readonly onSelection?: (value: string) => void
  /** Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits. */
  readonly onRun?: () => void
  readonly onSubmit?: () => void
}

/**
 * Render the editor.
 * @param props - code, language, and callbacks.
 * @returns the editor.
 */
export function CodeEditor({
  value,
  language,
  label,
  completionLabel,
  completionHint,
  onChange,
  onRun,
  onSubmit,
  onSelection,
  readOnly,
}: CodeEditorProps) {
  const highlight = useCodeHighlighter(
    language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : 'ts',
  )
  const area = useRef<HTMLTextAreaElement>(null)
  const layer = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const [suggestions, setSuggestions] = useState<{
    code: string
    language: CodeLanguage
    top: number
    left: number
    list: CompletionList
  }>()
  const [selected, setSelected] = useState(0)
  const listId = useId()
  const visible =
    suggestions?.code === value && suggestions.language === language ? suggestions.list : undefined
  const activeOption = useRef<HTMLDivElement>(null)
  useEffect(() => {
    activeOption.current?.scrollIntoView?.({ block: 'nearest' })
  }, [selected])
  const lines = value.split('\n')
  const highlighted = highlight(value)

  const replace = (start: number, end: number, text: string, caret: number): void => {
    if (readOnly) return
    const next = value.slice(0, start) + text + value.slice(end)
    const textarea = area.current
    textarea?.setSelectionRange(start, end)
    // Chromium's insertText keeps edits in the native textarea undo history.
    if (textarea === null || !document.execCommand?.('insertText', false, text)) onChange(next)
    setSuggestions(undefined)
    requestAnimationFrame(() => {
      area.current?.setSelectionRange(caret, caret)
    })
  }

  const suggest = (code: string, position: number, explicit = false): void => {
    const list = complete(code, position, language, explicit)
    setSelected(0)
    const input = area.current
    if (!input || !list) {
      setSuggestions(undefined)
      return
    }
    const lines = code.slice(0, position).split('\n')
    const style = getComputedStyle(input)
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) ctx.font = style.font
    const left =
      12 + (ctx?.measureText(lines.at(-1)!.replaceAll('\t', '    ')).width ?? 0) - input.scrollLeft
    const top = 8 + lines.length * parseFloat(style.lineHeight) - input.scrollTop
    setSuggestions({
      code,
      language,
      list,
      left: Math.max(4, Math.min(input.clientWidth - 344, left)),
      top: Math.max(4, Math.min(input.clientHeight - 150, top)),
    })
  }
  const accept = (index: number): void => {
    const item = visible?.items[index]
    if (visible === undefined || item === undefined) return
    replace(visible.from, visible.to, item.insert, visible.from + item.caret)
    area.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (readOnly) return
    const target = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = target
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.code === 'Space' || event.key.toLowerCase() === 'j')
    ) {
      event.preventDefault()
      if (start === end) suggest(value, start, true)
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) onSubmit?.()
      else onRun?.()
      return
    }
    if (
      visible !== undefined &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setSuggestions(undefined)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected(
          (selected + (event.key === 'ArrowDown' ? 1 : visible.items.length - 1)) %
            visible.items.length,
        )
        return
      }
      if ((event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey) {
        event.preventDefault()
        accept(selected)
        return
      }
    }
    if (
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'Escape',
      ].includes(event.key)
    )
      setSuggestions(undefined)
    if (event.key === 'Tab' && !event.altKey) {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      if (event.shiftKey) {
        const removable =
          value.slice(lineStart, lineStart + INDENT.length).match(/^ {1,4}/)?.[0].length ?? 0
        if (removable > 0)
          replace(lineStart, lineStart + removable, '', Math.max(lineStart, start - removable))
        return
      }
      replace(start, end, INDENT, start + INDENT.length)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && start === end) {
      event.preventDefault()
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const current = value.slice(lineStart, start)
      const indent = /^\s*/.exec(current)?.[0] ?? ''
      const opens = language === 'python' ? /:\s*$/.test(current) : /[{([]\s*$/.test(current)
      const insert = `\n${indent}${opens ? INDENT : ''}`
      replace(start, end, insert, start + insert.length)
    }
  }

  const sync = (): void => {
    const textarea = area.current
    if (textarea === null) return
    if (layer.current !== null) {
      layer.current.scrollTop = textarea.scrollTop
      layer.current.scrollLeft = textarea.scrollLeft
    }
    if (gutter.current !== null) gutter.current.scrollTop = textarea.scrollTop
  }

  return (
    <div className={'nl-editor'}>
      <div ref={gutter} className={'nl-gutter'} aria-hidden="true">
        {lines.map((_line, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <div className={'nl-editorArea'}>
        <pre ref={layer} className={'nl-editorLayer'} aria-hidden="true">
          {highlighted === undefined
            ? `${value}\n`
            : highlighted.map((spans, row) => (
                <div key={row}>
                  {spans.length === 0
                    ? '​'
                    : spans.map((span, column) => (
                        <span key={column} style={span.style}>
                          {span.text}
                        </span>
                      ))}
                </div>
              ))}
        </pre>
        <textarea
          ref={area}
          className={'nl-editorInput'}
          value={value}
          readOnly={readOnly}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={visible === undefined ? undefined : listId}
          aria-activedescendant={visible === undefined ? undefined : `${listId}-${selected}`}
          title={completionHint}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          onChange={(event) => {
            const target = event.currentTarget
            onChange(target.value)
            if (!composing.current && target.selectionStart === target.selectionEnd)
              suggest(target.value, target.selectionStart)
            else setSuggestions(undefined)
          }}
          onSelect={(event) => {
            const area = event.currentTarget
            if (area.selectionStart !== area.selectionEnd)
              onSelection?.(area.value.slice(area.selectionStart, area.selectionEnd).slice(0, 3000))
          }}
          onCompositionStart={() => {
            composing.current = true
            setSuggestions(undefined)
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onBlur={() => {
            setSuggestions(undefined)
          }}
          onClick={() => {
            setSuggestions(undefined)
          }}
          onKeyDown={onKeyDown}
          onScroll={() => {
            sync()
            setSuggestions(undefined)
          }}
        />
        {visible !== undefined && (
          <div
            className={'nl-completions'}
            style={{
              top: suggestions?.top,
              left: suggestions?.left,
              bottom: 'auto',
              right: 'auto',
              maxHeight: 145,
            }}
          >
            <div id={listId} role="listbox" aria-label={completionLabel}>
              {visible.items.map((item, index) => (
                <div
                  key={item.label}
                  id={`${listId}-${index}`}
                  ref={index === selected ? activeOption : undefined}
                  role="option"
                  aria-selected={index === selected}
                  className={'nl-completionOption'}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    accept(index)
                  }}
                >
                  <code>{item.label}</code>
                  <span>{item.insert.endsWith('()') ? '()' : ''}</span>
                </div>
              ))}
            </div>
            <div className={'nl-completionHint'}>{completionHint}</div>
          </div>
        )}
      </div>
    </div>
  )
}
