# 0.11 共同回忆册

## 实现与接入

`src/core/relationship-catalog.ts` 的 `relationshipFacts(world)` 为已验证、已发布世界的纯只读投影；`src/client/relationship-panel.tsx` 导出 `RelationshipPanel({world, locale})`，供现有手账的回忆子页接入。没有新的权威存储、发奖命令、计时器或独立事件执行器。

十二人名册组成 66 个可能关系；每次选择一位居民只显示其余 11 位，默认全部折叠。展开可读来源、首次参与者、首次完成的世界时刻和对应纪念物的真实摆放位置。仅在场、正在进行、未确认完成的事件不会创建回忆；离场居民的已保存事实仍可浏览。

组件复用小院主题 token、字号与语义原生 select/details，提供中英文，选择框有显式 label、分区有可访问标题，状态文本宣布当前居民的已发现关系数。没有新增动画。浅深主题、原生截图和完整页面视觉验收由集成矩阵单独记录，不能以 jsdom 测试替代。

## 来源和计数约束

- `Neighborhood.bonds` 的 `count` 和 `lastTick` 是唯一每对居民的计数、最近时刻来源。仅有 bond 时明确显示没有具体活动详情，不猜测活动种类。
- 同桌手账、邻里/PlayMemory、BookhouseMemory 和书屋谜题只保存各内容的首次参与者；仅这份首次记录的参与者获得对应来源。三人回忆可对应三个真实关系，并完整列出三位参与者，不声称是双人专属剧情。
- 各内容的 `memory.count` 是内容累计次数，不能当作每对居民的次数，也不能为后来的其他 pair 复制首次主题或纪念物来源。界面不展示该累计值，来源正文明确限制。
- 共读 `memory` 与 `puzzleMemory` 独立；谜题不发纪念物。书签只关联首次共读参与者，书签收起仍保留解锁与回忆。
- 五个单人初见不会构成 pair；新双人故事使用真实已完成 `PlayMemory`，`reward:null` 不制造纪念物。收藏目录已兼容无纪念物内容，并计入独立书屋谜题及其首次参与者。

3、8、15 对里程碑分别点亮“留座的朋友”“邻里故事收藏家”“小院的回忆守护者”。数量取具有 bond 或真实首次来源的关系并集；旧同桌手账即使没有 bond 仍是确实发生的关系。它与旧心愿中严格仅统计 bonds 的“三对共同经历”是不同的只读指标。称号不需领取，不提供新的物品，不改变居民生活，不要求收齐 66 对。

## 纪念物观察反馈

`keepsake-observation.ts` 现在只对该纪念物对应回忆首次参与者使用“那次一起”的个人回忆台词。非首次参与者、只有其他活动记录、仅有聚合 bond 或全局重玩次数时，使用准确的普通景物观察。不会根据当前在场状态推断历史。

## 验证

2026-10-24：固定官方配置执行以下四文件，15/15 测试通过；`node scripts/ai-village-phase4.mjs types` 通过固定官方 Host/Client 类型与公开声明检查。

```powershell
node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs packages/ai-village/tests/relationship-catalog.spec.ts packages/ai-village/tests/relationship-panel.client.spec.tsx packages/ai-village/tests/relationship-observation.spec.ts packages/ai-village/tests/collection.client.spec.tsx --maxWorkers=2
node scripts/ai-village-phase4.mjs types
```

覆盖 66 唯一组合空态、首次书屋来源不扩散、不同谜题配对、重玩计数不冒充 pair 次数、真实三人参与者、单人排除、3/8/15 阈值、收起纪念物仍解锁、只读不变、切换居民、中英文可访问控件、默认折叠，以及纪念物观察的参与者/非参与者两分支。

早期首轮执行因并行核心 schema/bookhouse 迁移尚未完整写入导致 `createLivingWorld` 校验失败；接口稳定后按原断言重跑通过，未放松存档校验或测试断言。构建、打包和真实 Desktop 视觉结果以本轮统一交付记录为准。
