# 0.7–0.9 内容、动作与资源审计

2026-10-23。审计对象为 `codex/feature-ai-village-entrance`，基线 HEAD `963a501947b74498d0924a1c6892aecd3ef116bc` 及本轮工作树。本文记录实际源文件、消费者与资源缺口，不构成新美术签收，也不代表 M5/M6 已交付。

## 1. 已核实的素材边界

- `art/approved/manifest.json` 只列两张阶段 1 批准母图：`bluewhale-neutral-v01.png` 和 `courtyard-empty-v01.png`，记录用户确认“视觉效果确认通过，可以进入阶段2”。庭院背景为 1086×1448，SHA-256 为 `6e0fbd6748abcc8905bc5c32012a39a0fd2fea1a9f0340ffa3a3b7b869937f6d`。
- `assets/characters/bluewhale/manifest.json` 是 `phase2-motion-approved`、`approvedForRelease: true`，20 个部件来自 `art/work/phase2/` 的 hair、body、arms-tail、faces、ahoge、torso-skirt 母图。
- 另六位角色 manifest 均是 `agent-reviewed-assembly`、`approvedForRelease: true`，其既有授权记录为 `delegated-agent-review` / “中途不需要额外验收”。来源分别为 `art/work/roster/claude-v02.png`、`gemini-v02.png`、`gpt-v01.png`、`grok-v01.png`、`kimi-v01.png` 加 `kimi-bowl-v02.png`、`qwen-v01.png`。这里沿用已有发布状态，不把委托审核改称本轮用户逐张人工批准。
- 本次逐项检查七份角色 manifest 的 **116 个部件**：文件全部存在，SHA-256 全部匹配。蓝鲸之外每位 16 个部件；这不是运行时纹理总数。
- `assets/scenes/courtyard/manifest.json` 是 `phase3-scene-approved`、`approvedForRelease: true`，记录用户确认“阶段3验收通过，继续推进”。其中 **14 个文件**全部存在且 SHA-256 匹配。
- 已实际查看 `art/work/phase3/furniture-v01.png` 原图。它只有四个对象：带书本与笔的书桌、空餐桌、圆坐垫、一碗白米饭。`art/prompts/phase3.json` 也明确要求这四个对象。不能将它描述成已有茶水架、游戏桌、书柜、花圃、秋千或玩具篮母图。
- `assets/scenes/` 当前只有 `courtyard/`；`art/work/` 当前只有 `phase2/`、`phase3/`、`roster/`。本次在实际 asset/work 清单与 manifest 中没有找到 AI 书屋或上述新增家具的批准母图。QA 截图、缩略图、候选入口图不作为新家具原画来源。

阶段 3 运行文件为 `desk.png`、`desk-back.png`、`desk-front.png`、`table.png`、`table-back.png`、`table-front.png`、`cushion.png`、`bowl.png`、四张 work/eat 手部、`rest-pose.png`、`background.png`。桌面前后层来自原图的可对齐裁剪；并非每张母图都进入实时纹理集合。批准范围与生产资源选择仍以 manifest 和 `asset-selection.ts` 为准。

## 2. M1 七位居民的新增表现

消费者链为 `life-catalog.ts` → `life-engine.ts::lifePresentation` → `frame/scene.ts` → `art/animation.ts::applyLifePose` → `PaperDoll.apply`。使用现有部件枢轴、层级和四张表情，不修改原画、朝向或存档中的世界位置。

