import { useState } from 'react'
import type { EnvironmentStatus, Locale } from '../types.ts'
import { pickText, tr } from './i18n.ts'

export interface EnvironmentBannerProps {
  readonly environment?: EnvironmentStatus
  readonly locale: Locale
  readonly checking: boolean
  readonly onRecheck: () => void
}

export function EnvironmentBanner({
  environment,
  locale,
  checking,
  onRecheck,
}: EnvironmentBannerProps) {
  const [copied, setCopied] = useState(false)

  if (!environment) {
    return (
      <div className="ail-env-compact" role="status">
        <span className="ail-status-dot ail-status-pending" aria-hidden="true" />
        <span>
          {tr(locale, '正在检测本地执行环境…', 'Inspecting local execution environment…')}
        </span>
      </div>
    )
  }

  if (environment.stage === 'ready') {
    return (
      <div className="ail-env-compact ail-env-ready" role="status">
        <span className="ail-status-dot ail-status-ok" aria-hidden="true" />
        <strong>{tr(locale, '执行沙箱就绪', 'Sandbox Ready')}</strong>
        <span className="ail-env-meta">
          {tr(
            locale,
            `宿主机 ${environment.hostCpus} 核 · 镜像 ${environment.image}`,
            `${environment.hostCpus} Host CPUs · Image ${environment.image}`,
          )}
        </span>
        <button
          type="button"
          className="ail-btn ail-btn-ghost ail-btn-xs"
          disabled={checking}
          onClick={onRecheck}
        >
          {checking ? tr(locale, '检测中…', 'Checking…') : tr(locale, '重新检测', 'Recheck')}
        </button>
      </div>
    )
  }

  const stageTitle =
    environment.stage === 'docker_unavailable'
      ? tr(locale, '未检测到可用的 Docker 引擎', 'Docker Engine Unavailable')
      : environment.stage === 'image_missing'
        ? tr(locale, '尚未准备 CPU 实验镜像', 'CPU Lab Image Not Pulled Yet')
        : tr(locale, '容器环境检测未通过', 'Environment Inspection Failed')

  const sizeLabel =
    Number.isFinite(environment.estimatedImageSizeGb) && environment.estimatedImageSizeGb > 0
      ? `~${environment.estimatedImageSizeGb.toFixed(2)} GB`
      : '~1.34 GB'

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(environment.prepareCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback ignored if clipboard permission denied
    }
  }

  return (
    <section className="ail-env-card" aria-label={stageTitle}>
      <div className="ail-env-card-header">
        <div className="ail-env-card-title">
          <span className="ail-status-dot ail-status-warn" aria-hidden="true" />
          <strong>{stageTitle}</strong>
          <span className="ail-pill">
            {tr(locale, `镜像体积 ${sizeLabel}`, `Image size ${sizeLabel}`)}
          </span>
          <span className="ail-pill">
            {tr(locale, `宿主机 ${environment.hostCpus} 核`, `${environment.hostCpus} Host CPUs`)}
          </span>
        </div>
        <button
          type="button"
          className="ail-btn ail-btn-sm"
          disabled={checking}
          onClick={onRecheck}
        >
          {checking ? tr(locale, '检测中…', 'Checking…') : tr(locale, '重新检测', 'Recheck')}
        </button>
      </div>

      <p className="ail-env-detail">{pickText(environment.detail, locale)}</p>

      <p className="ail-env-reassurance">
        {tr(
          locale,
          '💡 讲义阅读、小测、容量估算题与交互模拟器无需 Docker 即可正常使用；仅运行真实 CPU 代码实验时需要准备沙箱镜像。',
          '💡 Lesson reading, quizzes, capacity estimates, and interactive simulators work normally without Docker; the sandbox image is only needed for live CPU code runs.',
        )}
      </p>

      {environment.prepareCommand && (
        <div className="ail-env-cmd-row">
          <code className="ail-env-cmd">{environment.prepareCommand}</code>
          <button type="button" className="ail-btn ail-btn-sm" onClick={() => void copyCommand()}>
            {copied ? tr(locale, '已复制 ✓', 'Copied ✓') : tr(locale, '复制准备命令', 'Copy Command')}
          </button>
        </div>
      )}
    </section>
  )
}
