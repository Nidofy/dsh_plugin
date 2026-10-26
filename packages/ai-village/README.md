# AI 社区 · 0.13.0-preview.5 · DSH rc.3 适配候选

此候选仅面向官方 DSH `0.2.1-rc.3`，使用独立的固定源码和 npm lock。世界仍为 world14/content10/region2/frame11，保持已有三场景、角色资源和存档规则。完整原生门禁通过前不标记正式兼容；验证进展见 [rc.3 实施记录](../../docs/ai-village/compatibility/DSH_0.2.1_RC3_RESULTS.md)。其他插件和全仓历史通道仍为 rc.2，不据此声明兼容 rc.3。

下方保留 `0.13.0-preview.3` 的功能与历史验收说明，其固定包不被本次构建覆盖。

---

# AI 社区 · 0.13.0-preview.3 · 书屋与茶会广场

从社区地图往返白鲸小院、AI书屋和茶会广场。书屋使用独立绘本背景、家具与十二位居民各自的读书/坐姿接触层；茶会广场可以挑茶休息，邀请三位朋友一起摆杯垫，留下一枚三叶茶签。湖畔花园和工坊仍为规划地点。

茶会故事可以取消、保存后继续和重复体验。首次朋友与日期永久保留，重玩只增加次数；收起的茶签不会被重玩自动挂回。书屋走向家具和普通挑茶保留目标，在短暂拥挤时有限等待或重新寻路，超时给出反馈；显式取消始终可用。

世界 world14 / content10 / region2 / frame11，冻结旧world13解码器。三地区复用同一世界、时钟、存档和相册；只加载当前区域与在场居民资源。地图、书屋和茶会美术均获得独立用户批准；蓝鲸方向动画尚未合格，不在生产包中。

本版实际运行、离线包身份、性能结果与验证边界见 [当前状态](../../docs/ai-village/community-next/CURRENT_STAGE.md) 和 [获批场景验收](../../docs/ai-village/community-next/APPROVED_SCENES.md)。0.13.0-preview.1 为已冻结的开发门禁包，不能进入茶区；pre2 为首轮发现动态阻挡问题的未合格候选，保留审计。本版及这些历史包的身份不可互相替代。此前0.12地图与点击行走验收见下方历史记录。

---

# AI 小院 · 0.12.0-preview.1 · 社区地图与散步

HUD 的 **社区地图** 展示白鲸小院、AI 书屋和三个规划地点。先选择地点查看介绍，再点“前往”，全体在场居民一起旅行；暂停状态、手账和相册保留。规划地点不能进入。窄窗有地点列表，展开后可点地图节点，Esc 逐层返回。绘本地图已获用户视觉批准，六个独立图层仅在地图打开时加载，关闭即释放引用，资源异常时回退导航示意。书屋正式美术和角色方向样板仍独立待签收，没有启用。

轻点居民选中，再点合法空地即可沿路径散步；原有抓取拖放与空地拖动镜头保留。路径和终点有反馈，“停止散步”或场景中的 Esc 可取消。家具仍通过居民活动入口使用。故事进行中不会被点击行走打断，隐藏/暂停不继续走动，重启恢复剩余路线。临时堵路最多重规划三次，失败停在安全位置并提示。

世界 **schema13 / content9 / bookhouse2 / frame10**，scene3/rules4/region1/preferences3 保持。旧 1–12 按冻结解码器读取，新增独立、有界 `manualMove`，没有用家具活动伪装散步。首次升级保存继续保护旧指针和快照原字节。回退须保留完整新 profile，在隔离 profile 恢复旧原件；旧包不能直接覆盖新存档。

离线候选包为 `dist/nidofy-dsh-ai-village-0.12.0-preview.1.tgz`。实现、实际测试和未完成的美术/新区域阶段见 [社区开发记录](../../docs/ai-village/community-next/IMPLEMENTATION.md) 与 [验收结果](../../docs/ai-village/community-next/RESULTS.md)。茶会广场仅完成几何设计夹具及路径预检，尚无完整可玩区域，保持规划中。以下为原版本历史记录。

