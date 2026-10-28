# 午后小插曲与社区生活：B1–B4 实现记录

本文件记录从 A6 冻结基线 `8131d83` 恢复开发后的 B 阶段实现。记录日期：2026-10-28。当前源码版本为 `@nidofy/dsh-ai-village@0.14.0-preview.6`，目标宿主仍为 DSH `0.2.1-rc.3`。最终包身份、实际验收结果和限制见 [HANDOFF.md](HANDOFF.md)。旧 A6 记录保留，不以 B 阶段证据替换。

## 版本与边界

| 契约 | 本阶段 |
| --- | --- |
| world `schemaVersion` | 15 |
| `contentRevision` | 11 |
| Frame 协议 | 12 |
| Region 格式 | 沿用 version 2，庭院、书屋、茶会广场 |
| Afternoon 格式 | version 1 |
| Community 格式 | version 1 |
| 世界保存上限 | 沿用 48 KiB |

保持原有单一世界、单一模拟时钟、CAS 保存与不确定结果只读核对机制。没有新增地图、模型请求、外网美术、第二套回忆数据库或独立社交计时器。纸签和收藏卡使用现有 Pixi Graphics 矢量绘制。未修改正式用户 profile，也未发布 npm 包。

## B1：两个固定组合、不同操作和一次首次事实

入口位于茶会广场的居民/心愿页；摆放入口位于布置页。对应居民必须已在场。

| Story ID | 居民 | 实际流程 | 首次纪念 |
| --- | --- | --- | --- |
| `tea-bookmark` | Bluewhale、Claude | 走近并观察 → 听纸签的话 → 选择叶子或波纹并折纸 → 压平 → 走到收尾位置并观察 → 明确“记下来” | 茶香书签 |
| `reflection-shapes` | Gemini、Grok | 走近并观察 → 选择左/右视角 → 尝试原样或镜像匹配；原样留下失败尝试，镜像才能继续 → 走到另一侧并观察 → 明确“记下来” | 倒影小卡 |

两个流程共用阶段调度，但操作及有效选择不同。位移通过 `residentRoute` 与 `clearSegment` 执行，单步最多 `17/30` 世界单位；两位居民按顺序移动，避开旁观者和已选目标。每段路线最多 9 个路点，共用最多 1200 tick 接近期限；规划总路程限制为 660，收尾目标至少距该居民当前位置 32。观察期为 60 tick。等待用户操作时不会自动完成故事。

`startAfternoon`、`actAfternoon` 使用已校验世界的副本；操作 token 为 `eventId:stage:serial`。阶段未就绪、旧 token、非法动作、错误组合、复用事件 ID、其他显式故事占用时拒绝操作。参与者拖放不能取消进行中的故事；取消或超时只结束当前事件，不写回忆、不授予纪念。

只有最终 `remember` 才创建 `AfternoonMemory` 和对应默认摆放。第一次的参与者、eventId、完成 tick、日期与选择均保留；重玩只增加有上限的 count 并更新 lastEventId。已收起的纪念不会因重玩重新摆出。Runtime 通过已有 `neighborhoodCommand`/CAS 路径提交；丢失 ACK 时不先展示未确认首次奖励，也不重放 `remember`。

## B2：可归因的跨区回忆与关系来源

`communityMemorySources(world)` 从已保存的书屋共读、书屋谜题、三人茶会及两种午后回忆派生只读目录。每项保留原 `eventId`、首次参与者、`completedTick`、标题、原区域、纪念名称及当前摆放区域。没有从正在进行的活动、当前在场居民或重玩总次数补写历史。

当当前社交双方都属于某项首次记忆的真实参与者，且身处不同区域时，可以产生带该事实来源的回忆对白。`communityDialogue` 返回最多一条 `{actor,text,sourceId,eventId}`；`eventId` 每次由原记忆读取，不另存到 community。告别继续使用既有居民语气。Frame 已用此函数替代原 lifeDialogue 的同一入口，避免同一次互动产生两套气泡。

关系目录仍由 `relationship-catalog.ts` 派生。午后回忆作为实际来源加入关系面板，不增加另一份 bond 计数；原 `neighborhood.bonds` 仍是已有的每对居民计数来源。午后 `count` 不被当作每对朋友的次数。

Community UI 的审计属性：

- `data-community-source` / `data-community-recall`：目录来源 ID。
- `data-source-event-id` / `data-source-participants`：原始首次事件和完整首次参与者。
- `data-community-keepsake` / `data-placed-region`：纪念物及当前区域；收起时为 `stored`。

Community 来源 ID 为 `bookhouse-light`、`bookhouse-puzzle`、`tea-square-three-cups`、`afternoon-tea-bookmark`、`afternoon-reflection-shapes`。关系目录中两个新 story 使用其原始 `tea-bookmark` / `reflection-shapes` ID；归因时应核对 eventId 和参与者，不将两种目录 ID 命名方式误判为两个事实。

## B3：有界自主短社交

庭院、书屋和茶会广场的普通生活调度使用 `stepCommunitySocial`。它复用 `life.social` 的邻居选择、实际靠近、朝向、300 tick 互动和回归日常逻辑；没有新增移动 owner。只有空闲或符合既有被观察行为的附近居民才可参与，显式活动/手动移动/拖放优先。

四种 community 展示类型为 `greet`、`recall`、`keepsake`、`invite`。其中 invitation 的具体体验是邀请朋友一起短暂停留，然后继续各自生活；它不会启动茶会、书屋故事或午后任务，也不会替玩家完成任何显式心愿。

