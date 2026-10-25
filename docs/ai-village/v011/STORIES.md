# 0.11 居民故事、初见与书页谜题

基线为 `fb47baa` 的 0.10.0-preview.1。此文记录当前源码实现与已执行的核心测试；实际 UI、Desktop、打包和人工签收以本目录最终验收记录为准。

## 存档设计与旧数据保护

新增内容先冻结 `living-state-v11.ts` 与 `bookhouse-state-v1.ts`。旧 11 继续通过旧 9 与 `play-catalog-v6.ts` 验证十个历史活动，不接受新初见或配对故事。当前 `living-play-state.ts` 使用扩展内容目录，但仍只作为 world12 的校验投影，不能单独写入为新的 schema9。

当前世界为 schema12/content9；scene3/rules4/region1 不变。初见与配对记录复用 `neighborhood.memories` 的每内容一个首次事实，最多增加十一项；首次参与者、eventId、完成 tick 不被重玩覆盖。初见次数严格为 1，已完成的初见不能再次启动。配对重玩只增加次数及对应 bond，不发家具。当前 21 项 play 与历史故事共同使用有界记录数，66 对 bond 上限不变。

书屋 `bookhouse.version=2` 增加 `puzzleMemory`、`puzzleLastEventId`；active 增加 `kind: reading | puzzle` 与固定三格 `board`。首次谜题事实为 eventId/participants/completedTick/count，不含主题。重玩只增 count；不能把首次参与者展开成所有重玩的共读事实。与旧共读分开校验 UUID，谜题不解锁书签。

迁移顺序为先用冻结 11 codec 严格验证，再给原书屋 active 补 `kind=reading`、`board=[-1,-1,-1]`，添加空谜题事实；在途路径、角色脚点、ticks、RNG、旧主题和收藏保持原值。仍使用 48 KiB 上限、原 SaveStore owner/lease/CAS 与未知结果只读对账。测试验证迁移后 42 次保存仍保留旧指针与快照原字节。

回退应停止新插件、保留完整新 profile，在独立 profile 使用升级前原件及旧包；不能改版本号或删除新字段让旧插件写入。

## 五段初见

所有初见仅对已入住的对应角色开放，复用原 Play 路径、观察停留、阶段令牌、取消与同一次权威保存。主客户端在入住 CAS 已确认后尝试启动；未知回执不启动另一次写入。忙碌、取消、旧版本已有居民等情形在心愿保留手动开始入口。离场、暂停、隐藏和冷恢复沿用现有规则。

| 内容 ID | 实际路径 | 角色差异 |
| --- | --- | --- |
| intro-seedance | 长椅 → 生活角落 | 聆听节奏、按拍子换位置，留下第一小节 |
| intro-glm | 书桌 → 长椅 | 给奇怪的影子问题找问号，再观察自己的影子 |
| intro-minimax | 生活角落 → 书桌 | 寻找小船叶、画旅行轮廓，叶子留在家 |
| intro-llama | 书桌 → 长椅 | 借一个安静下午，为另一位读者留空位 |
| intro-mistral | 生活角落 → 长椅 | 跟随叶影寻找风，约好下次书屋窗边见 |

五个介绍均有中英文独立文本与至少两段真实走动，框架可依据居民已有 motion 呈现差异动作。未增加居民数量或改变原七人门庭构图。

## 六组独立配对故事

- `pair-bluewhale-claude`：饭碗里的书签。餐桌发现不能吃的纸条，书桌补完半句，回餐桌把“给晚到的人留饭”与“留一页故事”连接起来。
- `pair-glm-gemini`：两个答案。书桌的问题引出双面纸，长椅旁以俯视/仰视寻找不同答案，回书桌折起能面对面的两种观点。

`requiredParticipants` 在启动、active 校验及已保存 memory 校验都约束实际角色。参与顺序可交换，故事不会变成任意两人套姓名的文本。六组均以回忆为奖励，无新装饰挂点。两组样板在 `browser/samples-01` 完成真实路线与单次保存验证后，才扩展以下四组；扩展组仍需独立浏览器验收，不沿用样板截图作为新组通过证据。

- `pair-kimi-mistral`：风把故事吹远了。长椅丢失故事结尾，生活角落为远行的句子留白，书桌写出开放结尾。
- `pair-gpt-minimax`：明天的小计划。书桌的满格便签，生活角落的临时绕路，餐桌旁留下能装下新风景的空白计划。
- `pair-seedance-grok`：谁偷偷改了节奏。生活角落发现多出的一拍，长椅旁学习停顿，回角落用挥手接住无声的第四拍。
- `pair-qwen-llama`：温柔的下午茶。餐桌为书与朋友让座，长椅陪一句话停留，回餐桌交换不必急着归还的下午。

## 可重复书页谜题

`startBookhousePuzzle(world, scene, friend, eventId)` 进入原书屋执行器：书柜找到种子/发芽/开花三页，阅读桌排列顺序，窗座留下故事。书柜与窗座通过原阶段操作；阅读桌用原 `bookhouseStoryAction` 传入 `item:slot`（0–2）或 `reset`。三页排好才前进；无计时惩罚、无每日要求，可取消和重玩。

`bookhouseEventStages(active)` 为阅读或谜题提供三段中英文标题、文本与按钮。新谜题不会改变家具几何，不建立第二个执行器、计时器、存档或区域恢复门。

## 已执行验证

2026-10-24：`node scripts/ai-village-phase4.mjs types` PASS。

`node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs packages/ai-village/tests/stories-v011.spec.ts packages/ai-village/tests/living.spec.ts packages/ai-village/tests/bookhouse-story.spec.ts --maxWorkers 2`：3 文件、22 测试 PASS。新增五测试覆盖所有初见实际移动与不重复完成、固定配对重玩、谜题错排/reset/冷恢复/不同朋友、冻结 11 在途迁移与磁盘保护、全部 21 个 play 事实及 66 bonds 的 48 KiB 预算。原测试保持逐 tick 最大步长、碰撞与冷校验断言，未降低门槛。

实际游玩、最终美术、正常 GPU、最小化、物理休眠、完整包身份不由这些核心测试证明。