| 居民 / 动作 ID | 实际驱动部件 | 动作说明 | 生活偏好消费者 |
| --- | --- | --- | --- |
| 蓝鲸 / `whale-tail` | `tail-root`、`tail-fin`、`arm-left`、`head` | 尾根舒展、尾鳍摆动，配合一侧手臂和歪头 | 米饭；`activityWeight` 偏向 eat，`snackReaction` 对 rice 给专属回应 |
| Claude / `thoughtful-note` | `arm-right` 的 rotation/y、`head`、`arm-left` | 抬手停顿、侧头思考，另一只手轻动 | 热茶；偏 read，傍晚更活跃 |
| Gemini / `cloud-frame` | 两臂 rotation/y、`head` | 双手抬起框景，头部左右观察 | 水果；偏 tend，白天与人打招呼倾向较高 |
| GPT / `neat-cuffs` | 两臂 rotation、右臂 y、`head` | 一手靠近另一侧袖口，低头整理 | 水果；偏 work，白天更活跃 |
| Grok / `playful-salute` | 右臂 rotation/y、`head`、左臂 rotation | 单臂抬高敬礼，歪头与另一只手呼应 | 水果；偏 sit/eat，傍晚社交倾向较高 |
| Kimi / `quiet-stretch` | 两臂 rotation、`body` rotation、`head` | 安静伸展双臂，身体和头部小幅反向倾斜 | 热茶；偏 rest/read，夜间更放松 |
| Qwen / `leaf-greeting` | 左臂 rotation/x、右臂 rotation、`head` | 左手拂过、右手回应、轻轻点头 | 热茶；偏 tend，白天更活跃 |

动作是有限序列，普通专属动作 3.6 秒后归零；告别 1.5 秒、受打断反应 1.2 秒。位移与旋转作用在独立部件，`root` 和两腿不被新增微动作改变；没有整张立绘反复缩放或弹跳。减少动态模式跳过这些附加动作。新增动作可调用不等于每个 UI 分支都已触发；例如 `interrupted` 的最终触发范围应以运行时实际接入和视觉验收记录为准。

自主社交的 `wave` 驱动抬起的右臂和手势；`listen` 侧头、点头并抬左臂；`offer` 双臂向前；`point` 单臂指向并转头；`farewell` 由躯干、头与右臂收尾；`waiting` 轻侧头。社交配对实际寻路、停顿并释放，观察工作/读书时不抢走被观察者座位；只保存当前 `life.social`，不自动完成心愿、增加关系或发纪念物。

模拟昼夜由 `ticks` 派生，每 30 分钟可见模拟时间为一小院日，从 14:00 起算。day=06:00–16:59、dusk=17:00–20:59、night=21:00–05:59；只影响选择权重及生活节奏，不覆盖 `home.environment`。隐藏与用户暂停由现有 controller 停止 tick，没有离线补算。

`favoriteProp` 是受控角色描述字段，不是已经新增的独立家具、库存或道具交互。新增动作零 PNG、零独立动画计时器，复用现有帧循环。部件正确性和减少动态测试见 `tests/life.spec.ts`；最终观感、GPU 和实际 DPI 不由这些纯逻辑测试替代。

## 3. 七件纪念物及其真实消费者

七件均由本仓 `frame/play-art.ts::PlayArt` 用 Pixi `Graphics` 原创绘制。它们是体量有限的代码矢量纪念物，不是新生成并经人工批准的 PNG，也不是待建大型家具的正式占位替代品。

| 纪念物 ID / 名称 | 首次完成来源 | 实际绘制内容 | 参与人数 |
| --- | --- | --- | --- |
| `rice-bowl` / 团圆饭碗 | `lost-rice` 蓝鲸丢失的白米饭 | 白米椭圆、蓝色碗身、碗底；不是直接贴入既有 `bowl.png` | 2 |
| `page-marker` / 安静书签 | `quiet-page` 安静的一页 | 小书页、中缝与绿色书签 | 2 |
| `wind-ribbon` / 风语纸带 | `wind-notes` 风带来的便笺 | 悬挂纸条、短线条与弯曲纸带 | 2 |
| `whale-token` / 小鲸记号 | `find-whale` 找找小鲸鱼 | 蓝鲸身体、尾部、浅腹、眼睛与喷水线 | 1 |
| `desk-star` / 书桌小星 | `tidy-desk` 书桌归位 | 木色小底座与五角星 | 1 |
| `snack-tray` / 午后茶盘 | `snack-table` 茶点轮到你 | 椭圆茶盘、茶杯、杯中茶和小圆点心 | 2 |
| `star-mobile` / 三颗星挂饰 | `stargazing` 三个人的星空 | 横杆、三根悬线与三颗小星 | 3 |

持久事实继续存于 `neighborhood.memories`；`living-engine.ts::playAction` 只有在完整阶段、移动与观察后接受最终输入，确认后的首次事实用于解锁。重复游玩增加次数，保留首次 eventId/参与者/日期；`play.lastEventId` 拒绝最近完成事件的重放。挂点存于同一世界的 `play.decorations`，不另外建立收藏数据库。