| 限制 | 值/行为 |
| --- | --- |
| 下一次尝试 | 成功后至少 900 tick；错过空闲窗口或冷却阻塞时，90 tick 后重新检查，仍检查成功交互的全局/配对/来源冷却 |
| 同一对居民 | 无论顺序，至少 1800 tick |
| 同一回忆来源 | 至少 3600 tick |
| recent | 最多 12 条，按时间排序 |
| 当前互动 | `life.social` 持有开始/结束与移动；community.active 仅持有对应展示元数据 |
| 时间 | 仅模拟 tick；暂停不消耗冷却 |

Wrapper 仅在已经存在 social 时调用旧 `stepLifeSocial`，不会让旧 `%900` 自动创建逻辑绕开新冷却。近期记录与下次尝试时间一起保存，冷恢复不重置冷却。结束、跨区、移除居民、显式操作及拖放同步清理 active，但保留 recent。旧存档已有 social 而没有 community.active 是合法迁移状态；反向的悬空 active 被校验器拒绝。

观察纪念物期间收起或移动该物会先取消瞬时社交，再保存摆放；避免对白指向已消失物品。此问题在集成审查中发现，书屋、茶区和午后纪念物三个命令均已补同步取消。

## B4：可见纪念与三地收藏

两个新纪念由 `afternoon.keepsakes[storyId]` 控制，值仅为 `message-tree` 或 null；只有已存在对应回忆才能摆放。茶区留言树冠前方绘制两件小纸物，收起只改变摆放，不删除回忆或解锁。

`communityCollection` 从原始事实派生三地进度：庭院需要已保存 journal 或 neighborhood memory，书屋需要共读/谜题记忆，茶区需要三人茶会或新午后记忆。仅旅行到达、普通生活和社交不会解锁。三个区域均有真实经历后，庭院 `(304,198)` 自动显示一张三叶小卡。该卡是固定派生展示，没有独立数据库、可拖放状态或额外奖励计数；不提供独立收起开关。

新 `CommunityPanel` 显示三地进度、当前区域经历/纪念及可带到这里的共同回忆。原 `CollectionPanel` 的既有分类保持原用途；本阶段的新下午收藏展示由 CommunityPanel 与 AfternoonPanel 承担。

## 新持久字段

```ts
afternoon = {
  version: 1,
  active: AfternoonEvent | null,
  memories: AfternoonMemory[], // 最多 2 项，每个 storyId 唯一
  lastEventIds: { 'tea-bookmark': UUID | null, 'reflection-shapes': UUID | null },
  keepsakes: { 'tea-bookmark': 'message-tree' | null, 'reflection-shapes': 'message-tree' | null }
}
// memory: storyId, eventId, participants[2], completedTick, day, count, selection
// selection: leaf/wave 或 left/right；count、serial、attempts 上限 1,000,000

community = {
  version: 1,
  nextAttemptTick: number,
  recent: CommunityEncounter[], // 最多 12 条
  active: CommunityEncounter | null
}
// encounter: pair[2], region, kind, sourceId|null, startTick
```

外部输入严格校验键、范围、来源、角色组合、路线、阶段、唯一事件与冷却顺序。community.active 与最近记录、当前 region、life.social 的 pair/startTick 必须一致；历史纪念被收起仍可保留合法 recent。

## 迁移与源码所有者

`living-state-v14.ts` 与 `tea-square-state-v1.ts` 保存旧校验路径。当前 `living-state.ts` 将旧世界迁移到 world15/content11：原世界字段保留，新增空 afternoon 和 `initialCommunityState(old.ticks)`。茶区向 v14 投影时暂置 `life.social=null`，随后使用实际角色位置及当前区域几何单独校验真实 social。Frame 12 通过当前 codec 接收兼容旧世界并拒绝未来版本。

| 工作范围 | 本轮负责人 | 核心源码 |
| --- | --- | --- |
| B1 | runtime_lane | core/afternoon-catalog.ts、afternoon-state.ts、afternoon-engine.ts；client/AfternoonPanel.tsx |
| B2/B3/事实派生 B4 | official_diff | core/community-life.ts；client/CommunityPanel.tsx |
| codec/runtime/frame/统一集成 | 主线程 | living-state/engine/controller、runtime.ts、ManagementPanel.tsx、frame-world/protocol、frame/afternoon-art.ts、关系/通知等 |
| 浏览器及原生证据 | 主线程（接管验收） | 独立验收 runner、隔离 profile 与 evidence |

所有源码均位于本仓库 `packages/ai-village/src`；没有将插件实现搬回 Desktop 宿主仓库。

## 已检查与待检查

最终 pre6：80 个测试文件、446 项测试通过；新增 afternoon 核心 6 项、community 核心/集成 17 项、afternoon 集成 8 项。严格类型、release 构建、空 store 离线安装、真实 A6 Host 存档升级检查均通过。Community 检查涵盖三个真实场景几何中的渐进移动、冷读、冷却去重、无奖励写入、旧 active social 迁移、茶区逐帧校验、旅行/移除/收起。

Afternoon 集成检查涵盖旧 world14 活动迁移、Frame 版本边界、真实 controller pointer 禁止参与者拖放、跨旧入口 UUID 去重、并发开始互斥、暂停取消、CAS ACK 丢失后只读恢复。测试使用受控 fixture 和存储替身，不作为原生客户端成功证据。

真实验收发现并修复了纸道具被树/居民遮挡、无合适对象时等待过久、书屋纪念物交流误用 chime 的问题。书屋使用 chat 动作承载同一来源对白，冻结旧 codec 的场景限制保持不变。失败原件保留，最终浏览器/官方 Desktop 结果详见 [HANDOFF.md](HANDOFF.md)。