---

# AI 小院 · 0.11.0-preview.1 · 邻里的回忆册

在 **手账 → 回忆 → 共同回忆册** 按居民查看关系。只展示已保存的共同活动与首次故事来源，未发现的组合可以慢慢认识；3/8/15 对的称号自动点亮，不必领取，也不要求收集全部 66 对。来源会区分每对活动次数与整个故事的重玩次数。

Seedance、GLM、MiniMax、Llama、Mistral 首次确认入住后，各有一段真实走动、独特小动作与台词的初见。完成永久记住；取消后、或从旧版升级时已入住的新人，可在 **居民／心愿 → 初次见面** 开始。已有活动时不会被强制打断，保存未知时不会追加剧情写入。

**心愿 → 全部心愿** 提供固定角色组合故事；回忆是主要奖励，不额外占用挂饰位置。书屋新增 **看看书架里的谜题**：两位朋友在书柜找页、到桌边按种子／发芽／开花排好、再走到窗边保存。可以错排、重排、取消与重玩，没有倒计时惩罚；重玩保留首次参与者。

世界更新为 **schema12 / content9 / bookhouse2 / frame9**，scene3/rules4/region1/preferences3 不变。旧1–11先按冻结解码器验证，再为旧共读补上类型和空谜题状态；在途坐标、首次回忆、RNG、时钟与旧原件保持。仍使用同一 owner/CAS、48 KiB 世界预算及最多七人在场。回退时保留完整新 profile，在独立 profile 恢复升级前备份；不要用旧包覆盖新存档。

书屋分层原画为**独立待签收候选**，没有替换正式运行资源。十二人视觉基线、美术限制、真实验收、安装包身份与未完成项见 [0.11 交付记录](../../docs/ai-village/v011/RESULTS.md)。未经视觉签收不把开发场景称作正式美术。

---

# AI 小院 · 0.10.0-preview.1 · 书屋里的共同回忆

新增 Seedance、GLM、MiniMax、Llama、Mistral 五位可选居民，使用已完成的独立部件美术。**居民 → 全部居民 → 安排入住**可从十二位中选择，最多七位同时在场；保持原七头像入场画面及资源预算。五位有各自的生活偏好、台词与小动作。

在**布置 → 家具 → 前往 AI 书屋**，从**心愿**邀请一位朋友体验“夹在书里的微光”：真实走到书柜选主题、在阅读桌写下一句话、在窗边共同读完，完成后保存首次参与者/时间与微光书签。重复体验只增加次数；随时取消不会扣进度。隐藏、暂停与离线不推进。进行中可冷恢复，不能旅行或开始其他活动。

**居民**展示共读回应，**心愿**提供有界活动与可选目标，**布置**可把书签留在书屋窗边、带回小院或收起，**手账**与收藏/已确认消息显示同一保存事实。位置与回忆走同一次CAS；回执未知只读核对，不重放写入。庭院三条故事、小游戏和原有旅行限制继续保持。

世界格式为 **schema11 / scene3 / rules4 / content8 / region1**，偏好3，frame8。旧1–10格式先按旧七人目录严格验证，再只补五位配饰默认值与空书屋剧情；保留角色脚点、在途活动、时钟/RNG、手账、收藏和相册。首次新格式保存保护原指针/快照。旧插件不能直接读11，回退需停止插件、保留整份新profile，在独立profile恢复升级前备份与旧包。

书屋场景仍是明确标注的**开发样板**。独立制作的正式场景概念候选位于[美术门禁](../../docs/ai-village/BOOKHOUSE_SCENE_ART_REVIEW.md)，尚未通过精确几何/分层/视觉验收，不进入运行包。当前批准门庭美术保持不变。

实现、实际包身份与验收边界见[本轮记录](../../docs/ai-village/life-content/RESULTS.md)。以下均为保留的历史版本说明。

---

# AI 小院 · 0.9.0-preview.2 · 故障后重新入场

