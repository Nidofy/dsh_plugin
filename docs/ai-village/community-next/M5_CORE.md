# M5 茶会广场核心实现（获批场景集成验收中）

2026-10-25 用户已明确批准茶会场景候选继续集成，当前工作树将 `tea-square` 登记为 available，并通过原有唯一旅行流程进入。早期内部 fixture 测试仍保留；正式可玩资格须由真实界面运行与最终包证据确认。0.13.0-preview.1 冻结门禁包仍为 planned。

## 格式与冻结

- 当前 `world14 / content10 / region2 / frame11`；茶区 `sceneVersion1`，逻辑 360×480，几何按契约 v2。
- `living-state-v13.ts` 保存原 world13 解码器；先经原13验证，再补 region2 茶区返回脚点和空茶状态。旧1–13仍沿冻结链读取，原 worldId、tick、RNG、故事、手动路线和返回脚点保留。
- 本轮未覆盖 `.build/ai-village-community-v012-frozen` 或已冻结的 0.12 dist 包。

## 唯一持久状态

`world.teaSquare = { version:1, active, activity, memory, lastEventId, keepsake }`。

- `active`：`kind:'three-cups' / version1 / UUID id / 三位稳定排序参与者 / stage0..2 / phase approaching|observing|ready / 剩余观察tick0..90 / 接近预算1..2400 / 三目标和每人最多9路点 / seed1..uint32 / 三槽board(-1..2且无重复) / serial0..1000000`。
- 动作 token 为 `id:stage:serial`，每次杯垫重排或重置均递增；正确顺序由持久 seed 派生，视图不消费随机数。杯垫无倒计时；只有接近路线有界。
- 收尾按稳定三人顺序从契约 v2 已有留言树与旁观位 `(54,348)、(304,258)、(262,380)、(306,348)、(98,380)` 选择实际可达且互距至少24的位置，不挪动旁观者。冷恢复严格重检这些候选、route、actor destination及phase。
- `activity`：单人 `counter → choosing → seat → waiting`，独立有界路线/座位/期限2400tick；在柜台等60tick、座位等180tick，无完成奖励。其他居民继续普通模拟。
- `memory`：首次 `eventId / participants[3] / completedTick / day / count`；重玩仅增count并更新lastEventId。永久三叶茶签由该事实解锁；首次挂到留言树，后续重玩保留用户收起/摆放选择。通知、手账、收藏与三对关系全部从同一memory派生，不写第二份奖励或伪造各对的重玩次数。
- 暂停/隐藏沿现有owner暂停；故事到齐前拒绝动作，取消/堵路预算耗尽不奖励。重要参与者拖放在 runtime权威输入层显示EVENT_ACTIVE。堵路取消返回blocked，由现有反馈显示PATH_BLOCKED。

## UI 接口

`VillageRuntime` 方法均复用 `neighborhoodCommand → commitWorld` 的单owner/CAS；未知回执只读核对，重复动作不重发。

- `startTeaSquareStory(participants: CharacterId[])`
- `actTeaSquareStory(token, action: 'continue'|'place'|'reset'|'remember', choice?: 'item:slot')`
- `cancelTeaSquareStory()`
- `startTeaSquareActivity()` / `cancelTeaSquareActivity()`
- `placeTeaSquareKeepsake('message-tree'|null)`

`tea-square-state.ts` 导出 `teaSquareStages`、`teaSquareLine(id,locale)`、`teaSquareOrder(seed)`、`teaSquareToken(event)`。错误沿用 EVENT_ACTIVE、INVALID_INVITATION、PATH_BLOCKED、FURNITURE_OCCUPIED、PLAY_NOT_READY、STALE_PLAY_ACTION、INVALID_PLAY_ACTION、DECORATION_LOCKED、INVALID_SLOT；新增 TEA_SQUARE_REQUIRED。

## 渲染与资源接口

- `scene.ts` 独立识别茶区并创建/释放 `TeaSquareArt`；帧父桥与协议接受第三地区；照片标题标识 Tea Square。
- 当前 `residentAssets(ids,'tea-square')` 选在场居民及四张获批茶区图，不加载庭院七张环境图或书屋图集；原七人125张、压缩25,075,724 B，场景新增RGBA4,487,424 B。
- `TeaSquareArt` 中背景、后层、茶桌前层3210、茶柜2410、树2370、杯垫道具3211、茶签2400为独立同级节点。茶桌覆盖桌后脚部，道具在桌面上。构造器现支持可选只读texture map：tea-square/background.png、tea-square/tea-table.png、tea-square/tea-counter.png、tea-square/message-tree.png齐全且未销毁时使用四张Sprite，完整家具按底边×10−10放前层；任何缺失或已销毁纹理均整体退回显式开发绘制。scene传入现有textures，不新增加载器。现已登记四key、独立批准scope、尺寸/hash/预算并开放地图；正式运行验收另记录。杯垫中心y280、道具z3211与独立评审图一致；图片已含杯壶，不重复叠画代码杯子。destroy仅销毁自己Sprite，借用的Texture与source保留由既有加载器管理。
- `paint(world)` 只读取当前事实；茶签真实显示参与同一场景/照片；`destroy()` 只释放拥有节点。

## 已执行验证

- 茶core/runtime/Host/frame解码/资源选择/绘制生命周期 48/48 PASS（其中茶核心7、runtime36、Host1、frame1、region-assets2、tea-art1）。
- 旧迁移/旧UI fixture修正后的 table/encounter/play-panel/roster/tea 36/36 PASS，maxWorkers2。
- 独立只读官方Host/Client严格类型检查 PASS；主线程已完成标准构建类型检查并刷新Host产物。
- 首轮全套338测330PASS、8FAIL保留为发现记录：旧fixture遗漏6项已修正并针对重跑；旧Host13产物1项主线程重建后PASS；roster并行读盘30秒超时1项独立2worker重跑PASS。最终全套由主线程统一执行。
- 本阶段未自行打包、发布、提交或开放茶区。真实浏览器/原生茶玩法、美术签收和七人候选性能仍需后续门禁。

四纹理可选注入准备：茶绘制与资源选择9/9 PASS，逐一缺失四key、已销毁纹理、完整几何深度、共享texture/source保留均覆盖；严格只读官方types PASS。未构建或打包。
