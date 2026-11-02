import type { HelpLevel, Workspace } from '../types.ts'
import { Markdown } from './Markdown.tsx'
interface Props {
  workspace?: Workspace
  busy: boolean
  hint: string
  question: string
  selection: string
  reply: string
  onQuestion: (value: string) => void
  onSelection: (value: string) => void
  onHint: (level: HelpLevel) => void
  onAsk: () => void
  onIndependent: () => void
}
export function MentorSidebar(props: Props) {
  return (
    <aside className="nl-mentor">
      <details open>
        <summary>导师与提示 / Mentor</summary>
        <p>帮助按观察记录，不等于验证独立完成。/ Help is recorded, not proof of independence.</p>
        <button disabled={!props.workspace || props.busy} onClick={props.onIndependent}>
          独立重试（自述） Independent retry
        </button>
        <div className="nl-hints">
          {(['concept', 'steps', 'code', 'answer'] as HelpLevel[]).map((level, i) => (
            <button
              disabled={!props.workspace || props.busy}
              key={level}
              onClick={() => props.onHint(level)}
            >
              {['概念 Concept', '步骤 Steps', '局部代码 Code', '查看答案 Answer'][i]}
            </button>
          ))}
        </div>
        {props.hint && <Markdown text={props.hint} />}
        <label>
          所选上下文 Selected context
          <textarea
            value={props.selection}
            onChange={(e) => props.onSelection(e.target.value)}
            placeholder="选择讲义段落、公式或代码 / Select text or code"
          />
        </label>
        <label>
          提问 Question
          <textarea
            value={props.question}
            onChange={(e) => props.onQuestion(e.target.value)}
            placeholder="解释报错或分析本次实验 / Ask about this result"
          />
        </label>
        <button
          className="nl-primary"
          disabled={props.busy || !props.workspace || !props.question.trim()}
          onClick={props.onAsk}
        >
          询问导师 Ask mentor
        </button>
        {props.reply && <Markdown text={props.reply} />}
        <details>
          <summary>导师记录 / Conversation</summary>
          {props.workspace?.messages.map((message, i) => (
            <div key={i}>
              <strong>
                {message.role} · {message.status}
              </strong>
              <Markdown text={message.text} />
            </div>
          ))}
        </details>
      </details>
    </aside>
  )
}