连接、资源或场景故障后回到门前，点击画面开门，再显示七居民加载进度。资源与真实首帧确认后回到当前庭院或书屋；恢复失败重新关门。后台连接恢复不会自动越过点击，存档不会重置，未知保存结果仍只读核对；恢复上一版本保留在“诊断与恢复”中，由用户明确操作。已按用户2026-10-23的明确授权启用现有梦境门庭美术，原PNG和几何保持不变；美术加载失败时使用离线轻量门面。

验证见 [恢复入场记录](../../docs/ai-village/reentry-recovery/RESULTS.md)。

---

# AI 小院 · 0.9.0-preview.1 · AI 书屋开发样板

在 **布置 → 家具** 选择前往书屋，全体在场居民一起进入独立室内区域。可以选择居民去书柜读书、到阅读桌记笔记、在窗边坐下，也可自由活动、拖放、拍照和返回庭院。书屋的背景与固定家具为原创代码绘制的**开发样板**，不是已批准的正式场景原画。

两区共享同一批居民、手账、收藏、好友经历、配饰、偏好与相册；只模拟当前区域，离开的区域保留居民返回落点，不做离线补算。进行中的故事/小游戏须先完成或取消；书屋内的入退住、庭院家具编辑和庭院专属活动需返回庭院进行。普通阅读和记笔记不会自动发收藏奖励。

当前世界 **schema10 / scene3 / rules4 / content7 / region1**，偏好3、frame7。scene3 保留庭院布局的历史契约，书屋使用独立 version1 几何。旧1–9格式按冻结解码器迁移并留在庭院，原在途活动不变，首次保存保护旧原件；旧插件不能直接读取10。区域切换仍通过同一 owner/租约/CAS 确认，未知回执只读对账。目标区域的真实首帧确认前暂停并阻止操作。

验证与限制见 [0.9 实施记录](../../docs/ai-village/v08-v09/BOOKHOUSE_IMPLEMENTATION.md)。入口 ART_REVIEW 和生产入口选择器保持不变。

以下保留历史版本说明。

---
# AI 小院 · 0.8.0-preview.1 · 偶遇与收藏

小院开放时会偶尔遇到“飞走的留言”和“叶子的来信”。在**心愿 → 此刻的小偶遇**邀请两位朋友帮忙，沿三个地点片段走动、观察并完成，留下好消息留言牌或风信叶子盆。可在**布置 → 挂饰**摆放，进入实际场景与照片；略过或取消不扣进度，以后仍有新的偶遇。隐藏与离线不推进时间。

**手账 → 回忆**新增收藏分类；**心愿 → 全部心愿**新增认识七位共同回忆居民、三对朋友共同经历、相册三张照片等可选目标。全部来自现有已保存事实，没有每日任务或第二套历史。相册尚未读取时不显示虚假数量。

当前世界 **schema9 / scene3 / rules4 / content6**，偏好3、frame6。旧1–8格式按冻结解码器迁移，首次保存保护旧原件；旧插件不能直接读取9。新字段仅为已接受/略过偶遇窗口，玩法仍使用原单owner、租约与CAS保存。新纪念物为原创代码矢量；第二场景及新的正式美术尚未交付。验证与具体边界见[0.8–0.9开发记录](../../docs/ai-village/v08-v09/IMPLEMENTATION.md)。

以下为已保留的历史版本说明。

---

# AI 小院 · 0.7.0-preview.3 · 加载角色填色修复

过场加载的七位角色从左到右依次横向填色。快速加载也会平滑显示完整顺序，显示进度不会超过真实准备进度；减少动态或跳过动画可省去这段显示动画，仍等待真实首帧确认。沿用preview.2的棋局、世界格式与全部内容。

新增 **布置 → 家具 → 棋局桌面 → 确认桌面用途**。在现有批准餐桌上铺开原创代码棋盘，复用原有两种锚点和两席；此为开发预览，没有新增正式家具原画。在 **心愿 → 全部心愿 → 餐桌上的三连棋（开发预览）** 邀请两位居民，实际到席后可点击场景棋格，或用九格面板/键盘落子。玩家执○、朋友执×，每轮双方落子同一次确认保存，轮间停留观察；结局确认才留下手账与“同桌棋子”。输赢无惩罚，随时可取消。

