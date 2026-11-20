import { useMemo, useState } from 'react'
import type { GlossaryEntry, Locale } from '../types.ts'
import { pickText, tr } from './i18n.ts'

export interface GlossaryDrawerProps {
  readonly open: boolean
  readonly glossary: readonly GlossaryEntry[]
  readonly locale: Locale
  readonly onClose: () => void
  readonly onSelectLesson: (lessonId: string) => void
}

export function GlossaryDrawer({
  open,
  glossary,
  locale,
  onClose,
  onSelectLesson,
}: GlossaryDrawerProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return glossary
    return glossary.filter((item) => {
      const haystacks = [
        item.term,
        ...(item.aliases ?? []),
        item.title.zh,
        item.title.en,
        item.short.zh,
        item.short.en,
        item.analogy.zh,
        item.analogy.en,
      ]
      return haystacks.some((h) => h.toLowerCase().includes(q))
    })
  }, [glossary, query])

  if (!open) return null

  return (
    <aside
      className="ail-drawer ail-glossary-drawer"
      aria-label={tr(locale, '算力系统术语词典', 'AI Infra Glossary')}
    >
      <div className="ail-drawer-header">
        <div>
          <strong>{tr(locale, '📖 算力与系统术语表', '📖 AI Infra Glossary')}</strong>
          <small>
            {tr(
              locale,
              `共 ${glossary.length} 个核心术语（讲义中悬停下划线词亦可速览）`,
              `${glossary.length} core concepts (hover underlined terms in lessons for quick tips)`,
            )}
          </small>
        </div>
        <button type="button" className="ail-btn ail-btn-sm" onClick={onClose}>
          {tr(locale, '关闭', 'Close')}
        </button>
      </div>

      <div className="ail-drawer-search">
        <input
          type="search"
          value={query}
          placeholder={tr(locale, '搜索术语，如 BF16 / Stride / Roofline…', 'Search BF16, Stride, Roofline…')}
          aria-label={tr(locale, '搜索术语', 'Search glossary')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="ail-drawer-body">
        {filtered.length === 0 ? (
          <p className="ail-muted">
            {tr(locale, '未找到匹配的术语。', 'No matching glossary entries found.')}
          </p>
        ) : (
          filtered.map((entry) => (
            <article key={entry.term} className="ail-glossary-card">
              <div className="ail-glossary-card-head">
                <strong>{pickText(entry.title, locale)}</strong>
                <code className="ail-inline-code">{entry.term}</code>
              </div>
              {entry.aliases && entry.aliases.length > 0 && (
                <div className="ail-glossary-aliases">
                  {tr(locale, '别名：', 'Aliases: ')}
                  {entry.aliases.join(', ')}
                </div>
              )}
              <p className="ail-glossary-short">{pickText(entry.short, locale)}</p>
              <p className="ail-glossary-analogy">
                <strong>{tr(locale, '工程类比：', 'Analogy: ')}</strong>
                {pickText(entry.analogy, locale)}
              </p>
              <div className="ail-glossary-foot">
                <button
                  type="button"
                  className="ail-btn ail-btn-ghost ail-btn-xs"
                  onClick={() => {
                    onSelectLesson(entry.firstLessonId)
                    onClose()
                  }}
                >
                  {tr(locale, `跳转首见单元 ${entry.firstLessonId} →`, `Go to ${entry.firstLessonId} →`)}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  )
}
