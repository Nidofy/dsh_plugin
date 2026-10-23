import type { CharacterId } from './roster.ts'
import type { ContentWorld } from './content-state.ts'
const voices: Record<CharacterId, { zh: [string, string, string]; en: [string, string, string] }> = {
  seedance: { zh: ['热茶也有慢慢的节拍。', '跟着饭香，把步子慢下来。', '听，风铃在替我们数拍子。'], en: ['Warm tea has a gentle rhythm.', 'Let the rice slow our steps.', 'Listen, the chime is counting the beat.'] },
  glm: { zh: ['茶面上的光，也值得多看一眼。', '这碗饭让我想起书里的小厨房。', '耳朵先听见了风的线索。'], en: ['The light on the tea deserves a second look.', 'This bowl reminds me of a kitchen in a book.', 'My ears found the breeze first.'] },
  minimax: { zh: ['这杯茶的热气，像故事的开场。', '这一桌，就是今天的好片段。', '新声音也记进今天吧。'], en: ['The steam feels like the start of a story.', 'This table is a lovely scene for today.', 'Let us remember this new sound too.'] },
  llama: { zh: ['双手捧着杯子，刚好暖暖的。', '慢慢吃，软软的午后还长。', '轻轻响一下，就很安心。'], en: ['A cup held in both hands feels warm.', 'Take your time. The soft afternoon is long.', 'That gentle chime feels comforting.'] },
  mistral: { zh: ['帽子放稳，就能安心喝茶了。', '风再急，也要好好吃一顿。', '这回风有自己的乐器了。'], en: ['Hat safely down, time for tea.', 'Even a rushing breeze can pause for dinner.', 'Now the breeze has an instrument.'] },
  bluewhale: { zh: ['这杯暖暖的，慢慢喝。', '有朋友在，白米饭也香。', '叮——小院有了自己的声音。'], en: ['A warm cup. No need to hurry.', 'Rice tastes better with a friend.', 'A little chime, just for our courtyard.'] },
  claude: { zh: ['把今天的故事泡进茶里吧。', '这一口，值得写进手账。', '风经过这里，留下了一个逗号。'], en: ['Let today’s stories steep with the tea.', 'This little moment belongs in our journal.', 'The breeze left a comma on its way through.'] },
  gemini: { zh: ['你看，茶汽像一朵小云！', '下次要不要换个座位看风景？', '同一阵风，也会唱不同的歌。'], en: ['Look, the steam is a tiny cloud!', 'Shall we swap seats for a new view next time?', 'Even the same breeze can sing a new tune.'] },
  gpt: { zh: ['今天的安排：一起歇一会儿。', '一碗饭，加上一段好聊天。', '记下来了：窗边多了一点轻快。'], en: ['Today’s plan: a little break together.', 'One bowl of rice, with a good conversation.', 'Noted: a lighter feeling by the window.'] },
  grok: { zh: ['先说好，最后一口茶归我！', '我认真宣布：今天这碗赢了。', '这位新邻居，只在有风时发言。'], en: ['I call the last sip!', 'Official verdict: this bowl wins the day.', 'Our new neighbor only speaks when it’s windy.'] },
  kimi: { zh: ['茶放凉一点，再聊久一点。', '慢慢吃，我还想多坐一会儿。', '这么轻的声音，刚好陪着午后。'], en: ['Let the tea cool; let the conversation linger.', 'Take your time. I’d like to stay a while.', 'Such a soft sound for a quiet afternoon.'] },
  qwen: { zh: ['好茶不急，好朋友也是。', '热饭有香气，同桌有人情。', '一枚风铃，满院清风。'], en: ['Good tea takes time. So does good company.', 'Warm rice, warm company.', 'One small chime welcomes the whole breeze.'] },
}
export function dialogue(world: Pick<ContentWorld, 'activeEvent'>, locale: 'zh' | 'en'): { actor: CharacterId; text: string }[] {
  const event = world.activeEvent
  if (!event || event.phase !== 'talking') return []
  return event.participants.map((actor, i) => ({ actor, text: event.branch === 'familiar' && i === 1
    ? (locale === 'zh' ? '又坐到一起了。下次也留个位置吧。' : 'Together again. Save me a seat next time.')
    : voices[actor][locale][event.food === 'tea' ? 0 : 1] }))
}
export function bellReaction(actor: CharacterId, locale: 'zh' | 'en'): string { return voices[actor][locale][2] }
export function villageTime(ticks: number): { day: number; hour: number; minute: number } {
  const minutes = Math.floor(ticks * 1440 / (30 * 30 * 60)) + 14 * 60
  return { day: Math.floor(minutes / 1440) + 1, hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 }
}
