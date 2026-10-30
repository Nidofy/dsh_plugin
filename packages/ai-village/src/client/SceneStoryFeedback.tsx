import type { VillageRuntime } from './runtime.ts'
import { afternoonStory, afternoonStories } from '../core/afternoon-catalog.ts'
import { residentStory } from '../core/resident-stories-catalog.ts'
import { actionErrorText } from './ManagementPanel.tsx'

export function SceneStoryFeedback({ runtime: r, cn }: { runtime: VillageRuntime; cn: boolean }) {
  const w = r.controller?.world, e = w?.afternoon.active, locale = cn ? 'zh' : 'en'
  const recalled = r.sceneRecall && w?.afternoon.memories.find(m => m.storyId === r.sceneRecall!.story && m.eventId === r.sceneRecall!.eventId && afternoonStory(m.storyId).region === w.region.active)
  if (!e && !recalled) return null
  const story = afternoonStory(e?.storyId ?? recalled!.storyId)
  const authored = residentStory(story.id), step = e && authored?.steps[e.step], previous = e && authored?.steps[e.step - 1]
  const next = recalled && afternoonStories.find(s => s.prerequisite === recalled.storyId && !w?.afternoon.memories.some(m => m.storyId === s.id))
  const busy = r.reasons.has('commit-pending') || r.saveReceipt.status === 'unknown'
  return <section className="village-scene-story" aria-label={cn ? '场景故事' : 'Scene story'} style={{ position: 'absolute', zIndex: 25, top: 60, left: 'var(--gutter)', right: 'var(--gutter)', background: 'var(--solid)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
    <div style={{ flex: 1, minWidth: 0 }}><strong>{story.title[locale]}{e ? ` · ${e.stage + 1}/3` : ''}</strong>
      <p role="status" style={{ margin: '4px 0', fontSize: 12 }}>{r.actionError ? actionErrorText(r.actionError, cn) : recalled ? story.revisit[locale] : r.controller?.pauseReasons.size ? (cn ? '已暂停，恢复后继续。' : 'Paused. Resume to continue.') : e?.phase === 'approaching' ? (cn ? '朋友们正在走近，请稍等。' : 'Your friends are walking over.') : e?.phase === 'observing' ? (cn ? '看看朋友手里的小发现。' : 'Watch what your friends have found.') : step && e?.stage === 1 ? step.prompt[locale] : (cn ? '轻点场景中描边的物件，亲手留下选择。' : 'Tap an outlined object in the scene to make your choice.')}</p>
      {e && e.stage > 0 && <p style={{ margin: '4px 0', fontSize: 12 }}>{e.attempts && step ? step.retry[locale] : previous ? previous.response[locale] : story.lines[1]?.[locale]}</p>}
      {next && <p style={{ margin: '4px 0', fontSize: 12 }}>{cn ? `本章已保存。${w?.region.active === 'bookhouse' ? '先回小院，再去茶会广场' : '下一站回到小院'}，继续寻找日记线索。` : `Chapter saved. ${w?.region.active === 'bookhouse' ? 'Return through the courtyard to Tea Square' : 'Return to the courtyard'} to follow the next clue.`}</p>}
    </div>
    <button disabled={busy} onClick={() => e ? void r.cancelAfternoon() : r.clearSceneRecall()}>{e ? cn ? '取消' : 'Cancel' : cn ? '收起' : 'Close'}</button>
  </section>
}