实际访问与展示链：

1. `PlayPanel.tsx` 在既有入口内显示“故事里的小纪念”，有锁定说明、选择位置、取消和确认保存。
2. `living-engine.ts::placePlayDecoration` 检查解锁和受限挂点，走 runtime 的同一 CAS 保存；确认前不修改当前世界。
3. `keepsake-observation.ts::keepsakePositions` 为绘制和观察提供同一坐标：window=(148,155)、door=(248,172)、wall=(72,155)。同挂点按固定纪念物 ID 顺序，以 `(n%2)*27` 横移、`floor(n/2)*30` 纵移排列；可设置 null 收起。它们不占家具座位。
4. `PlayArt.paint` 每帧复用同一 `Graphics`，放在实际 `worldContent`；照片渲染同一场景，因此包含已放置纪念物。`whalePoint` 还复用 `whale-token` 绘制寻找游戏的可点击目标。
5. `keepsakeObservation` 只在没有剧情/茶会/邻里/自主社交时，由附近空闲居民在有限时间窗产生一句回忆气泡；`frame/scene.ts` 同时调用 `point` 动作。只有已摆放对象被观察，不伪造历史发现或产生额外奖励。

当前消费者能证明“有世界内绘制、有实际近处居民反应、有照片呈现”。纪念物没有独立座椅占位、生产功能或新小场景；不能将这些挂饰描述为已交付茶水架、书柜或玩具篮。

## 4. M5 家具候选：现有原料、身份与准入缺口

当前正式家具身份仍为 work/eat/bench 与可替换的 rest/books/plant 角落；编辑组仍是 `work`、`eat`、`bench`、`corner`。合法活动位来自 `homeScene`，不是画面中的任意坐标。

| 当前编辑组 | 已存在的合法活动位，单位为世界坐标 | 现有消费者 |
| --- | --- | --- |
| work | 默认 (102,283)，内移 (126,265) | work、整理书桌、故事调查 |
| eat | 默认 (175,374)/(273,374)，左移 (121,374)/(219,374) | eat、茶会、茶点与故事同桌 |
| bench | 默认 (70,239)/(170,239)，右移 (94,239)/(194,239) | sit、双人邻里、故事停留 |
| corner | 默认 (274,245)，下移 (274,307) | rest 或 reading 的 read 或 garden 的 tend |

以下 ID 是清楚标记的 **拟议身份**，尚未加入正式 catalog、schema、资源白名单或布局校验。复用已有活动位只是首选设计方向；新物件的真实足迹、遮挡、命中和路线未验证前，其正式合法锚点集合仍为空。不能直接把旧角落点认定为较大新物件的合法落点。

| 拟议物件 | 锚点/互动方向与人数 | 已有可复用原料 | 实际素材与实现缺口 |
| --- | --- | --- | --- |
| `tea-rack` 茶水架 | 优先 corner 二选一；1 位取茶，分享继续使用现有 eat 两席 | 已批准餐桌、饭碗；既有代码茶杯与茶盘 | 没有批准茶水架原图；饭碗不是茶具柜。需架体正视浅俯视透明图、杯/壶独立层、前沿遮挡、取茶点与返回餐桌规则 |
| `game-table` 小型游戏桌 | 优先作为 eat 组的受控替换；2 位面对同一桌面 | `table-back.png` / `table-front.png` 已批准空桌层，可复用真实桌体 | 没有专门游戏桌/棋盘/棋子批准原画。可先复用批准餐桌验证规则；若新增棋盘必须明确为新绘制内容并通过视觉评审，不能声称原母图已有棋盘。需要左右席位、占用释放、轮次输入与取消规则 |
| `bookcase` 书柜 | 优先 corner；1 位取书/读书，共读继续现有 bench 两席 | 已存在 reading 布局 `books` 的代码矢量书架、书本与 read 行为 | 没有批准书柜 PNG；已有小型矢量书架是现有功能，不等于一件新大型书柜原画。新增书柜需区分其新互动价值、柜体与书层、足迹、手部接触和可访问高度 |
| `flowerbed` 花圃 | 优先 corner；1 位照料，第二位只能在另经校验的旁观点观察 | garden 布局 `plant` 矢量盆栽、浇水壶与 tend | 没有批准花圃原图；现有盆栽不是地面花圃。需花床/土面/植物层、边缘足迹、浇水接触点，验证是否占据原角落之外通道 |
| `swing` 秋千 | 暂无正式可用锚点；最多1位坐乘，旁观位置另定 | 只有已批准静态 rest 坐姿，可作角色比例参考 | 没有批准秋千或摆荡坐姿。不能旋转整张 rest 图冒充制作完成。需后支架/绳/座面/前层、手握/腿部姿态、摆幅包围盒与碰撞、减少动态静止姿态；corner 的现有点不能替代占地验证 |
| `toy-basket` 玩具篮 | 优先 corner；1位取放，寻找小鲸鱼仍采用经过校验的场景点 | 本轮 `whale-token` 代码图形、寻找游戏规则 | 没有批准篮体或布偶母图；小鲸记号不是毛绒玩偶图。需篮身前后层、内部道具、取放姿态、篮口触点、物件来源及最多同时显示数 |
| `bench-trim` 长椅装饰 | 若仅装饰，随 bench 两个锚点移动；仍只保留原2席 | 原 `NeighborhoodArt` 代码长椅、既有挂饰颜色与线条 | 没有独立批准长椅装饰栅格图。装饰不可遮挡坐姿、改变座位却未改模拟；若复用现有矢量小装饰，需准确记录来源与挂接变换 |