棋局桌面启用后，居民仍会照常用餐；预约餐桌、茶会及其他餐桌故事期间自动暂收棋盘，空闲后恢复。此显示规则不改变居民日程、随机数或存档用途。

当前世界 **schema8 / scene3 / rules4 / content5**，偏好3、frame6。新增桌面用途和九格棋局历史；旧schema7目录与codec已冻结，1–7存档读取升级并保护原快照。0.7.0-preview.1不能读取8，回退须在另一隔离profile恢复升级前快照。包身份、截图和验证见 [棋局实施记录](../../docs/ai-village/table-preview/IMPLEMENTATION.md)。入口ART_REVIEW、生产选择器和首帧门禁保持不变。

以下为0.7.0-preview.1历史新增说明，已有玩法继续保留。

---

# AI 小院 · 0.7.0-preview.1 · 连续生活内部预览

本轮在 `codex/feature-ai-village-entrance` 上开发。七位居民按偏好与模拟时段自主活动，在附近打招呼、聊天、观察读书、邀请茶点或看花草；不会自动完成玩家心愿。隐藏、暂停和离线均不推进时间。

**心愿 → 全部心愿** 可进入《蓝鲸丢失的白米饭》《安静的一页》《风带来的便笺》、找找小鲸鱼、书桌归位、茶点轮到你及三个人的星空。先在居民页邀请相应朋友；每一片段实际走到观察点、停留后才能继续。随时可取消，参与者离场或拖离会结束该次活动。整理支持拖放、键盘选择、重置；找鲸可点击场景或使用地点按钮、两次提示；茶点连续分享三份并按偏好回应。

完成后沿用同一本手账，保留首次参与者和日期；重玩只增加次数。**布置 → 挂饰** 可选择七种新纪念物的位置，明确保存后出现在场景与照片中。三个自愿目标从已有完成事实派生，无每日惩罚。新纪念物使用既有代码矢量语汇，视觉签收仍见开发记录。

当前世界 **schema7 / scene3 / simulationRules4 / contentRevision4**；偏好schema3。frame协议5仅新增经校验的找鲸点击意图，仍要求同一启动/资源/视图的首帧回执。1–6存档依次读取升级，首次写入由SaveStore保护旧指针及原快照字节。**旧版插件不能读取schema7；回退须停止插件，保留新profile，另建隔离profile恢复升级前备份。** 不得直接用0.6.4覆盖新存档。

此为本地预览，不代表正式发行或新美术批准；梦境门庭继续ART_REVIEW，生产静态入口保持不变。实际验收、截图、包身份和未完成项见 [本轮实施记录](../../docs/ai-village/living-v07-v09/IMPLEMENTATION.md)。

以下保留0.6.4功能与历史说明；其中“当前版本”描述属于原版本，新增内容以上文和本轮记录为准。

---

# AI 小院 · 0.6.4 · Entrance-v1 / UI-v1.1

七位居民共享一方离线小院。0.6「我的小院」增加家具锚点编辑、真实布局预览与撤销、可选配饰和两套环境主题，延续邻里互动、手账与照片相册。


0.6.4 增加入场展示协调器、七位完整头像的真实准备进度和 protocol4 首帧回执。ready-to-render 后仍先发送 view，只有对应启动、iframe、资源版本与快照成功 render 才揭幕。入口不改 userPaused、世界坐标或游戏 camera；跳过不跳过加载，隐藏和关闭重开使用简版。世界 schema6、偏好 schema3 不变。

**ART_REVIEW（本地内部候选）**：已接入原创梦境门庭的八层候选、圆拱透明门洞、内开双门和按高度布局的镜头。候选尚未获得用户美术签收；安装包继续使用暖调静态入口和七头像。只有本地鉴权实验夹具可预览候选，生产选择器仍要求 APPROVED。来源、预算、复验命令和证据见 [双线程集成记录](../../docs/ai-village/entrance-parallel/integration/README.md)。真实 GPU/DPI、人工观感及独立 QA 未完成时不视为正式发布；版本号保留 0.6.4，内部候选须按 SHA 区分。

