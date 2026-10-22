# 0.7–0.9 持续开发记录

2026-10-23。实际起点 `963a501947b74498d0924a1c6892aecd3ef116bc`，按用户纠正使用已有 `codex/feature-ai-village-entrance`，工作目录为独立 `dsh_plugin`。此前误建的 `codex/ai-village-living-07` 没有提交，不作开发分支。原有两份未跟踪规划文档保留。

## M0：数据与实施契约

本地基线为插件0.6.4、DSH0.2.1-rc.2、world6/scene3/rules3/content3/preferences3/frame4。原有14种互动、12类手账、三布局、家具锚点编辑、照片相册与生产静态入口已实现。入口候选仍ART_REVIEW；修复后的实施方复测不冒称独立QA或人工签收。

- 保留schema1–6及旧规则的解码和行为；新增LivingWorld schema7/rules4/content4，scene3与preferences3不变。升级通过SaveStore现有codec与旧原字节保护。
- 七位偏好为只读目录；模拟时间不读系统时钟；新选择不消费旧规则RNG。短自主社交只保存当前事实，不自动写玩家心愿。
- 连续故事/小游戏有稳定ID、阶段、参与者、有限路径、观察时长及取消；只允许一个主要活动。玩家确认优先，剧情其次，自主社交再次。
- 新回忆沿用neighborhood.memories及其首次事实/次数结构，不另设收藏数据库；历史投影只交给旧解码器旧目录内容。奖励由回忆决定，同一CAS确认后可见。
- 新剧情状态、摆放挂点与回忆同世界保存，继续48KiB/64KiB上限。所有输入按闭合字段及有限目录校验，不静默重置、不重放未知写结果。
- UI沿用四入口与UI-v1.1；frame在原循环绘制新物件。若增加场景点击意图，版本显式升级并保留首帧回执语义。
- M5/M6依赖玩法、性能和资源门禁；未批准场景不进入生产选择器。

## Ownership

主代理：living-state/engine/controller、旧模块接入、Host/runtime/frame、迁移与集成测试。
life：life-catalog/engine、角色部件动作及独立测试。
play_ui：play-catalog、PlayPanel及独立测试。
audit_qa：本目录qa、独立浏览器脚本及证据；不与实施者共享可写QA输出。

## 当前交付状态

本轮产物为 **0.7.0-preview.1 本地预览**，不宣称0.8/0.9完整路线完成。世界7/规则4/内容4/frame5已落地；scene3/preferences3不变。没有远端发布、main覆盖或美术批准。

| 阶段 | 实际结果 | 尚未关闭的范围 |
| --- | --- | --- |
| M0 | LivingWorld闭合契约、1–6读取迁移、同一SaveStore/CAS、大小上限与原件保护 | 原生Desktop升级验收未重做 |
| M1 | 七人偏好驱动选择、七种部件专属动作、六类短社交、模拟昼夜、结束释放与减少动态 | 全部动作的逐角色人工观感和真实GPU/DPI验收；受打断专属动作尚未全面接入 |
| M2 | 三条多阶段故事：蓝鲸丢失的白米饭、安静的一页、风带来的便笺；三人星空；实际移动、观察、冷却、恢复与首次纪念 | 当前可重复机会来自自主社交和重玩，未新增两类独立随机剧情事件目录 |
| M3 | 场景点选找鲸/有限提示；书桌拖放、键盘、重置；三轮茶点偏好反应；取消与同一保存事务 | 原生触控、真实IME及宿主模型并行负载未验证 |
| M4 | 原回忆集合扩至19类；七件有界纪念物可摆放、拍照与被附近居民观察；三项派生长期目标 | 未完整扩展独特瞬间、特殊合影等全部主题分类；不声称新大型家具已完成 |
| M5 | 已核验批准素材、七类家具的身份/锚点/互动/人数/来源及缺口 | 新家具未实现。现有母图没有茶水架、秋千、玩具篮等正式资源；不能重命名旧家具当新增成果 |
| M6 | 明确书屋开发样板与正式资源的边界 | 尚未实现；0.8完整玩法/性能/数据前置门禁未成立，无批准书屋母版，不能提前改固定世界身份 |
| M7 | 188专项测试、全仓类型检查、正式构建、解包及空缓存离线安装通过；真实组件截图/录像及恢复专项见qa | 软件浏览器证据不替代硬件验收；一小时真实GUI保持未运行 |

