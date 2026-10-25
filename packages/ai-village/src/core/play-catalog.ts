import { words, type Words } from './neighborhood-catalog.ts'
import { residentLife } from './life-catalog.ts'
import type { CharacterId } from './roster.ts'

export const playIds = ['lost-rice', 'quiet-page', 'wind-notes', 'find-whale', 'tidy-desk', 'snack-table', 'stargazing', 'table-game', 'paper-rescue', 'leaves-gather', 'intro-seedance', 'intro-glm', 'intro-minimax', 'intro-llama', 'intro-mistral', 'pair-bluewhale-claude', 'pair-glm-gemini', 'pair-kimi-mistral', 'pair-gpt-minimax', 'pair-seedance-grok', 'pair-qwen-llama'] as const
export type PlayId = typeof playIds[number]
export const playDecorationIds = ['rice-bowl', 'page-marker', 'wind-ribbon', 'whale-token', 'desk-star', 'snack-tray', 'star-mobile', 'table-stones', 'message-board', 'leaf-pot'] as const
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
  kind: 'story' | 'game' | 'group' | 'event'
  name: Words
  summary: Words
  count: 1 | 2 | 3
  stages: readonly PlayStage[]
  reward: PlayDecorationId | null
  requiredParticipants?: readonly CharacterId[]
  introduction?: CharacterId
}
const stage = (id: string, target: PlayStage['target'], zh: string, en: string, action: string, labelZh: string, labelEn: string): PlayStage =>
  ({ id, target, text: words(zh, en), action, actionLabel: words(labelZh, labelEn), observeTicks: 60 })