## 开始游玩

1. 在 DSH Plugins → Add plugin 中选择本地 `dist/nidofy-dsh-ai-village-0.6.4.tgz`，安装启用后完整重启 DSH。验证基线为官方 DSH 0.2.1-rc.2、Windows x64，运行依赖离线内嵌。
2. 点击右上角 **⌂**。“居民”中选择伙伴，打招呼、舒展、记灵感、整理书桌、读书、浇水、听风或看天空。七人各有 12 条情境台词及微动作。
3. “心愿”提供首次同桌和另外五条不限时心愿。邀请两位居民喝茶／吃饭，或在长椅聊天、分享书页、交流花草、交换点子、安静陪伴。双方真实到齐后才开始；共同经历累积为初次相聚、一起活动、熟悉，不因离线下降。
4. “布置”提供午后小院、阅读角落、花草角落三个预置布局。六类目录是书桌、餐桌、坐垫、长椅、书架、盆栽；每个布局同时使用四类家具、六个活动位。阅读角落支持读书／分享书页，花草角落支持照料／交流花草。
5. 首次同桌发现风铃，分享书页发现纸灯笼，照料盆栽发现花叶挂饰。三个装饰均可选择挂点或收起，预览可取消，保存成功后才生效。布局更换会释放被替换家具上的普通活动；剧情中需先结束或取消活动。
6. “手账”最多记录 12 类首次回忆。重玩保留首次参与者和日期，只累计次数；不刷货币、不重复发装饰。界面支持中英文、主题、减少动态与气泡设置。
7. HUD「拍照」（窄窗位于「更多」）进入拍照：暂停世界、隐藏场景气泡和选择标记，支持 1–1.5 倍有限取景、重置、日期和边框。拍摄后预览真实 720×960 PNG，可直接导出或保存到本地相册；退出只移除拍照暂停原因。

8. “布置 → 家具 → 开始布置”进入暂停预览。书桌、餐桌、长椅、生活角落各有两个锚点；三个布局模板可继续调整。家具的绘制、活动位、障碍和点击区域一起移动。选择暖阳午后／暮色灯火环境，给当前居民选择布艺结／叶形胸针／不佩戴；七人的配饰分别记住。支持撤销最近 20 步、Escape 或按钮取消、明确确认保存。
9. 侧栏或宿主面板暂时隐藏会保留同进程布置草稿，回来重新校验。家具足迹压住居民时拒绝该草稿，请先取消并挪开居民。普通活动在几何确认后释放，剧情中不能开始编辑；取消、确认放弃后关闭和断连丢弃草稿；布置时普通页面入口隐藏，不影响已保存进度或用户暂停。环境主题独立于界面明暗，照片包含实际家具位置、环境和配饰。

相册最多 20 张、总计 40 MiB，单张 PNG 不超过 4 MiB。相册在手账页，可导出和确认删除。删除照片不删除剧情或解锁；上一成功相册修订引用的文件会暂时保留，后续写入清理无引用文件。照片不发送到主聊天或网络，不在世界 JSON 中保存图像。

座位或路线被占用时会明确拒绝邀请，可先挪开居民。主要事件至多一个，抵达期限 36 秒模拟时间；拖动暂挂，取消或无效落点继续，有效离席取消。活动间有短暂冷却，避免连点刷屏。没有强制照顾、每日清零或离线推进。

0.6.1 补齐草稿隐藏恢复、输入法 Escape 保护、抬起确认轻点、编辑焦点返回和 SVG 图标。正文 14px、辅助文字至少 12px，小院操作按钮至少 40px。展开范围避开完整聊天输入卡片，空间不足时显示暂停提示。

关闭、隐藏、sidebar、断连和空间不足时暂停；聊天切换不创建新世界。↗／↙ 切换布局，Esc 先处理当前拖动或编辑草稿。主聊天输入和草稿独立保留。

