import type { CharacterId } from './roster.ts'
import type { Activity } from './world.ts'
import { villageTime } from './dialogue.ts'

export type LifePeriod = 'day' | 'dusk' | 'night'
export type LifeSnack = 'rice' | 'fruit' | 'tea'
export type SignatureMotion = 'whale-tail' | 'thoughtful-note' | 'cloud-frame' | 'neat-cuffs' | 'playful-salute' | 'quiet-stretch' | 'leaf-greeting' | 'dance-count' | 'fox-listen' | 'frame-story' | 'woolly-hug' | 'feather-tip'
export type LifeMotion = SignatureMotion | 'wave' | 'listen' | 'offer' | 'point' | 'farewell' | 'waiting' | 'interrupted'
export interface LifeWords { zh: string; en: string }
export interface ResidentLife {
  description: LifeWords
  activityWeights: Readonly<Record<Activity, number>>
  activePeriod: LifePeriod
  sociability: number
  favoriteSnack: LifeSnack
  favoriteProp: 'bowl' | 'book' | 'flower' | 'notebook' | 'toy' | 'cushion' | 'teacup'
  signature: SignatureMotion
  idle: LifeWords
  greeting: LifeWords
  watching: LifeWords
  farewell: LifeWords
}
const words = (zh: string, en: string): LifeWords => ({ zh, en })
/** Small immutable content catalog: preferences choose behavior, never create care meters. */
export const residentLife: Readonly<Record<CharacterId, ResidentLife>> = {
  bluewhale: {
    description: words('爱白米饭，也爱慢慢听朋友说话。', 'Loves rice and unhurried conversations.'),
    activityWeights: { work: 2, eat: 5, rest: 3, sit: 3, read: 2, tend: 1 }, activePeriod: 'day', sociability: 4,
    favoriteSnack: 'rice', favoriteProp: 'bowl', signature: 'whale-tail',
    idle: words('尾巴替我伸个懒腰。', 'A little stretch, all the way to my tail.'),
    greeting: words('来这边，给你留了点阳光。', 'Come over. I saved you a patch of sunshine.'),
    watching: words('你忙，我安静陪一小会儿。', 'Keep going. I will sit quietly with you.'),
    farewell: words('我去转转，等会儿见。', 'Time for a little stroll. See you soon.'),
  },
  claude: {
    description: words('喜欢书页、午后闲谈和留白。', 'Enjoys books, afternoon conversations and room to think.'),
    activityWeights: { work: 3, eat: 1, rest: 2, sit: 3, read: 5, tend: 2 }, activePeriod: 'dusk', sociability: 3,
    favoriteSnack: 'tea', favoriteProp: 'book', signature: 'thoughtful-note',
    idle: words('刚才那句话，值得留个书签。', 'That thought deserves a bookmark.'),
    greeting: words('你的今天，翻到哪一页了？', 'Which page of your day are you on?'),
    watching: words('这一页，我也想听听。', 'I would like to hear about this page, too.'),
    farewell: words('这段闲谈，先夹在这里。', 'Let us bookmark this conversation.'),
  },
  gemini: {
    description: words('爱换个角度观察云和花草。', 'Finds new angles on clouds and flowers.'),
    activityWeights: { work: 2, eat: 2, rest: 2, sit: 3, read: 3, tend: 5 }, activePeriod: 'day', sociability: 5,
    favoriteSnack: 'fruit', favoriteProp: 'flower', signature: 'cloud-frame',
    idle: words('用手框起来，这朵云就像小鲸鱼！', 'Between my hands, that cloud looks like a whale!'),
    greeting: words('快看，我发现了一个新角度。', 'Look! I found a different view.'),
    watching: words('从这里看，又是另一种样子。', 'It looks different from over here.'),
    farewell: words('我去找下一朵有趣的云。', 'Off to find the next interesting cloud.'),
  },
  gpt: {
    description: words('整理好书桌，也记得安排休息。', 'Keeps a tidy desk and makes time for breaks.'),
    activityWeights: { work: 5, eat: 2, rest: 2, sit: 2, read: 4, tend: 1 }, activePeriod: 'day', sociability: 3,
    favoriteSnack: 'fruit', favoriteProp: 'notebook', signature: 'neat-cuffs',
    idle: words('袖口整理好，下一项是歇一会儿。', 'Cuffs tidy. Next on the list: a break.'),
    greeting: words('现在的安排是：听你说。', 'The plan for now is to listen to you.'),
    watching: words('这一小步做得很整齐。', 'That is a neatly finished little step.'),
    farewell: words('休息完成，下次还一起。', 'A good break. Let us do it again.'),
  },
  grok: {
    description: words('爱开玩笑，傍晚也想找人聊聊。', 'A playful neighbor who enjoys evening company.'),
    activityWeights: { work: 1, eat: 4, rest: 2, sit: 5, read: 2, tend: 2 }, activePeriod: 'dusk', sociability: 5,
    favoriteSnack: 'fruit', favoriteProp: 'toy', signature: 'playful-salute',
    idle: words('报告：今天的小院依然很有趣。', 'Report: the courtyard is still excellent fun.'),
    greeting: words('路过也要打个招呼，这是我定的！', 'Passing hello! A rule I just made up.'),
    watching: words('我负责围观和小声赞叹。', 'I am in charge of watching and quiet applause.'),
    farewell: words('散会！下次继续说点好玩的。', 'Meeting adjourned! More fun next time.'),
  },
  kimi: {
    description: words('偏爱安静陪伴，夜色里更放松。', 'Prefers quiet company and unwinds after dusk.'),
    activityWeights: { work: 2, eat: 2, rest: 5, sit: 4, read: 4, tend: 1 }, activePeriod: 'night', sociability: 2,
    favoriteSnack: 'tea', favoriteProp: 'cushion', signature: 'quiet-stretch',
    idle: words('肩膀放松一点，风会等我们。', 'Relax your shoulders. The breeze can wait.'),
    greeting: words('不用说什么，一起待会儿也好。', 'No need to talk. Staying a while is enough.'),
    watching: words('这里的安静，刚刚好。', 'Just the right amount of quiet.'),
    farewell: words('我再去安静的地方坐坐。', 'I will find another quiet spot for a while.'),
  },
  seedance: {
    description: words('把微风数成节拍，喜欢邀朋友一起舒展。', 'Counts the breeze into beats and invites friends to stretch.'),
    activityWeights: { work: 3, eat: 2, rest: 3, sit: 4, read: 2, tend: 3 }, activePeriod: 'day', sociability: 5,
    favoriteSnack: 'fruit', favoriteProp: 'flower', signature: 'dance-count',
    idle: words('一、二，给今天留个轻快的拍子。', 'One, two. A light beat for today.'),
    greeting: words('来，把这阵风一起数完。', 'Come count this breeze with me.'),
    watching: words('你的节奏很好，我跟着听。', 'I like your rhythm. I am listening along.'),
    farewell: words('下一段节拍，等会儿再接。', 'We can pick up the next beat later.'),
  },
  glm: {
    description: words('留意细节，喜欢在灯下慢慢读书。', 'Notices small details and enjoys reading by lamplight.'),
    activityWeights: { work: 4, eat: 2, rest: 2, sit: 3, read: 5, tend: 2 }, activePeriod: 'night', sociability: 2,
    favoriteSnack: 'tea', favoriteProp: 'book', signature: 'fox-listen',
    idle: words('耳朵听见了翻页的声音。', 'My ears caught the sound of a turning page.'),
    greeting: words('你说吧，我把这一页先折好。', 'Go ahead. Let me mark this page first.'),
    watching: words('这个小细节，我也注意到了。', 'I noticed that little detail too.'),
    farewell: words('我去看看书里的下一处线索。', 'Off to find the next clue in my book.'),
  },
  minimax: {
    description: words('爱记录生活的小片段，也爱热闹的饭桌。', 'Collects little moments and enjoys a lively dinner table.'),
    activityWeights: { work: 4, eat: 5, rest: 2, sit: 4, read: 2, tend: 2 }, activePeriod: 'dusk', sociability: 5,
    favoriteSnack: 'fruit', favoriteProp: 'notebook', signature: 'frame-story',
    idle: words('这个小片段，想留给明天看。', 'I want to save this little scene for tomorrow.'),
    greeting: words('今天有什么值得记住的小事？', 'What little moment should we remember today?'),
    watching: words('不用摆姿势，这样就很好。', 'No need to pose. This is lovely as it is.'),
    farewell: words('这段先收好，下次接着聊。', 'Saving this moment. More stories next time.'),
  },
  llama: {
    description: words('喜欢柔软的午后、慢慢的茶和长长的书。', 'Likes soft afternoons, slow tea and long books.'),
    activityWeights: { work: 2, eat: 3, rest: 5, sit: 4, read: 4, tend: 2 }, activePeriod: 'day', sociability: 3,
    favoriteSnack: 'tea', favoriteProp: 'cushion', signature: 'woolly-hug',
    idle: words('把袖子拢一拢，暖意就留下了。', 'Gather my sleeves and keep the warmth close.'),
    greeting: words('这里软软的，留个位置给你。', 'A soft spot here, saved just for you.'),
    watching: words('慢一点也没关系，我陪你。', 'It is fine to go slowly. I am here.'),
    farewell: words('带着这一点暖意去散步。', 'Taking a little of this warmth for a stroll.'),
  },
  mistral: {
    description: words('喜欢追着风找新点子，也会停下来听朋友。', 'Follows the breeze to new ideas and pauses to hear friends.'),
    activityWeights: { work: 4, eat: 2, rest: 2, sit: 3, read: 3, tend: 4 }, activePeriod: 'dusk', sociability: 4,
    favoriteSnack: 'fruit', favoriteProp: 'flower', signature: 'feather-tip',
    idle: words('扶好帽子，风又带来了新点子。', 'Hold my hat. The breeze brought another idea.'),
    greeting: words('风刚好停了一下，来聊聊吧。', 'The breeze has paused. Shall we talk?'),
    watching: words('我把帽子扶稳，认真看一会儿。', 'Hat steady. I will watch carefully for a while.'),
    farewell: words('去下一个转角，替你看看风。', 'Off around the corner to check on the breeze.'),
  },
  qwen: {
    description: words('喜欢照料花草，也乐意以茶待友。', 'Tends the plants and welcomes friends with tea.'),
    activityWeights: { work: 3, eat: 2, rest: 2, sit: 3, read: 3, tend: 5 }, activePeriod: 'day', sociability: 4,
    favoriteSnack: 'tea', favoriteProp: 'teacup', signature: 'leaf-greeting',
    idle: words('拂去一点尘，留下一点绿。', 'Brush away a little dust; leave a little green.'),
    greeting: words('清风正好，来叙一会儿。', 'A fine breeze for a little conversation.'),
    watching: words('慢工也有慢工的趣味。', 'There is joy in taking your time.'),
    farewell: words('各自走走，回头再叙。', 'A stroll apart, another chat soon.'),
  },
}

export function lifeClock(ticks: number): ReturnType<typeof villageTime> & { period: LifePeriod } {
  const time = villageTime(ticks)
  return { ...time, period: time.hour >= 6 && time.hour < 17 ? 'day' : time.hour >= 17 && time.hour < 21 ? 'dusk' : 'night' }
}
/** Integer weights reuse the caller's existing one random draw; this never touches RNG. */
export function activityWeight(id: CharacterId, activity: Activity, ticks: number): number {
  const resident = residentLife[id], period = lifeClock(ticks).period
  const quiet = activity === 'rest' || activity === 'sit'
  return resident.activityWeights[activity] + (period === 'night' && quiet ? 3 : 0)
    + (period === resident.activePeriod && !quiet ? 1 : 0)
}
