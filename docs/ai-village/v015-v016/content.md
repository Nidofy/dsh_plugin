# 0.15–0.16 配对故事与日记内容 / 核心契约

基线：`37203e4`，原 `0.14.0-preview.6`；宿主 DSH `0.2.1-rc.3`。本文件由内容/核心线程维护。最终发行版本、包哈希和浏览器/原生结果以主线程最终集成记录为准；本记录不宣称视觉验收完成。

## 本轮核心实现

- 当前 world16/content12，Afternoon version2。原 world15、Afternoon version1 和对应目录、community 来源校验独立冻结为 `living-state-v15.ts`、`afternoon-state-v1.ts`、`afternoon-catalog-v1.ts`、`community-life-v1.ts`。
- 旧存档先经原解码器完整验证，再增加空目录键和 event.step=0；保留原世界、路径、时钟、RNG、首次事件和当前活动。纯迁移不写磁盘，原有 SaveStore 负责持久升级检查点。
- 没有增加 World owner、时钟、自由文本日志、关系数据库或奖励 writer。全部新故事继续使用 afternoon.active 和原 WorldController/Runtime CAS。
- 六组配对内容加日记三章，共新增九条；加原有两条，目录上限十一条。memories 每个 ID 一项，lastEventIds 与 keepsakes 精确固定键；不允许未知键、重复事实、错误参与者、越界计数、未来时间或前章缺失。
- 新故事 stage0 发现、stage1 有效物件选择、stage2 实际收尾移动并明确保存。step 为 0–3 的有界内容进度，serial 每次有效请求递增，失败选择不推进 step、不发奖，attempts 只反映当前步失败数，成功清零。操作 token 仍是 eventId:stage:serial。
- 首次完成保留参与者、eventId、时间和第一步有效选择；重玩仅增加有上限的 count 和 lastEventId，收起的纪念不被重玩重新摆出。
- 纪念仅可在目录指定区域摆放，异区非 null 命令由核心拒绝；收起不删除事实。日记前两章 placement=null，仅保存线索事实，最后章才解锁归家日记牌。

## 六组具体玩法

| 故事 / 地点 | 有效参与 | 差异化表达 | 保存后结果 |
| --- | --- | --- | --- |
| 白米饭与下午茶 / 茶区 | 找出蓝鲸带来的米饭，再分一勺给千问；桂花糕和收回整碗不会推进 | 蓝鲸重视分享日常，千问记住个人偏好 | 米粒茶笺 / 留言树 |
| 被风吹乱的长卷轴 / 庭院 | 按未出发的小船、过桥、归途星光三段排列；顺序错误可重试 | Kimi 留意叙述空白，Mistral 追风找纸并读结尾 | 系风卷轴 / 庭院纪念点 |
| 两种奇怪的答案 / 书屋 | 找透光孔，再把卡朝向窗；纸边和书背无效 | GLM 记录可观察事实，Gemini 保留月亮的想象；不评价现实模型能力 | 双面观察卡 / 书架 |
| 被打乱的节奏 / 茶区 | 挥手、拍手、鞠躬三拍顺序 | Seedance 留出动作间隔，Grok 学着等到最后谢幕；无音频 | 三拍动作签 / 留言树 |
| 明天的小计划 / 庭院 | 选共读一页或观察叶子，再将小计划放到长椅边；全部做完/藏抽屉无效 | GPT 把计划缩小，MiniMax 给临时休息留空格 | 长椅小计划牌；首选内容保存在 selection |
| 共读角落 / 书屋 | 选短诗或无字绘本，再把叶签夹在页间；时刻表/藏坐垫无效 | Claude 陪伴慢读，Llama 用安静和软垫表达照顾 | 共读叶签 / 书架 |

中英文为分别编写的短句，角色语气、动机、操作、失败提示、成功回应与回访各不相同。内容模块只描述文字、动作意图和道具类型；动作实际绘制、正式资源与签收由集成/美术门禁确定，不能把这些动作标签视为美术验收结果。

## 一本走丢的日记