0.6.2 按 UI-v1 冻结规范实现：同一全视口小院、四入口覆盖抽屉、900px 右侧面板、有限观察镜头、已确认事实消息、家具锚点拖动与规范 720×960 拍照。设置位于 HUD 的系统动作中。软件渲染时自动使用实色面板以降低开销，不改用户偏好。

显示偏好从 schema1 窄迁移到 schema2，保留主题、语言、动态和气泡，新增减少透明与消息已读状态。旧原件由现有 SaveStore 保护。0.6.1 无法读取 schema2 偏好，回退必须使用升级前备份与原安装包，不能直接覆盖新偏好。世界仍 schema6。

0.6.3 按 UI-v1.1 修订体验：透明 HUD/Dock、暖中性场景玻璃与实色回退、小型摘要/详情卡、逐层返回并恢复目标/滚动/焦点。文字大小支持 90%–200%，三档基础字号为 13/14/15px，辅助文字至少 12px；新安装默认跟随 DSH，旧主题保留。旧 UI-v1 森林绿、默认 48% 高抽屉和全高设置不再适用。

同连接临时心跳故障通过原租约与存档身份/修订核对后恢复，按 1/2/4 秒最多三次；自动恢复保留布置草稿和撤销。未知保存结果只读取核对、不重放，其他 owner/外部修订不自动接管。人工暂停继续保留。现场原始暂停根因仍未确认。

偏好 schema1/2 窄迁移至 schema3，新增 textScale 与 host 主题；world schema6 和 frame protocol3 不变。0.6.2 无法读取新偏好。回退请在停止插件后保留整份新 profile，另建隔离 profile 恢复升级前备份并使用 0.6.2 包，不能在新偏好上直接降级写入。详见 [迁移与回退](../../docs/ai-village/ui-v1.1/MIGRATION.md)。

本轮结果及人工未测项见 [UI-v1.1 验收](../../docs/ai-village/ui-v1.1/RESULTS.md)。一小时真实运行验收继续暂缓，短时自动化不替代现场验收。

## 存档和资源

正式世界使用 schema 6、scene 3、规则 3、内容 3；布局属于有界目录，frame protocol 4 对资源、照片、镜头和布置意图共同校验 source/origin/token/序列/viewport。历史 schema 1/2/3/4/5 按对应旧定义读取，迁移时保留已有茶会、首篇手账和风铃；首次新格式保存保护升级前指针和原始字节。旧插件不能读取 schema 6，请勿直接降级覆盖新档。

世界仍在 `<profile.dir>/nidofy-ai-village/`，显示设置在 `preferences/nidofy-ai-village/`；相册在 `album/`，独立有界索引在其 `nidofy-ai-village/` 下。邀请、完成、心愿、关系、奖励和布局经同一世界 CAS 提交。结果不确定时只读核对，不自动重放写入；坏档保留原件，不自动重置。卸载不删除数据。

Host 按请求校验并读取固定白名单资源；客户端与 frame 按在场居民加载、释放图像，入场前完成准备。单蓝鲸 32 张纹理、其他单人 23 张、七人 128 张；两个未使用的整件家具贴图不进入运行纹理。新增家具、茶杯、书本、水壶和装饰使用代码矢量图形，复用批准的角色资产。无需 API key 或联网模型，无音频、自由网格装修或多场景入口。

## 构建和验收

```powershell
node scripts/ai-village-phase4.mjs check
node scripts/ai-village-v061-browser.mjs
node scripts/ai-village-v06-browser.mjs
node scripts/ai-village-v06-neighborhood-browser.mjs
node scripts/ai-village-v06-performance.mjs
npm run typecheck
npm run village:build
node scripts/pack.mjs --only=ai-village
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
```

本地鉴权预览仍使用 `node scripts/ai-village-phase4.mjs serve`，端口 18754；入口 token 保存在忽略的 `.build/ai-village-phase4/preview-entry.json`，不要提交或转发。0.6 Desktop 脚本只使用专用 `.build/ai-village-v0.6-desktop` 与本机 CDP 18759，不指向日常 DSH_HOME。

