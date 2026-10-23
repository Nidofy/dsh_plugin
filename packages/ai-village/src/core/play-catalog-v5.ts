import { words, type Words } from './neighborhood-catalog.ts'
import { residentLife } from './life-catalog.ts'
import type { CharacterId } from './roster.ts'

export const playIds = ['lost-rice', 'quiet-page', 'wind-notes', 'find-whale', 'tidy-desk', 'snack-table', 'stargazing', 'table-game'] as const
export type PlayId = typeof playIds[number]
export const playDecorationIds = ['rice-bowl', 'page-marker', 'wind-ribbon', 'whale-token', 'desk-star', 'snack-tray', 'star-mobile', 'table-stones'] as const
export type PlayDecorationId = typeof playDecorationIds[number]
export interface PlayStage {
  id: string
  target: 'work' | 'bench' | 'eat' | 'corner' | null
  text: Words
  action: string
  actionLabel: Words
  observeTicks: number
}
export interface PlayDefinition {
  id: PlayId
  kind: 'story' | 'game' | 'group'
  name: Words
  summary: Words
  count: 1 | 2 | 3
  stages: readonly PlayStage[]
  reward: PlayDecorationId
}
const stage = (id: string, target: PlayStage['target'], zh: string, en: string, action: string, labelZh: string, labelEn: string): PlayStage =>
  ({ id, target, text: words(zh, en), action, actionLabel: words(labelZh, labelEn), observeTicks: 60 })