已有 reading 书架、garden 盆栽和长椅都直接画在 `frame/neighborhood-art.ts`，没有独立 PNG 资产。本轮没有将它们重命名为 M5 的新家具成果。

每个新家具进入生产前仍需同一份物件定义驱动：稳定 ID、批准资源引用或明确原创代码绘制来源、有限锚点、足迹/遮挡层、活动位和命中区域、人数/独占键、角色反应、寻路、照片与冷恢复验证。资源缺口不阻塞对既有批准桌体的逻辑试验，但试验应标注 development preview，不能用几何占位通过正式美术门禁。

## 5. M6 AI 书屋与入口独立门禁

当前没有批准的 AI 书屋母版，亦没有正式 `library` 场景资源目录。庭院背景、门庭远景、QA 截图不能重新标注为书屋背景。若继续做书屋，只允许显式的 **development preview**，其几何/交互样板不得进入正式发行资源选择器。

书屋制作规格至少需要：与既有 360×480 世界和角色 108px 显示尺度对应的场景设计、门口与安全落点、可走区域/遮挡、书柜和阅读席位的独立前后层、资源清单及原始来源。实际交付分辨率与纹理预算必须按显示尺度和资源测量确定，不提前放宽既有限制。共享居民与长期进度、区域存档迁移、切换中的 owner/CAS/暂停、资源按需加载和退出释放均须先通过逻辑与隔离 profile 验证。

`assets/entrance/manifest.json` 当前仍是 **ART_REVIEW**，来源注明人工批准待定；该状态与书屋是两件独立事项。本审计不修改批准状态、生产选择器、首帧回执或揭幕时机。没有人工批准时，梦境门庭候选与任何未来书屋候选均不能因自动测试通过而成为正式美术。

## 6. 审计复现与证据边界

本次执行了文件清单枚举、七角色/庭院 manifest 读取、116 个角色部件和14个庭院文件 SHA-256 对照、阶段3家具母图像素查看，以及 `life-*`、`animation.ts`、`PlayArt`、`keepsake-observation`、`PlayPanel`、`home-state`、`neighborhood-state` 的消费者检查。

可复现入口：`rg --files packages/ai-village/assets packages/ai-village/art/work`；按各 manifest 的相对 file 和 sha256 用 `Get-FileHash -Algorithm SHA256` 核对；原图为 `packages/ai-village/art/work/phase3/furniture-v01.png`。该审计不运行生成工具、不下载额外图片、不改候选状态，也不写真实用户 profile。

本轮实际截图、录像、性能与失败记录集中于本目录 `qa/`。本文不将某轮中途截图解释为最终包验收；最终构建、包身份、实际尺寸动画观感及未覆盖 GPU/DPI 项以主实施与 QA 最终记录为准。
