import type { CharacterId } from './roster.ts'
export type AfternoonStoryId = 'tea-bookmark' | 'reflection-shapes'
export type AfternoonSelection = 'leaf' | 'wave' | 'left' | 'right'
export type AfternoonAction = 'listen' | 'fold' | 'press' | 'observe' | 'match' | 'remember'
export const afternoonStoryIds: readonly AfternoonStoryId[] = ['tea-bookmark', 'reflection-shapes']
export const afternoonStories = [
  { id: 'tea-bookmark', participants: ['bluewhale', 'claude'],
    title: { zh: '茶香书签', en: 'A tea-scented bookmark' },
    keepsakeTitle: { zh: '茶香书签', en: 'Tea-scented bookmark' },
    stages: [
      { zh: '等蓝鲸和 Claude 走近，听完纸签里的小句子。', en: 'Wait for Bluewhale and Claude, then listen to their little note.' },
      { zh: '选一枚叶子或一道波纹，折好纸签，再轻轻压平。', en: 'Choose a leaf or a wave, fold the note, then press it gently.' },
      { zh: '陪朋友走完收尾的小路，把这个下午记下来。', en: 'Let your friends finish their walk, then remember this afternoon.' },
    ],
    lines: [
      { zh: '蓝鲸：慢慢听，茶香也会留在纸上。', en: 'Bluewhale: Listen slowly. The scent of tea can stay on paper too.' },
      { zh: 'Claude：叶子像一句停顿，波纹像一句回应。你想留下哪一种？', en: 'Claude: A leaf is a pause; a wave is a reply. Which shall we keep?' },
    ],
  },
  { id: 'reflection-shapes', participants: ['gemini', 'grok'],
    title: { zh: '倒影寻形', en: 'Shapes in reflection' },
    keepsakeTitle: { zh: '倒影小卡', en: 'Reflection card' },
    stages: [
      { zh: '等 Gemini 和 Grok 走近，选择从左边还是右边观察杯中的倒影。', en: 'Wait for Gemini and Grok, then choose the left or right viewpoint into the cup.' },
      { zh: '杯里的图形左右颠倒了。试试原样或镜像，找出能重合的形状。', en: 'The shape in the cup is reversed. Try the original or its mirror to find a match.' },
      { zh: '一起走到另一侧，再把找到的倒影留在小卡上。', en: 'Walk together to the other side and keep the reflection on a little card.' },
    ],
    lines: [
      { zh: 'Gemini：从左边看一次，再想想右边会怎样！', en: 'Gemini: Look from the left, then imagine the view from the right!' },
      { zh: 'Grok：原样搬过去可不算倒影。左右换个位置试试？', en: 'Grok: Copying it straight across is no reflection. Try swapping left and right?' },
    ],
  },
] as const satisfies readonly { id: AfternoonStoryId; participants: readonly [CharacterId, CharacterId]; title: { zh: string; en: string }; keepsakeTitle: { zh: string; en: string }; stages: readonly { zh: string; en: string }[]; lines: readonly { zh: string; en: string }[] }[]
export const isAfternoonStoryId = (v: unknown): v is AfternoonStoryId => afternoonStoryIds.includes(v as AfternoonStoryId)
export function afternoonStory(id: AfternoonStoryId) { return afternoonStories.find(s => s.id === id)! }
export function afternoonSelectionValid(id: AfternoonStoryId, v: unknown): v is AfternoonSelection {
  return (id === 'tea-bookmark' ? ['leaf', 'wave'] : ['left', 'right']).includes(v as string)
}
