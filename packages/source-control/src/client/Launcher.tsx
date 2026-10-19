import { Icon } from './Panel.tsx'
import { css } from './style.ts'
import { en, zh } from './messages.ts'

export function PanelLauncher({ locale = 'zh', open = false, onOpen }: { locale?: string; open?: boolean; onOpen: () => void }) {
  const t = locale.startsWith('zh') ? zh : en
  return <div className="dsh-vcs"><style>{css}</style>
    <button title={t.open} aria-label={t.open} aria-pressed={open} onClick={onOpen}><Icon name="branch" /></button>
  </div>
}