统一 arc ID 为 `lost-diary`；章节 ID 为 `page` / `tea` / `home`，权威完成事实 ID 分别为 `lost-diary-page` / `lost-diary-tea` / `lost-diary-home`。

1. 书屋：Claude 与 Kimi，发现无名页，识别茶渍并夹住真实线索。完成保存前仍持有 active，旅行被拒绝。
2. 前章完成保存后 active=null。沿现有地图由书屋回庭院，再进入茶区；没有修改区域邻接或绕过旅行锁。
3. 茶区：Qwen 与 Bluewhale，匹配有缺口的杯垫、标记庭院长椅。前章不存在时不可开始，也不可通过伪造存档只保存后章。
4. 回庭院：GPT 与 MiniMax，接上未写完的句子而非只认蓝封皮，归还纸页。最后明确保存才得到纪念物。
5. 各章保留自己的首次 eventId、cast、完成 tick；后章完成时间不得早于前章。冷恢复仅允许从已确认事实继续；未确认的完成不解锁旅行、不提前展示线索，不自动重放写入。

## 集成接口

`afternoonStory(id)` 保留旧 title/keepsakeTitle/stages/lines，并增加 region/placement/revisit/prerequisite/arc/chapter。

`afternoonOperations(event)` 返回 `{ action, choice?, label:{zh,en}, prop }[]`。这是展示投影；核心 actAfternoon 重新验证 token、阶段和候选。新故事用 action=`interact`；发现操作 choice=`inspect`；互动 choices 来自 `residentStory(id).steps[event.step]`，不能由 UI 直接修改 step、回忆或奖励。

`residentStory(id).steps` 包含 prompt、choices、accept、response、retry、actor、gesture。只在确实成功后表现上一有效步骤 response；失败使用当前 retry；新阶段不延续上一阶段失败提示。角色动作标签不存入世界。

`stepAfternoon(world, baseScene)` 必须传基础庭院几何，内部使用 regionScene 取得当前布局。新区域候选脚点有限、步幅仍为 17/30、每段最多九路点、总路程最多 660、移动期限 1200 ticks。旧茶区目标与顺序保留。新内容不消费 RNG。

## 已执行测试

2026-10-29，本轮命令（实际执行，不引用历史 446 项）：

- `node node_modules/vitest/vitest.mjs run --config scripts/ai-village-rc3.vitest.mjs packages/ai-village/tests/resident-stories.spec.ts -t 'seven residents'`：先完成 A/B，两项通过。
- `... resident-stories.spec.ts afternoon.spec.ts`：15 项通过（首次扩展阶段）。
- `... resident-stories.spec.ts`：补满目录容量与严格拒绝后，10 项通过。涵盖六组、十二居民覆盖、七人在场、逐帧移动与每步冷读、失败/取消、原首次事实与收起、跨区章节、有界九故事累积、错误参与者/步骤/选择/序列、v15 活动窄迁移和幂等。九条新事实加七位居民的实际 JSON 小于 12 KiB；世界上限仍为 48 KiB。
- `... resident-stories-runtime.spec.ts`：3 项通过。实际 VillageRuntime + 存储传输替身验证日记完成丢 ACK/读取离线、确认前拒绝旅行/重复完成/取消、只读对账不重复写、CAS 冲突保留原章、pending 完成与并发请求只提交一次。
- 原 `afternoon.spec.ts` 六项通过，旧两故事不改变成功操作、首次事实和重玩规则。

首次日记测试失败为 `REGION_NOT_CONNECTED`：测试错误地假设书屋直达茶区。已修正测试按真实地图经庭院中转，保持生产旅行校验。类型检查由主线程统一执行，避免并发生成资源清单；本线程不会把未完成集成期类型输出当作通过记录。

## 未独立宣称的门禁

真实浏览器双语/DPR/浮卡、角色动画观感、主聊天焦点、原生 Desktop、磁盘升级原字节保护、离线包、包 SHA 与性能由主集成线程执行/记录。运行期传输替身成功不等同真实 Host 或 Desktop 验收。