- [剩余工作核对与 0.6.1 验收](../../docs/ai-village/REMAINING_WORK_AUDIT_2026-10-22.md)
- [0.6 实施计划](../../docs/ai-village/V06_IMPLEMENTATION_PLAN_2026-10-22.md)
- [0.6 验收记录](../../docs/ai-village/V0_6_RESULTS_2026-10-22.md)
- [0.5 范围与实施顺序](../../docs/ai-village/V05_IMPLEMENTATION_PLAN_2026-10-22.md)
- [0.5 实施与验收记录](../../docs/ai-village/V0_5_RESULTS_2026-10-22.md)
- [0.4 历史交付](../../docs/ai-village/V0_4_RESULTS_2026-10-22.md)、[综合实施计划](../../docs/ai-village/CONTENT_UI_IMPLEMENTATION_PLAN_2026-10-21.md)

Git/Hg 与小院上下共存，Live2D 与小院互斥。以下阶段 1–3 以及旧 M0/M1 样板仅保留历史用途，其版本、坐标和限制不代表 0.6。

## 阶段 3：可玩小院

在仓库根目录运行，开发依赖与固定官方源码准备见下文：

```powershell
node scripts/ai-village-scene-assets.mjs
node scripts/ai-village-phase3.mjs check
node scripts/ai-village-phase3.mjs serve
```

打开 <http://127.0.0.1:18748>。`serve` 会先检查类型并构建；仅监听本机，Ctrl+C 退出。拖到左侧书桌写字、右侧餐桌吃饭、右下坐垫休息；拖回普通地面后恢复漫步。Esc 取消拖动。收起或隐藏会停下世界时间，用户暂停偏好会保存。

- [场景截图](art/QA/phase3/work-dpr1.png)、[坐姿](art/QA/phase3/rest-scene-dpr2.png)、[实际操作录屏](art/QA/phase3/scene-demo.webm)
- [验证摘要](art/QA/phase3/validation.json)、[阶段 3 实施与限制](../../docs/ai-village/PHASE3_RESULTS.md)
- [家具/手型/坐姿生成提示词](art/prompts/phase3.json)、[资源及哈希](assets/scenes/courtyard/manifest.json)、[场景配置](assets/scenes/courtyard/scene.json)

开发存档固定放在仓库 `.build/ai-village-phase3/profile/nidofy-ai-village/`，不会改实际 DSH_HOME。存档异常会暂停并保留原文件；“开发与恢复”中的按钮可显式恢复上一成功版。第二个窗口会显示占用，关闭原窗口后可重新打开；非正常退出最多等待 15 秒租约过期。

`check` 使用独立临时 profile，验证纯逻辑、磁盘保存、跨进程互斥、真实 Chromium 交互、打包与解包 smoke。`.build/ai-village-phase3/phase3-preview.tgz` 是开发预览归档，需要 Node 24、仓库运行环境与外部 Koffi；不作为可安装插件发布。DSH 浮卡、真实 Host 认证和正式安装属于 P4/P5。

## 阶段 2：动作室

```powershell
node scripts/ai-village-parts.mjs
node scripts/ai-village-phase2.mjs check
node scripts/ai-village-phase2.mjs serve
```

在仓库根目录运行，先满足下面阶段 1 的开发依赖条件。动作室地址为 `http://127.0.0.1:18747`，仅监听本机。`check` 复用阶段 1 生成的许可证清单，所以首次使用先运行一次 `ai-village-phase1.mjs check`。

- [中文预览](art/QA/phase2/studio-zh.png) / [English](art/QA/phase2/studio-en.png)
- [实际播放录屏](art/QA/phase2/motion-preview.webm)、[动作与表情](art/QA/phase2/motion-contact-sheet.png)、[20 张透明部件](art/QA/phase2/parts-contact-sheet.png)
- [角色定义](assets/characters/bluewhale/character.json)、[动作关键帧](assets/characters/bluewhale/animations.json)、[部件清单](assets/characters/bluewhale/manifest.json)
- [图集生成提示词](art/prompts/phase2.json)、[呆毛补绘提示词](art/prompts/phase2-ahoge.json)、[验证摘要](art/QA/phase2/validation.json)
- [制作、修正及边界记录](../../docs/ai-village/PHASE2_RESULTS.md)

