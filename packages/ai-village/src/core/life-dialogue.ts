import { residentLife } from './life-catalog.ts'
import { lifePresentation, type LifeWorld } from './life-engine.ts'
import type { CharacterId } from './roster.ts'

/** At most one short bubble for each social exchange; never writes history or notifications. */
export function lifeDialogue(world: LifeWorld, locale: 'zh' | 'en'): { actor: CharacterId; text: string }[] {
  const social = world.life.social
  if (!social) return []
  const actor = social.pair[0], presentation = lifePresentation(world, actor)
  if (!presentation?.bubble) return []
  const voice = residentLife[actor]
  const text = presentation.bubble === 'farewell' ? voice.farewell[locale]
    : presentation.bubble === 'watch' ? voice.watching[locale]
    : presentation.bubble === 'tea' ? (locale === 'zh' ? '下次一起坐下来喝杯茶吧。' : 'Shall we sit down for tea next time?')
    : presentation.bubble === 'chime' ? (locale === 'zh' ? '听，风铃也在跟我们打招呼。' : 'Listen. The wind chime is saying hello, too.')
    : presentation.bubble === 'garden' ? (locale === 'zh' ? '这片叶子，好像又长大了一点。' : 'That leaf looks a little bigger today.')
    : voice.greeting[locale]
  return [{ actor, text }]
}