### 集成审查补充

- LivingController 对当前 afternoon 故事中的实际居民增减提前返回 `EVENT_ACTIVE`，不先修改返回脚点/社交/成员；已有角色选择仍可进行。覆盖参与者、旁观者移除和新成员加入。
- 新故事不再共用旧茶区 `(262,380)` 停留点。有限候选包括当前真实家具锚点；分别优先茶桌中席、书屋阅读桌和庭院长椅，收尾优先留言树、窗边和长椅另一端。旧两故事仍使用原茶区脚点及顺序，不改变历史动作恢复。
- 新增长期确定性测试：六组各七位在场居民，合计覆盖十二位名册和三地区；每组故事完成后，原副本与冷恢复副本分别运行 6000 tick（每组 200 秒模拟，六组共 36000 tick）。每 300 tick 比较完整世界并重新冷读，检查 recent≤12、回忆不变、无残留 active，两位剧情角色均恢复普通活动。此为确定性模拟，不替代一小时真实桌面性能测试。
- 补充后 `resident-stories.spec.ts` **12/12** 通过；`resident-stories-runtime.spec.ts` **3/3** 与原 `afternoon.spec.ts` **6/6** 已通过（后两者最近执行在最终补充测试前，核心与之对应）。

## 真实打包 Host 的旧档升级门禁

脚本：`node scripts/ai-village-v016-save-upgrade.mjs`，也可通过 `--candidate=dist/<新候选>.tgz` 验证新的 0.16 包。脚本每次生成独立临时 profile 和带唯一后缀的证据，使用 `wx` 禁止覆盖历史结果。

已执行 **4/4 PASS**，证据：[world16-save-upgrade-0.16.0-preview.1-1793206095254-787c1ff2.json](validation/world16-save-upgrade-0.16.0-preview.1-1793206095254-787c1ff2.json)。本结果绑定 `0.16.0-preview.1` 包 SHA-256 `ea77c980967b2b080af4f6f8875aea7fac1df19ce9bb9ff1084a6380b20d7cf0`，不能套用到后续重建包。

- 使用冻结 `0.13.0-preview.5` Host（SHA `c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760`）写入 world14 普通茶活动。
- 使用冻结 `0.14.0-preview.6` Host（SHA `34d723b00831408c5b1d178806aeadef3184e54cd20c5abad96f18bf40cc7098`）分别写入三份已知 QA world15：选择叶子后冷恢复的进行中书签、已有书签事实并进行中的倒影故事、双故事完成且倒影纪念已收起。
- world15 输入仅来自历史 `pre6-all-dpr1-01/result.json` 的具名观察记录，核对其 PASS 与包 SHA，记录证据和世界哈希；旧 Host 在新隔离 profile 中实际校验并发布存档，不读取用户 profile、不更改历史 QA profile。
- 当前 Host 从解包产物运行：重复只读后 pointer/snapshot 字节不变，旧 epoch 失效，原人物/脚点/路径/选择/首次事实/次数/摆放全部保留；仅新增有界目录空键和版本。
- 一次明确 CAS 后 revision2；同 operationId 幂等返回相同 ACK；新 operationId 的旧 revision 被拒且 pointer 不变；升级保护 pointer 与旧 snapshot 原字节保留；关闭重开后世界与修订相同。
- 全部验证使用真实打包 Host 和磁盘 SaveStore；仍不等同原生 Desktop 或视觉验收。

最终集成补充：明确指定 `--candidate=dist/nidofy-dsh-ai-village-0.16.0-preview.2.tgz` 后重新执行 **4/4 PASS**，绑定SHA `db489226be230fa1b9fa68bacc2a5a13da73fb1124dd762f643efd4c7e9c09df`，见 [pre2结果](validation/world16-save-upgrade-0.16.0-preview.2-1793207144537-8c715265.json)。旧 `host-upgrade-pre2.log` 文件名有误，其实际记录为pre1，不得用作pre2证据；已保留并在交接说明。脚本默认候选现从当前package版本读取，避免再次误绑旧包。