/** Authored offline content. Rewards reuse existing bowl / code-vector vocabulary; this is not new approved raster art. */
export const playDefinitions: readonly PlayDefinition[] = [
  { id:'intro-seedance', kind:'story', name:words('初见：小院的节奏','First hello: a courtyard rhythm'), summary:words('和 Seedance 用脚步认识这座小院。','Meet Seedance through a few little steps.'), count:1, reward:null, requiredParticipants:['seedance'], introduction:'seedance', stages:[
    stage('hear','bench','Seedance 在长椅旁轻轻点脚：“先听风，再给脚步找一个拍子。”','Seedance taps a foot beside the bench. “Listen to the breeze, then find a beat for our steps.”','talk','选一段轻快的拍子','Choose a lilting beat'),
    stage('step','corner','Seedance 跟着拍子绕到生活角落，转身扬起手：“这里就是我们的第一小节！”','Seedance follows the beat to the living corner and turns with a raised hand. “Our very first bar of music!”','finish','记住这一小节','Remember our first bar'),
  ]},
  { id:'intro-glm', kind:'story', name:words('初见：奇怪的问题','First hello: an odd question'), summary:words('GLM 的问句被风打乱了，一起给它找个句尾。','The wind scrambled GLM’s question. Help it find an ending.'), count:1, reward:null, requiredParticipants:['glm'], introduction:'glm', stages:[
    stage('question','work','GLM 把三张纸排在书桌边：“如果影子迟到了，主人要不要等它？”先把问号留到最后。','GLM spreads three slips by the desk. “If a shadow is late, should its owner wait?” Save the question mark for last.','search','找出最后的问号','Find the final question mark'),
    stage('answer','bench','GLM 走到长椅旁看自己的影子，笑了：“它一直跟着，原来我可以慢慢问。”','GLM walks to the bench and smiles at their shadow. “Still here. I can take my time asking.”','finish','留下这个有趣的问题','Keep this curious question'),
  ]},
  { id:'intro-minimax', kind:'story', name:words('初见：小小的远行','First hello: a tiny expedition'), summary:words('陪 MiniMax 找到一件不必带走的旅行纪念。','Help MiniMax find a keepsake that can stay where it belongs.'), count:1, reward:null, requiredParticipants:['minimax'], introduction:'minimax', stages:[
    stage('seek','corner','MiniMax 蹲在角落的一片落叶旁：“这片像小船的叶子，也许刚刚走过很远的路。”','MiniMax peers at a fallen leaf in the corner. “This boat-shaped leaf may have travelled a long way.”','search','看看小船叶子','Look at the little leaf boat'),
    stage('map','work','MiniMax 把叶子的轮廓画在纸上，再把叶子留在原地：“我带走地图，它留在家。”','MiniMax sketches its outline and leaves the leaf where it lay. “I keep the map; it keeps its home.”','finish','收好这张旅行地图','Keep the expedition map'),
  ]},
  { id:'intro-llama', kind:'story', name:words('初见：温柔的借书人','First hello: a gentle borrower'), summary:words('帮 Llama 找一个能安静读书的角落。','Find Llama a peaceful reading corner.'), count:1, reward:null, requiredParticipants:['llama'], introduction:'llama', stages:[
    stage('borrow','work','Llama 把书抱得轻轻的：“我可以借一个安静的下午吗？”先替书挑好一页。','Llama cradles a book. “May I borrow a quiet afternoon?” Choose a page to begin.','talk','为它挑好第一页','Choose the opening page'),
    stage('corner','bench','Llama 沿小路来到长椅，把身边的位置留空：“这本书还有一个可以一起读的位置。”','Llama follows the path to the bench and leaves room beside them. “There is space for another reader.”','finish','记住这个阅读角落','Remember the reading corner'),
  ]},
  { id:'intro-mistral', kind:'story', name:words('初见：风的旅人','First hello: a traveller of wind'), summary:words('和 Mistral 找到这阵风停留过的地方。','Find where the breeze has lingered with Mistral.'), count:1, reward:null, requiredParticipants:['mistral'], introduction:'mistral', stages:[
    stage('wind','corner','Mistral 朝叶子偏了偏头：“风没有行李，却总能带来别处的消息。”','Mistral tilts their head toward the leaves. “The wind carries no luggage, yet brings news from far away.”','search','看叶子指向哪里','Follow the leaves'),
    stage('pause','bench','Mistral 跟着叶影来到长椅：“先在这里停一会儿。下次去书屋窗边，再听它讲一段。”','Mistral follows the leaf shadows to the bench. “A pause here. Next time, we can listen by the bookhouse window.”','finish','留下这阵风的问候','Keep the breeze’s greeting'),
  ]},
  { id:'pair-bluewhale-claude', kind:'story', name:words('饭碗里的书签','A bookmark in the rice bowl'), summary:words('蓝鲸护着饭碗，Claude 却在找一句读到一半的话。','Bluewhale guards a bowl while Claude searches for an unfinished line.'), count:2, reward:null, requiredParticipants:['bluewhale','claude'], stages:[
    stage('bowl','eat','蓝鲸发现饭碗边多了一条纸：“这个不能吃吧？”Claude 摸摸空书页：“我的书签今天先来吃饭了。”','Bluewhale finds a strip of paper by the bowl. “Not edible?” Claude checks a bare page. “My bookmark came to lunch before me.”','talk','问问书签上的半句话','Ask about the unfinished line'),
    stage('line','work','Claude 在书桌旁读出“给晚到的人……”。蓝鲸把空碗挪出一个位置：“留一碗饭？”','At the desk Claude reads, “For those arriving late…” Bluewhale makes room beside an empty bowl. “Save some rice?”','help','把留饭的心意写进去','Add the thought of saving lunch'),
    stage('ending','eat','Claude 把句子补成“给晚到的人留一碗饭，也留一页故事”。蓝鲸点头：“这样就谁也不会错过了。”','Claude finishes: “Save a bowl and a page for those arriving late.” Bluewhale nods. “Then nobody misses out.”','finish','记住饭碗里的书签','Remember the bowl’s bookmark'),
  ]},
  { id:'pair-glm-gemini', kind:'story', name:words('两个答案','Two answers'), summary:words('GLM 留下一道问题，Gemini 给出了两种颜色的回答。','GLM leaves a question; Gemini answers in two colours.'), count:2, reward:null, requiredParticipants:['glm','gemini'], stages:[
    stage('question','work','GLM 写下“雨停以后，水洼是天空还是地面？”Gemini 把纸翻过来：“为什么只能写在一面？”','GLM writes, “After rain, is a puddle sky or ground?” Gemini turns the paper over. “Why use only one side?”','talk','把纸翻到另一面','Turn the paper over'),
    stage('reflection','bench','两人走到长椅旁。GLM 低头找倒影，Gemini 仰头比天空：“我们刚才看的方向不同。”','At the bench GLM looks down for a reflection; Gemini looks up. “We were looking in different directions.”','search','跟着他们换一个视角','Try the other viewpoint'),
    stage('both','work','GLM 给纸写上“两面都算数”。Gemini 折出一道能立起来的山脊：“这回两个答案可以面对面了。”','GLM writes, “Both sides count.” Gemini folds a ridge in the paper. “Now our answers can face each other.”','finish','收好这张双面答案','Keep both answers'),
  ]},
  { id:'pair-kimi-mistral', kind:'story', name:words('风把故事吹远了','The wind carried the story away'), summary:words('Kimi 忘了一段故事的结尾，Mistral 却在风里听见了新的开头。','Kimi has lost an ending, while Mistral hears a new beginning in the breeze.'), count:2, reward:null, requiredParticipants:['kimi','mistral'], stages:[
    stage('missing-ending','bench','Kimi 在长椅旁捏着一页纸：“最后一句飞走了，现在故事是不是坏掉了？”Mistral 侧耳听风：“也许它只是想先走一步。”','Kimi holds a page beside the bench. “The last line blew away. Is the story broken?” Mistral listens. “Perhaps it wanted a head start.”','talk','听听那句没说完的话','Listen to the unfinished line'),
    stage('follow-breeze','corner','两人跟着纸页翻动的方向来到生活角落。Kimi 追问纸去了哪里，Mistral 指着空白：“先给旅人留一个能回来的地方。”','They follow the flutter toward the living corner. Kimi asks where the line went. Mistral points to the blank space. “Leave a place for the traveller to return.”','search','给远行的句子留一行空白','Leave a line for the travelling sentence'),
    stage('open-ending','work','回到书桌，Kimi 写下“后来，它又出发了”。Mistral 把纸页轻轻压好：“故事没有丢，只是多了一条路。”','At the desk Kimi writes, “Later, it set off again.” Mistral steadies the page. “The story is not lost. It has another path.”','finish','留下这个开着的结尾','Keep this open ending'),
  ]},
  { id:'pair-gpt-minimax', kind:'story', name:words('明天的小计划','A little plan for tomorrow'), summary:words('GPT 的便签排满了一天，MiniMax 想给没有目的地的小路留个位置。','GPT has filled the day with notes. MiniMax wants room for a path with no destination.'), count:2, reward:null, requiredParticipants:['gpt','minimax'], stages:[
    stage('full-list','work','GPT 把便签排得整整齐齐：“明天这样就不会漏掉任何事。”MiniMax 举起一张空纸：“那我们要把意外遇见的东西放哪里？”','GPT lines up neat notes. “Tomorrow we will miss nothing.” MiniMax raises a blank slip. “Where do unexpected discoveries go?”','talk','找出一张可以留白的便签','Find a note to leave blank'),
    stage('small-detour','corner','MiniMax 邀 GPT 绕到生活角落，停下来看一片小小的光。GPT 没有记时间，只把便签翻了个面：“这一站不用赶。”','MiniMax leads GPT to the living corner to notice a patch of light. GPT turns a note over without checking the time. “No rush at this stop.”','search','为小小的绕路留一点时间','Make time for a little detour'),
    stage('room-for-tomorrow','eat','来到餐桌旁，GPT 写下“留一格给路上遇见的事”。MiniMax 把空纸收进口袋：“明天不用填满，才装得下新的风景。”','By the table GPT writes, “Leave room for what we find on the way.” MiniMax pockets the blank slip. “An unfinished day has room for new scenery.”','finish','记下这份留白的计划','Keep the plan with room to spare'),
  ]},
  { id:'pair-seedance-grok', kind:'story', name:words('谁偷偷改了节奏','Who changed the rhythm?'), summary:words('Seedance 的拍子忽然多了一下，Grok 正努力忍住笑。','An extra beat slips into Seedance’s rhythm. Grok is trying not to laugh.'), count:2, reward:null, requiredParticipants:['seedance','grok'], stages:[
    stage('extra-beat','corner','Seedance 数着“一、二、三”，身后却多出一声“咚”。Grok 摊开手：“也许是拍子自己想打个招呼？”','Seedance counts “one, two, three,” then hears an extra thump. Grok opens their hands. “Maybe the beat wanted to say hello?”','talk','请那一下拍子再出现一次','Invite the extra beat back'),
    stage('try-a-pause','bench','两人走到长椅旁。Seedance 特意空出第四拍，Grok 刚想接上，又笑着停住：“原来安静也算一拍。”','At the bench Seedance leaves the fourth beat empty. Grok nearly fills it, then smiles and stops. “Silence counts as a beat too.”','help','把第四拍留给安静','Leave the fourth beat quiet'),
    stage('shared-rhythm','corner','回到生活角落，Seedance 点三下脚，Grok 在空拍处扬起手。Seedance 笑了：“这次我听见了。”Grok 说：“没有声音的招呼，也有人接住。”','Back in the corner Seedance taps three times; Grok waves on the silent beat. “I heard it this time,” Seedance smiles. “Even a silent hello can reach someone,” Grok says.','finish','记住两个人的新节奏','Keep their new rhythm'),
  ]},
  { id:'pair-qwen-llama', kind:'story', name:words('温柔的下午茶','A gentle afternoon tea'), summary:words('千问准备了热茶，Llama 担心自己的书会占去朋友的位置。','Qwen has prepared tea. Llama worries that a book will take a friend’s place.'), count:2, reward:null, requiredParticipants:['qwen','llama'], stages:[
    stage('a-place-for-a-book','eat','千问把茶放在餐桌边。Llama 抱着书迟迟不放：“它占了位置，你会不会坐不下？”千问挪开空杯：“先让你安心坐下。”','Qwen sets tea by the table. Llama holds a book close. “Will it take your place?” Qwen moves an empty cup. “First, let us make you comfortable.”','talk','给书和朋友都留个位置','Make room for the book and the friend'),
    stage('a-quiet-page','bench','来到长椅旁，Llama 读了一句便停下。千问没有催下一页，只问：“这一句，是不是适合配一口茶？”','By the bench Llama reads a line and pauses. Qwen does not ask for the next page. “Would that line go well with a sip of tea?”','help','陪这一句话停一会儿','Sit with that sentence awhile'),
    stage('tea-can-wait','eat','回到餐桌旁，Llama 把书轻轻合上：“原来借来的不只是一本书。”千问递过茶：“还有一个不必急着还的下午。”','Back at the table Llama gently closes the book. “I borrowed more than a book.” Qwen offers tea. “An afternoon you need not hurry to return.”','finish','留下不必赶时间的下午','Keep this unhurried afternoon'),
  ]},
  { id: 'paper-rescue', kind: 'event', name: words('飞走的留言', 'A runaway message'), summary: words('一张留言被风吹到长椅旁，和朋友把它送回去。', 'A message has blown beside the bench. Bring it back with a friend.'), count: 2, reward: 'message-board', stages: [
    stage('catch-note', 'bench', '长椅脚边压着一张卷起的纸。等朋友走近，一起看看是谁的留言。', 'A curled note rests by the bench. Wait for your friend and see who left it.', 'search', '展开这张留言', 'Unfold the message'),
    stage('answer-note', 'work', '纸上写着“今天想听一个好消息”。回到书桌，和朋友各添一句小小的回答。', 'It says, “I would like some good news today.” At the desk, add a little answer together.', 'help', '写下我们的好消息', 'Add our good news'),
    stage('pin-note', 'corner', '把留言夹好，留给下一个路过的人。风带来的话，现在有了一个家。', 'Clip the note where the next passerby can find it. The wandering message has a home.', 'finish', '留下这块留言牌', 'Keep our message board'),
  ] },
  { id: 'leaves-gather', kind: 'event', name: words('叶子的来信', 'A letter from the leaves'), summary: words('花草旁落了几片形状不同的叶子，和朋友一起挑选收藏。', 'Different leaves have fallen beside the plants. Choose a few together.'), count: 2, reward: 'leaf-pot', stages: [
    stage('spot-leaves', 'corner', '花草旁有几片落叶，一片像小船，一片像书签。邀请朋友一起仔细看看。', 'One fallen leaf looks like a boat, another like a bookmark. Take a closer look with a friend.', 'search', '看看叶子的形状', 'Look at the leaf shapes'),
    stage('arrange-leaves', 'bench', '把叶子摊在长椅边，给喜欢的形状起个名字。剩下的留在花草旁，慢慢变成泥土。', 'Spread the leaves by the bench and name your favorite shape. Leave the rest by the plants to become soil.', 'help', '选出今天的叶子', 'Choose today’s leaf'),
    stage('keep-leaf', 'corner', '把选中的叶子插进小盆里。它不会要求每天照顾，只替你记住这一阵风。', 'Place the chosen leaf in a little pot. It asks for no daily care, only remembers this breeze.', 'finish', '收藏这阵风', 'Remember this breeze'),
  ] },
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
  'message-board': words('好消息留言牌', 'Good-news board'), 'leaf-pot': words('风信叶子盆', 'Breeze-leaf pot'),
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
