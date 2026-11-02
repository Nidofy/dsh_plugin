import type { Lesson } from '../types.ts'
import { Markdown } from './Markdown.tsx'
export function LectureTab({
  lesson,
  onSelection,
  onRead,
  onPractice,
}: {
  lesson: Lesson
  onSelection: (text: string) => void
  onRead: () => void
  onPractice: () => void
}) {
  const sections = lesson.body.split(/(?=^#{1,4} )/m)
  const select = () => {
    const text = window.getSelection()?.toString()
    if (text) onSelection(text.slice(0, 3000))
  }
  return (
    <article className="nl-lecture" onMouseUp={select} onKeyUp={select}>
      <div className="nl-objectives">
        <h3>学习目标 / Learning goals</h3>
        <ul>
          {lesson.objectives.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </div>
      <nav className="nl-anchors" aria-label="讲义目录 Contents">
        {sections.map((part, i) => {
          const title = /^#{1,4} (.+)/.exec(part)?.[1]
          return (
            title && (
              <button
                key={i}
                onClick={() =>
                  document
                    .getElementById(`nl-${lesson.id}-${i}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {title}
              </button>
            )
          )
        })}
      </nav>
      {sections.map((part, i) => (
        <section id={`nl-${lesson.id}-${i}`} key={i}>
          <Markdown text={part} />
        </section>
      ))}
      <h3>小结 Summary</h3>
      <Markdown text={lesson.summary} />
      <details>
        <summary>参考资料 / Sources</summary>
        {lesson.sources.map((source) => (
          <a key={source} href={source} target="_blank" rel="noreferrer">
            {source}
          </a>
        ))}
      </details>
      <div className="nl-actions">
        <button onClick={onRead}>标记已读 Mark read</button>
        <button className="nl-primary" onClick={onPractice}>
          开始练习 Practice
        </button>
      </div>
    </article>
  )
}
