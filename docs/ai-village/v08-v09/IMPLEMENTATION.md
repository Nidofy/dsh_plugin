# AI Village 0.8 / 0.9 开发记录

## 已核对基线

- 分支 `codex/feature-ai-village-entrance`，起始 HEAD `41f512d61c39aae099190c538a555fc81cfd6466`，插件0.7.0-preview.3，官方DSH0.2.1-rc.2。
- 起始world8/scene3/rules4/content5/preferences3/frame6。三条故事、三小游戏、三人星空、居民个性、自主社交、餐桌棋局预览与横向加载填色已实现，不重做。
- 保留用户未跟踪的NEXT_FEATURES与UI_VISUAL_DIRECTION_REVIEW文档，不纳入提交。
- 门庭ART_REVIEW及生产入口/首帧门禁不变。用户基本安装/视觉通过不代表新场景原画批准。

## 0.8 实施契约

world升级9，content6；scene3/rules4/preferences3/frame6不变。冻结living-state-v8及play-catalog-v5，v1–8依历史解码迁移，新存档保持48KiB上限。

两类双人偶遇：飞走的留言(paper-rescue)与叶子的来信(leaves-gather)，各有三段真实寻路、停留、玩家确认。完成事实沿用neighborhood.memories，重复只增加count；新奖励message-board与leaf-pot沿用play.decorations，均为原创代码矢量小物件，可摆放并由既有居民观察投影读取。

仅新增play.encounterWindow整数（-1为未消费），记录已接受/略过窗口。每2700模拟ticks一窗，固定独立hash确定300–599tick偏移，窗口1800ticks；每两窗两种事件以伪随机先后出现，不读系统时间、不消耗居民RNG。当前offer由ticks投影，无永久循环、离线补算或惩罚。接受/略过验证窗口token并同次CAS保存；取消/离场/寻路超时消耗本窗口但不发奖，已接受活动可以跨窗口继续，隐藏/关闭保持原暂停与冷恢复。旧窗口迟到请求拒绝。

收藏和长期目标完全由已确认的现有手账、共同经历、摆放与已读取相册派生，无额外历史存储。相册未读取显示未知，删除照片会减少当前数量。仍在居民/心愿/布置/手账四入口内。

## 验证记录（持续更新）

- 初次专项23/24通过：旧v7活动测试从当前world手工构造时漏删新字段，修正fixture显式去掉v9字段；历史解码器继续拒绝未知字段。
- 初次全量226/227通过：host.spec使用旧.build/ai-village-phase4/lib，而源码已为schema9，保存被旧Host拒绝。须重新构建并重跑，不放宽验证。
- 新encounter测试覆盖窗口、独立RNG、迟到token、接受/略过/取消、隐藏、确定性冷检查点、非法字段、v8原字节保护与CAS冲突。
- 后续类型、完整回归、真实界面、性能、离线包身份见本目录RESULTS与qa证据。

## 0.9 门禁

先完成0.8功能、数据、资源与实际浏览器门禁，再接入书屋。书屋如无批准原画仅为明确标注的开发样板，不称正式美术。独立场景/家具/合法走区/资源与转场，单owner单CAS共享长期进度；具体审计见BOOKHOUSE_AUDIT.md。

0.8 最终门禁已关闭，书屋源码已在同一分支提交为 `f346b20`。实际数据与资源契约见 [BOOKHOUSE_IMPLEMENTATION.md](BOOKHOUSE_IMPLEMENTATION.md)，候选包身份见 [PACKAGE_V09.json](PACKAGE_V09.json)，逐项验证及交付边界见 [BOOKHOUSE_RESULTS.md](BOOKHOUSE_RESULTS.md)。旧0.8证据保持独立，不能用来替代0.9验收。
