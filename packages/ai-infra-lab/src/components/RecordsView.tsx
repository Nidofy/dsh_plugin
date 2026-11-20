import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { Locale, Overview } from '../types.ts'
import { DataSourceBadge } from './DataSourceBadge.tsx'
import { pickText, tr } from './i18n.ts'

export interface RecordsViewProps {
  readonly overview: Overview
  readonly locale: Locale
  readonly busy: boolean
  readonly onOpenReviewExercise: (lessonId: string, exerciseId: string) => void
  readonly onDismissReview: (exerciseId: string) => void
  readonly onSaveProfile: (profile: Record<string, string>, revision: number) => Promise<void>
  readonly onExportData: () => Promise<string>
  readonly onImportData: (
    rawJson: string,
  ) => Promise<{ importedRuns: number; importedEvidence: number }>
}

export function RecordsView({
  overview,
  locale,
  busy,
  onOpenReviewExercise,
  onDismissReview,
  onSaveProfile,
  onExportData,
  onImportData,
}: RecordsViewProps) {
  const [background, setBackground] = useState(overview.profile.background ?? '')
  const [goal, setGoal] = useState(overview.profile.goal ?? '')
  const [notes, setNotes] = useState(overview.profile.notes ?? '')
  const [profileFeedback, setProfileFeedback] = useState('')

  const [exportedJson, setExportedJson] = useState('')
  const [importText, setImportText] = useState('')
  const [ioMessage, setIoMessage] = useState('')

  useEffect(() => {
    setBackground(overview.profile.background ?? '')
    setGoal(overview.profile.goal ?? '')
    setNotes(overview.profile.notes ?? '')
  }, [overview.profileRevision, overview.profileId])

  const stats = useMemo(() => {
    const uniqueConcepts = new Set(overview.evidence.map((e) => e.concept))
    const independentCount = overview.evidence.filter(
      (e) => e.help === 'none' || e.help === 'unknown',
    ).length
    return {
      total: overview.evidence.length,
      concepts: uniqueConcepts.size,
      independent: independentCount,
    }
  }, [overview.evidence])

  const handleSaveProfile = async () => {
    setProfileFeedback('')
    const cleanProfile: Record<string, string> = {
      background: background.trim(),
      goal: goal.trim(),
      notes: notes.trim(),
    }
    await onSaveProfile(cleanProfile, overview.profileRevision)
    setProfileFeedback(tr(locale, '✓ 学习档案已保存', '✓ Learner profile saved'))
  }

  const handleExport = async () => {
    setIoMessage('')
    const json = await onExportData()
    setExportedJson(json)
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      anchor.href = url
      anchor.download = `ai-infra-lab-backup-${stamp}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setIoMessage(
        tr(
          locale,
          '✓ 已生成导出 JSON 并触发文件下载',
          '✓ Exported JSON and triggered file download',
        ),
      )
    } catch {
      setIoMessage(
        tr(
          locale,
          '✓ 已生成导出 JSON，可在下方文本框复制保存',
          '✓ Exported JSON generated below; copy to save',
        ),
      )
    }
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    if (file.size > 4_000_000) {
      setIoMessage({zh:'文件超过 4 MB，无法导入。',en:'The file exceeds the 4 MB import limit.'}[locale])
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!importText.trim()) return
    setIoMessage('')
    const res = await onImportData(importText)
    setImportText('')
    setIoMessage(
      tr(
        locale,
        `✓ 导入完成：恢复运行记录 ${res.importedRuns} 条、掌握证据 ${res.importedEvidence} 条`,
        `✓ Import complete: ${res.importedRuns} runs and ${res.importedEvidence} evidence items restored`,
      ),
    )
  }

  return (
    <div className="ail-records-stack">
      {/* Summary KPIs */}
      <div className="ail-kpi-grid">
        <div className="ail-kpi-card">
          <small>{tr(locale, '已读讲义单元', 'Lessons Read')}</small>
          <strong>
            {overview.readLessons.length} / {overview.catalog.lessons.length}
          </strong>
        </div>
        <div className="ail-kpi-card">
          <small>{tr(locale, '累计掌握证据', 'Mastery Evidence')}</small>
          <strong>{stats.total}</strong>
        </div>
        <div className="ail-kpi-card">
          <small>{tr(locale, '无提示独立证据', 'Unassisted Evidence')}</small>
          <strong>{stats.independent}</strong>
        </div>
        <div className="ail-kpi-card">
          <small>{tr(locale, '覆盖核心概念', 'Covered Concepts')}</small>
          <strong>{stats.concepts}</strong>
        </div>
      </div>

      {/* 1. In-App Review Queue */}
      <section className="ail-card">
        <div className="ail-section-head">
          <h3>
            {tr(
              locale,
              `🔔 站内间隔复习队列 (${overview.reviews.length})`,
              `🔔 Spaced Review Queue (${overview.reviews.length})`,
            )}
          </h3>
          <small>
            {tr(
              locale,
              '曾在高阶提示辅助下完成或出现过典型误区的练习会自动加入站内复习提醒。',
              'Exercises completed with heavy hints or prior misconceptions appear here for reinforcement.',
            )}
          </small>
        </div>

        {overview.reviews.length === 0 ? (
          <p className="ail-muted">
            {tr(locale, '当前没有待复习项目，保持得很好！', 'No pending review items right now.')}
          </p>
        ) : (
          <div className="ail-review-list">
            {overview.reviews.map((item) => (
              <div key={`${item.lessonId}-${item.exerciseId}`} className="ail-review-item">
                <div className="ail-review-main">
                  <div className="ail-review-tags">
                    <span className="ail-pill">{item.lessonId}</span>
                    <code>{item.exerciseId}</code>
                    <small className="ail-muted">
                      {tr(locale, '提醒时间：', 'Due: ')}
                      {item.due.slice(0, 10)}
                    </small>
                  </div>
                  <p>{pickText(item.reason, locale)}</p>
                </div>
                <div className="ail-review-actions">
                  <button
                    type="button"
                    className="ail-btn ail-btn-primary ail-btn-sm"
                    onClick={() => onOpenReviewExercise(item.lessonId, item.exerciseId)}
                  >
                    {tr(locale, '前往巩固', 'Practice Now')}
                  </button>
                  <button
                    type="button"
                    className="ail-btn ail-btn-sm"
                    disabled={busy}
                    onClick={() => onDismissReview(item.exerciseId)}
                  >
                    {tr(locale, '标记已知晓', 'Dismiss')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Mastery Evidence Ledger */}
      <section className="ail-card">
        <div className="ail-section-head">
          <h3>{tr(locale, '🏅 掌握证据总表 (Mastery Evidence)', '🏅 Mastery Evidence Ledger')}</h3>
          <small>
            {tr(
              locale,
              '严格区分公式估算、架构模拟与真实 CPU 测量，并记录每次完成时的提示依赖等级。',
              'Tracks concept mastery alongside data source provenance and hint assistance level.',
            )}
          </small>
        </div>

        {overview.evidence.length === 0 ? (
          <p className="ail-muted">
            {tr(
              locale,
              '尚无掌握证据记录。完成讲义阅读、小测、估算、模拟或代码实验后会自动生成。',
              'No mastery evidence recorded yet. Complete lessons and activities to populate this ledger.',
            )}
          </p>
        ) : (
          <div className="ail-md-table-wrap">
            <table className="ail-md-table">
              <thead>
                <tr>
                  <th>{tr(locale, '时间', 'Time')}</th>
                  <th>{tr(locale, '练习 / 单元', 'Item')}</th>
                  <th>{tr(locale, '核心概念', 'Concept')}</th>
                  <th>{tr(locale, '证据类型', 'Kind')}</th>
                  <th>{tr(locale, '数据来源', 'Data Source')}</th>
                  <th>{tr(locale, '辅助等级', 'Help Level')}</th>
                  <th>{tr(locale, '结论', 'Result')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.evidence.slice(0, 80).map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.at.slice(0, 16).replace('T', ' ')}</td>
                    <td>
                      <code>{ev.exerciseId}</code>
                    </td>
                    <td>
                      <code className="ail-inline-code">{ev.concept}</code>
                    </td>
                    <td>{ev.kind}</td>
                    <td>
                      {ev.dataSource ? (
                        <DataSourceBadge kind={ev.dataSource} locale={locale} />
                      ) : (
                        <span className="ail-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          ev.help === 'none'
                            ? 'ail-pill ail-pill-ok'
                            : 'ail-pill'
                        }
                      >
                        {ev.help}
                      </span>
                    </td>
                    <td>{ev.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Learner Profile Notes */}
      <section className="ail-card">
        <div className="ail-section-head">
          <h3>{tr(locale, '🧭 学习背景与关注方向备注', '🧭 Learner Background & Focus Notes')}</h3>
          <small>
            {tr(
              locale,
              `修订号 rev ${overview.profileRevision} · AI 导师会结合你的背景调整类比深度`,
              `Revision ${overview.profileRevision} · Helps tailor AI Mentor explanations`,
            )}
          </small>
        </div>

        <div className="ail-profile-grid">
          <label>
            <span>{tr(locale, '熟悉语言与工程背景', 'Programming & Systems Background')}</span>
            <input
              type="text"
              value={background}
              placeholder={tr(
                locale,
                '如：熟悉 Python / PyTorch，较少接触底层体系结构与 C++…',
                'e.g. Familiar with Python/PyTorch, new to CPU/GPU memory hierarchy…',
              )}
              onChange={(e) => setBackground(e.target.value)}
            />
          </label>
          <label>
            <span>{tr(locale, '主要学习目标', 'Primary Learning Goal')}</span>
            <input
              type="text"
              value={goal}
              placeholder={tr(
                locale,
                '如：掌握大模型推理显存算账、Roofline 瓶颈定位与分布式通信基础',
                'e.g. Master LLM capacity math, Roofline profiling, and distributed basics',
              )}
              onChange={(e) => setGoal(e.target.value)}
            />
          </label>
          <label className="ail-profile-wide">
            <span>{tr(locale, '本机硬件与个人备忘', 'Local Machine & Personal Notes')}</span>
            <textarea
              rows={2}
              value={notes}
              placeholder={tr(
                locale,
                '记录本机 CPU 型号、内存通道或阶段性学习总结…',
                'Record host CPU model, memory specs, or study milestones…',
              )}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="ail-action-bar">
          <button
            type="button"
            className="ail-btn ail-btn-primary"
            disabled={busy}
            onClick={() => void handleSaveProfile()}
          >
            {tr(locale, '保存学习背景备注', 'Save Profile Notes')}
          </button>
          {profileFeedback && <span className="ail-save-indicator">{profileFeedback}</span>}
        </div>
      </section>

      {/* 4. Portable JSON Export & Import */}
      <section className="ail-card">
        <div className="ail-section-head">
          <h3>{tr(locale, '📦 学习进度导出与导入 (JSON)', '📦 Export & Import Study Data (JSON)')}</h3>
          <small>
            {tr(
              locale,
              '支持将实验运行记录、掌握证据与进度导出为离线 JSON 备份，或在另一台设备导入合并。',
              'Export runs, evidence, and progress as portable JSON or import from a backup.',
            )}
          </small>
        </div>

        <div className="ail-action-bar">
          <button
            type="button"
            className="ail-btn"
            disabled={busy}
            onClick={() => void handleExport()}
          >
            {tr(locale, '⬇ 导出学习数据 JSON', '⬇ Export JSON Backup')}
          </button>

          <label className="ail-file-btn ail-btn">
            {tr(locale, '📂 选择 JSON 文件读取', '📂 Load JSON File')}
            <input type="file" accept=".json,application/json" onChange={handleFileUpload} />
          </label>
        </div>

        {exportedJson && (
          <label className="ail-io-box">
            <span>{tr(locale, '已导出的 JSON 内容预览：', 'Exported JSON Preview:')}</span>
            <textarea rows={4} readOnly value={exportedJson} />
          </label>
        )}

        <label className="ail-io-box">
          <span>{tr(locale, '粘贴或确认待导入的 JSON 内容：', 'Paste or review JSON to import:')}</span>
          <textarea
            rows={4}
            value={importText}
            placeholder='{"format":"ai-infra-lab-archive/1","schemaVersion":1,"runs":[],"evidence":[]}'
            onChange={(e) => setImportText(e.target.value)}
          />
        </label>

        <div className="ail-action-bar">
          <button
            type="button"
            className="ail-btn ail-btn-primary"
            disabled={busy || !importText.trim()}
            onClick={() => void handleImport()}
          >
            {tr(locale, '⬆ 执行导入合并', '⬆ Import JSON Data')}
          </button>
          {ioMessage && <span className="ail-save-indicator">{ioMessage}</span>}
        </div>
      </section>
    </div>
  )
}