动作室支持 idle/walk/pickup/dragging/put_down、四种表情、时间轴、96/128/320px、三种背景和中英文。动作室中的 walk 原地播放；实际移动和家具互动请使用阶段 3 场景。阶段 2 动作资产已有独立用户批准。

## 阶段 1：已批准基准

- [中文总览](art/QA/phase1-overview.png) / [English overview](art/QA/phase1-overview-en.png)
- [角色原图](art/candidates/bluewhale-neutral-v01.png)：1254 × 1254，真实透明 PNG。
- [场景原图](art/candidates/courtyard-empty-v01.png)：1086 × 1448，3:4。
- [透明与尺寸对照](art/QA/alpha-and-sizes.png)：白、灰、深色底；96/128 CSS px。
- [资源清单与哈希](art/candidates/manifest.json)、[完整生成提示词](art/prompts/phase1.json)。

两张基准由内置 image_gen 生成，逐字节复制到仓库，未放大或修改像素。角色参考原交接包的蓝鲸 Q 版形象，旧 Live2D 仅作为参考。`art/approved/` 保存获批副本与确认记录。

## 复现

在仓库根目录执行，要求 Node 24+，且已按照根 README 运行 setup：

```powershell
npm ci --prefix packages/ai-village --ignore-scripts --legacy-peer-deps --no-audit --no-fund
node scripts/ai-village-phase1.mjs check
node scripts/ai-village-phase1.mjs serve
```

预览服务仅监听 `http://127.0.0.1:18746`，Ctrl+C 退出。页面支持中文/English。`serve` 使用上一次 `check` 的构建结果，不自动重新构建。

验证还需要现有的固定官方源码 `.build/sandbox-enhanced/official` 及其 `baseline.json`，revision 为 `687f282e8625c6b8d11ff58211a90524be2e4317`。新环境先按 `scripts/sandbox-enhanced.mjs prepare` 的约定指定 `DSH_SANDBOX_ARCHIVE`，运行 `npm run sandbox:prepare`；源码归档 SHA-256 必须为 `157903b22c2881d3678d846755afe957a48df834e747deda805a1195ce25a146`。阶段 1 仅复用这个已核验源码目录，不运行沙箱插件。

浏览器验证复用 `.local/environment.json` 所指源码依赖中的 Playwright 1.61 和本机已缓存的 Chromium headless shell。脚本不下载浏览器。Windows 存档试验使用仓库已有 durable-file 工具及其 Koffi 依赖。

## 代码和证据

| 文件 | 内容 |
| --- | --- |
| `experiments/frame.ts` | PixiJS 8.22.0 离线 WebGL 静态渲染，单次绘制后停止 ticker |
| `experiments/storage.ts` | profile 目录解析、跨进程 owner 锁、CAS、同步原子文件发布和前一版保留试验 |
| `experiments/storage-check.ts` | 临时 profile 测试；独立子进程抢锁和重新读取存档 |
| `art/QA/validation.json` | 最近一次通过的类型、浏览器、存档和打包验证摘要 |

构建、临时 profile 和完整结果均位于被忽略的 `.build/ai-village-phase1/`。其中 `phase1-preview.tgz` 仅包含预览网页、图片、renderer 和依赖许可证，不能安装进 DSH。预览需通过提供 `/frame` 等固定路由的本地 HTTP 服务访问，不能直接双击 HTML。

目前已验证离线 bundle、严格 CSP、不透明 iframe 隔离、DPR 1/2、profile 隔离、跨进程互斥、修订冲突、坏档保留和前一版存档。未验证真实 Desktop 安装、硬件 GPU 性能、断电恢复、客户端租约/epoch、完整存档迁移或 Host 认证路由。

更详细的结论、视觉待修项及下一阶段边界见 [阶段 1 记录](../../docs/ai-village/PHASE1_RESULTS.md)。

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