## 代码与内容入口

- `core/living-state.ts`、`living-engine.ts`、`living-controller.ts`：当前世界、故事状态机与原生活规则接合。旧home/neighborhood解码和行为保留。
- `core/play-catalog.ts`、`client/PlayPanel.tsx`：七项可玩内容、中英文与四入口内操作；没有新增顶层窗口。
- `core/life-*`、`art/animation.ts`：七人偏好、确定性短社交及独立纸娃娃部件表现；不消费旧版本RNG。
- `frame/play-art.ts`、`core/keepsake-observation.ts`：原创代码矢量纪念物、统一世界坐标、照片与观察反应；没有引入新纹理循环。
- `client/runtime.ts`、`host/service.ts`、`core/frame-protocol.ts`：沿用事务和暂停；仅增加经过校验的找鲸意图。候选入口状态、选择器及首帧ACK门禁保持原状。

数据字段、取消、未知结果与回退说明见 [DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md)；资源和消费者证据见 [CONTENT_AND_ART.md](CONTENT_AND_ART.md)；本地归档身份及实际命令见 [PACKAGE.json](PACKAGE.json)。独立浏览器各轮失败与继续验证保留在 `qa/`，不以最终成功覆盖早期失败。

## 工程验证及限制

本轮运行 `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`，37文件188测试通过。涵盖七项完整状态链、移动/碰撞、取消/暂停、首次事实/重复次数、旧1–6格式读取、v6原字节经42次保存仍保护、真实runtime未知ACK只读核对、迟到令牌以及原功能回归。108000tick测试是模拟一小时，不是真实GUI一小时。

`node scripts/typecheck.mjs`、`node scripts/ai-village-release.mjs`、`node scripts/pack.mjs --only=ai-village`、`node scripts/smoke-packed.mjs --exclude-sandbox`、`node scripts/offline-install-check.mjs --exclude-sandbox` 均通过。安装使用隔离profile及空缓存，未触碰用户日常DSH_HOME。归档为32,154,137 bytes，SHA-256 `c58e61c2d7aa8a2854be0dc0158ce0521d88bff3f2bc09e2cc2ff31275b73445`，未提交生成包。

入口维持ART_REVIEW。缺少正式新家具/书屋资源和0.8前置验收时，不把原始几何样板作为正式美术发行。可独立进行的资源核查与制作规格已完成；下一项可实施代码工作是基于批准餐桌的受控游戏桌开发预览，先验证轮次/占用/取消与既有保存，再独立审定新增棋盘视觉；书屋必须排在0.8门禁之后。

## 最终隔离浏览器结果

见 [qa/RESULTS.md](qa/RESULTS.md)。integration-02已真实完成三故事/三小游戏，随后测试脚本对异步居民checkbox立即检查导致FAIL；integration-03核对83份生产源码及三个bundle完全相同后在同一专用profile继续，完成三人星空、七人运行、冷读、窗口和隐藏/会话检查。没有将02整体改成PASS。90.51秒自然观察实际得到一次chat，其余社交类型不冒称已在本轮录像逐项出现。

七人20.01秒软件样本22.74FPS、p95 JS提交0.70ms、128纹理；隐藏20.01秒为0FPS/0纹理、父页面CDP TaskDuration约单核0.2322%，且世界完全不变。可见父页面单核47.75%不是进程总CPU，也不是同硬件独占基线对照；不据此宣称硬件CPU预算或全部性能门禁通过。

matrix-04等待面板与内容淡入结束后才截屏，四尺寸×双主题24张新内容/滚动/居民图均有opacity=1元数据。主实施亲自查看340浅色与320深色底部图，文字及返回可读，最后一项三人活动可达。原integration-03中途淡入截图保留，不作为最终静止观感凭据。

原 `ai-village-ui-v11-recovery.mjs` 在独立recovery-01目录以原断言重跑PASS：心跳失败只读恢复并保留装修草稿/撤销/user/同iframe；隐藏停止自动读取；保存已提交但ACK丢失仅一次save；第二个认证runtime不能夺取owner。未改变生产代码来适应测试。截图、录像及具体命令均由独立QA记录。