/** Authored offline content. Rewards reuse existing bowl / code-vector vocabulary; this is not new approved raster art. */
export const playDefinitions: readonly PlayDefinition[] = [
  { id: 'lost-rice', kind: 'story', name: words('蓝鲸丢失的白米饭', 'Bluewhale’s missing rice'), summary: words('蓝鲸的饭碗旁少了一份饭，和朋友沿线索解开小误会。', 'A serving is missing beside Bluewhale’s bowl. Follow the clues together.'), count: 2, reward: 'rice-bowl', stages: [
    stage('empty-table', 'eat', '蓝鲸看着饭碗旁的空位：这里刚才是不是还有一份白米饭？先问问朋友看到了什么。', 'Bluewhale notices a gap beside the bowl: was there another serving of rice here? Ask what your friend saw.', 'talk', '问问刚才发生了什么', 'Ask what happened'),
    stage('paper-clue', 'work', '书桌边留下了几枚白米形的小纸片，还有一张指向长椅的小纸条。它们真的来自饭碗吗？', 'Rice-shaped paper pieces lie beside the desk, with a note pointing to the bench. Did they really come from the bowl?', 'search', '查看纸条上的线索', 'Read the clue'),
    stage('found-bowl', 'bench', '朋友正在给花草画白米形标签。原来少掉的“那份饭”是标签草图，只是一场小误会。', 'Your friend is drawing rice-shaped plant labels. The missing “serving” was a label sketch: a little misunderstanding.', 'help', '帮朋友完成花草标签', 'Help finish the plant labels'),
    stage('lunch-together', 'eat', '蓝鲸把碗里剩下的白米饭分给朋友。误会解开了，午饭也因为分享变得更暖。', 'Bluewhale shares the remaining rice. With the misunderstanding cleared up, lunch feels warmer together.', 'finish', '记下这顿分享的午饭', 'Remember our shared lunch'),
  ] },
  { id: 'quiet-page', kind: 'story', name: words('安静的一页', 'A quiet page'), summary: words('把一句没说完的话，慢慢留在书页之间。', 'Find room for an unfinished sentence.'), count: 2, reward: 'page-marker', stages: [
    stage('unfinished-line', 'work', '朋友写到一半停下了笔。有些话不必马上找到结尾。', 'Your friend puts down the pen. Some sentences do not need an ending just yet.', 'talk', '听听这一句', 'Listen to the sentence'),
    stage('quiet-bench', 'bench', '坐到长椅上，听风翻过空白的一页。陪伴也可以不说话。', 'On the bench, the breeze turns a blank page. Company can be quiet too.', 'help', '留一会儿空白', 'Leave a little space'),
    stage('bookmark', 'work', '朋友把小纸片折成书签：下次从这里继续就好。', 'Your friend folds a bookmark: we can carry on from here next time.', 'finish', '夹好这枚书签', 'Keep the bookmark'),
  ] },
  { id: 'wind-notes', kind: 'story', name: words('风带来的便笺', 'Notes on the breeze'), summary: words('找回被风吹散的便笺，把问候交给朋友。', 'Gather scattered notes and share their greetings.'), count: 2, reward: 'wind-ribbon', stages: [
    stage('loose-note', 'corner', '生活角落飘来一张小纸片，上面只有半句“今天也……”', 'A small note drifts into the corner. It begins: “Today, too…”', 'search', '拾起第一张便笺', 'Pick up the first note'),
    stage('bench-note', 'bench', '长椅边的第二张写着“可以慢慢来”。两张刚好拼成一句问候。', 'The second note by the bench says, “you can take your time.” Together they make a greeting.', 'help', '把两张便笺拼起来', 'Put the notes together'),
    stage('shared-note', 'work', '把这句话抄好，用一段小纸带系住。下次风来，也能把问候留下。', 'Copy the greeting and tie it with a paper ribbon, ready for the next breeze.', 'finish', '留下风的问候', 'Keep the greeting'),
  ] },
  { id: 'find-whale', kind: 'game', name: words('找找小鲸鱼', 'Find the little whale'), summary: words('观察场景中的鲸鱼记号；两次提示慢慢用。', 'Spot a whale token in the scene, with two hints if needed.'), count: 1, reward: 'whale-token', stages: [
    stage('look-around', 'bench', '一个小鲸鱼记号躲在小院里。请点击场景中的记号；也可用下面的地点按钮寻找。', 'A whale token is hiding in the courtyard. Click it in the scene, or search a place with the buttons below.', 'find', '寻找鲸鱼记号', 'Find the whale token'),
    stage('found', 'bench', '找到了！那一小片蓝色，好像在向你眨眼。', 'Found it! That little patch of blue seems to wink at you.', 'finish', '收藏这次发现', 'Keep this discovery'),
  ] },
  { id: 'tidy-desk', kind: 'game', name: words('书桌归位', 'A place for everything'), summary: words('把三件物品放回各自的位置，随时可以重置。', 'Put three items in their places; reset whenever you like.'), count: 1, reward: 'desk-star', stages: [
    stage('sort', 'work', '把书放回书格、笔放进笔筒、纸放到纸盘。拖动物品，或先选物品再选位置。', 'Put the book on the shelf, the pen in its cup, and the paper in its tray. Drag items, or select an item and then a place.', 'place', '整理桌面', 'Tidy the desk'),
    stage('clear-desk', 'work', '桌面留出了刚刚好的空白，现在可以写下一个新点子。', 'The desk has just enough clear space for a new idea.', 'finish', '记住整齐的小角落', 'Remember this tidy corner'),
  ] },
  { id: 'snack-table', kind: 'game', name: words('茶点轮到你', 'Your turn at the snack table'), summary: words('连续分享三份茶点，听听朋友不同的回应。', 'Share three servings and hear your friends respond.'), count: 2, reward: 'snack-tray', stages: [
    stage('serve', 'eat', '米饭、热茶和水果都已准备好。你想先分享哪一份？选三次，也可以重复。', 'Rice, tea, and fruit are ready. What would you like to share? Choose three times; repeats are welcome.', 'choose', '分享一份茶点', 'Share a serving'),
    stage('after-snack', 'eat', '三份小心意，刚好装满这个午后。谢谢你留出的座位。', 'Three little kindnesses fill the afternoon. Thank you for saving a seat.', 'finish', '记下茶点时光', 'Remember snack time'),
  ] },
  { id: 'stargazing', kind: 'group', name: words('三个人的星空', 'Three under the stars'), summary: words('邀请两位朋友，给想象中的星星取名字。', 'Invite two friends and name an imaginary constellation.'), count: 3, reward: 'star-mobile', stages: [
    stage('gather', 'bench', '三位朋友在长椅边站定。天还没完全暗，也可以先想象星星的形状。', 'Three friends gather by the bench. Even before dusk, stars can take shape in our imagination.', 'talk', '说说你想找的星星', 'Describe a star'),
    stage('constellation', 'corner', '一个看见鲸鱼，一个看见书页，还有一个看见茶杯。原来同一片天空能装下这么多故事。', 'One sees a whale, one sees a page, and one sees a teacup. The same sky can hold so many stories.', 'help', '把三颗星连起来', 'Join the three stars'),
    stage('shared-sky', 'bench', '把这片想象的星空折成小挂饰。无论什么时候抬头，都能想起今晚的朋友。', 'Fold the imaginary sky into a tiny mobile, a reminder of the friends who shared it.', 'finish', '留下三人的星空', 'Keep our constellation'),
  ] },
  { id: 'table-game', kind: 'game', name: words('餐桌上的三连棋（开发预览）', 'Three in a row at the table (development preview)'), summary: words('和一位朋友在餐桌上下三连棋。不计分，输赢都能留下一段回忆。', 'Play three in a row with a friend at the table. No scores; every result can become a memory.'), count: 2, reward: 'table-stones', stages: [
    stage('a-friendly-game', 'eat', '先让两位朋友来到餐桌旁。你执圆圈，朋友执叉号；每次落子后，朋友会接着走一步。', 'Let both friends settle by the table. You play circles and your friend plays crosses. Your friend replies after each move.', 'move', '落下一颗棋子', 'Place a piece'),
    stage('a-game-to-remember', 'eat', '把这一局慢慢收好。棋盘上的输赢很快过去，一起坐过的时光会留下。', 'Put the pieces away gently. A result passes quickly; time spent together stays.', 'finish', '记下这一局', 'Remember this game'),
  ] },
]
export const playDecorationNames: Record<PlayDecorationId, Words> = {
  'rice-bowl': words('团圆饭碗', 'Togetherness bowl'), 'page-marker': words('安静书签', 'Quiet bookmark'),
  'wind-ribbon': words('风语纸带', 'Breeze ribbon'), 'whale-token': words('小鲸记号', 'Whale token'),
  'desk-star': words('书桌小星', 'Desk star'), 'snack-tray': words('午后茶盘', 'Afternoon tray'), 'star-mobile': words('三颗星挂饰', 'Three-star mobile'), 'table-stones': words('同桌棋子', 'Shared-table pieces'),
}
export const snackChoices = ['rice', 'tea', 'fruit'] as const
export const snackNames = { rice: words('米饭', 'Rice'), tea: words('热茶', 'Tea'), fruit: words('水果', 'Fruit') }
export const snackReactions = {
  rice: words('热乎乎的米饭，让这张桌子像家一样。', 'Warm rice makes this table feel like home.'),
  tea: words('先捧着茶杯暖暖手，故事可以慢慢说。', 'Warm your hands around the cup. There is time for the story.'),
  fruit: words('清甜的一小口，像把阳光分给了朋友。', 'A sweet bite feels like sharing a little sunshine.'),
}
export const deskItems = [words('书', 'Book'), words('笔', 'Pen'), words('纸', 'Paper')] as const
export const deskSlots = [words('书格', 'Shelf'), words('笔筒', 'Pen cup'), words('纸盘', 'Paper tray')] as const
export const whalePlaces = ['work', 'bench', 'eat', 'corner'] as const
export const whalePlaceNames = { work: words('书桌旁', 'By the desk'), bench: words('长椅旁', 'By the bench'), eat: words('餐桌旁', 'By the table'), corner: words('生活角落', 'Living corner') }
export function playDefinition(id: string): PlayDefinition | undefined { return playDefinitions.find(d => d.id === id) }
export function whalePlace(event: { id: string }): typeof whalePlaces[number] {
  let hash = 0
  for (const char of event.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return whalePlaces[hash % whalePlaces.length]!
}
export function snackReaction(id: CharacterId, snack: typeof snackChoices[number], locale: 'zh' | 'en'): string {
  const voice = residentLife[id]
  if (voice.favoriteSnack === snack) return locale === 'zh' ? `${snackNames[snack].zh}正是我最喜欢的，谢谢你记得！${voice.greeting.zh}` : `${snackNames[snack].en} is my favorite. Thank you for remembering! ${voice.greeting.en}`
  return `${snackReactions[snack][locale]} ${voice.watching[locale]}`
}
