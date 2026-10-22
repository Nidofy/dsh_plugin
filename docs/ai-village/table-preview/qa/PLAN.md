# M5 游戏桌预览：独立 QA 准备

基线：`f9a05621ed5cb4762a79e9d35766772a701a8bcc`，`codex/feature-ai-village-entrance`；起始仅两份既有用户未跟踪文档。读取上一轮 HANDOFF、IMPLEMENTATION、DATA_AND_RECOVERY、CONTENT_AND_ART、实际浏览器/照片/恢复脚本。上一轮已关闭的七项玩法不重复验收。

准备时状态为**脚本准备，浏览器 NOT RUN**；现已完成执行，最终范围和结果见 [RESULTS.md](RESULTS.md)，失败与续跑来源见 [RUN_NOTES.md](RUN_NOTES.md)。只修改本目录和 `scripts/ai-village-table-qa.mjs`，不修改生产实现；主实施通知最终构建后才运行。数据契约 world8 / rules4 / content5 / frame6 / `play.tableMode = dining | game`。游戏桌使用原批准桌体；新增棋盘只能称开发预览，入口 ART_REVIEW 与首帧门禁独立保持。

## 计划闭环

1. 新 `.build/ai-village-table-qa/<label>`、新 profile、原官方鉴权夹具，复制最终lib并独立构建 fixture；每次新label，拒绝覆盖历史输出。记录HEAD/dirty、src和bundle SHA，不输出认证入口/token。
2. 正常布置页启用游戏桌，保存后检查schema8/tableMode、现有eat两席几何不变，纹理不增加。正常居民页加入第二位居民，等待CAS确认而不要求checkbox同步立即更新。
3. 正常入口开始table-game，真实等待两人走到餐桌和观察；canvas按正式投影点击9格。核对一份玩家输入与确定性居民回应同一次确认、重复格/暂停输入不写、取消无记忆。
4. 开始第二局，真实走完终局；结尾观察前不能确认，最终明确确认才写一条首次记忆。中途拍摄真实720×960 PNG、保存相册；新runtime冷读棋局/世界/相册结果一致。
5. 两个eat固定锚点：通过真实家具草稿确认移动，核对桌体/棋盘/命中点/席位一起移动；空间被居民占用时遵循正常拒绝规则，先经UI挪开，不能修改存档绕过。
6. user/hidden暂停保留；未知ACK仅只读对账、不自动重放。直接复用 `ai-village-ui-v11-recovery.mjs` 的故障模式：第三局落子保存已提交但丢响应，同时屏蔽state读取；8.2秒内只发生原来一笔保存，确认有界读取与本地世界冻结，再由正常“重新连接”核对一份玩家+居民回应。不会把通用布局保存通过替代棋局事务验收。
7. 四真实卡片尺寸×浅深主题，至少窄卡棋局内容、末端控制/返回可见；等待有限淡入结束，surface/panel opacity=1后截屏，真实操作录像。
8. 可选50次真正关闭/重开：显式冻结用户暂停，世界不推进，一次只有一个iframe；热态DOM/listener/texture计数检查及最终释放。不能把50次短回归当一小时、硬件显存或完整零泄漏证明。

所有玩法通过实际组件，不改世界tick、不注入完成状态、不调用模型、不访问日常DSH_HOME。失败原样保存；未运行不写PASS。

## 已接入的实际接口与待执行命令

`metrics.tableGame.cells[index].center` 是世界坐标，使用 `viewport.world` 和iframe矩形投影到真实鼠标点击；默认棋盘rect为(189,332,72,24)，替代餐桌锚点整体左移54。模式选择必须先草稿、确认才写；开始按钮为“开始 · 餐桌上的三连棋（开发预览）”，结尾确认为“记下这一局”。每轮ready后才下一次输入，避免把观察阶段拒绝误当非法重复格验证。

准备期只运行 `node --check scripts/ai-village-table-qa.mjs`，已通过。最终构建获准后建议运行 `node scripts/ai-village-table-qa.mjs integration-01 --lifecycle`。如失败保留原目录并选择新label；不会自动覆盖或修改生产实现。
