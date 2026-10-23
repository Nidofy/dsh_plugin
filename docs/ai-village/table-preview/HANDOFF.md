# 桌面棋局预览交接

后续加载反馈已修复为 **0.7.0-preview.3**：七人从左到右横向顺序填色，快加载平滑追赶真实进度；世界和棋局逻辑不变。最新包身份及专项证据见[loading-fill/RESULTS.md](../loading-fill/RESULTS.md)。下文保持preview.2的原生验收与功能交接历史。

工作目录 `D:\Documents\FeiyangChen\devApps\dsh_plugin`，继续已有分支 `codex/feature-ai-village-entrance`。本轮基线 `f9a05621ed5cb4762a79e9d35766772a701a8bcc`，生产实现提交 **`de862de4dfb2c8621715ed8c3ff6682fcbfc6117`**。后续提交只保存验收脚本和证据；交付记录提交可用 `git log -1 --format=%H -- docs/ai-village/table-preview` 查得，接手先核对实际HEAD与工作树。

## 已实现

本地 **0.7.0-preview.2** 在原餐桌上增加显式开发预览三连棋。启用/取消桌面草稿，原两席真实寻路，场景与键盘九格输入，每次玩家和居民双方落子同一CAS，明确终局收尾，首次回忆与可摆放“同桌棋子”。正常用餐及餐桌故事自动暂收棋盘，结束后恢复，不改旧日程或RNG。当前schema8/scene3/rules4/content5/preferences3/frame6；旧1–7迁移、未知写只读核对与旧原件保护继续有效。

生产、测试、构建已冻结。全仓严格类型、40文件211专项测试、正式构建、276文件打包、真实CLI解包smoke和空缓存offline安装均通过。最终包在忽略目录 `dist/nidofy-dsh-ai-village-0.7.0-preview.2.tgz`，32,165,883 bytes，SHA256 **`cff972c6bffb91d62d78148cc4df3a46edd0d48dffbcb137c4b34a86a96c08d4`**。包不可与两个被保留旧候选混用，详见[PACKAGE.json](PACKAGE.json)。

浏览器最新结果见[qa/RESULTS.md](qa/RESULTS.md)，真实官方Desktop结果见[native/RESULTS.md](native/RESULTS.md)。每轮证据绑定源码/包身份；旧候选的矩阵/启停证据有明确范围，不自动当作最终包全量复跑。失败目录原样保留，修复理由有记录。

最终包直接实测包括：茶会暂收棋盘及自然复显、Canvas双方一轮、真实照片入册；七居民棋局场景约22.0FPS，七居民自然生活约22.5FPS，隐藏后0帧/0纹理且世界不变（均为20秒软件样本）。官方Desktop实际安装、进行中棋局和相册精确冷恢复、合法续局首次完成、再次完成态冷恢复通过；测试进程均已关闭。原生到席曾超时，原因未确定，不以功能成功代替原生性能门禁。

## Ownership与边界

主实施负责schema/codec、纯棋局规则、引擎/runtime/frame协议、集成与打包；play_ui负责UI、runtime专项及用餐显示兼容；life负责桌面几何/绘制与独立native验收；audit_qa只负责独立脚本及qa证据。现有源码已集成，不应再次让多个代理修改同一核心文件。

两份起始用户未跟踪文档没有纳入提交或改字节：`NEXT_FEATURES_2026-10-21.md` SHA256 `96a5d3e87dcdd00989195f5f6c634ce602f962a891a1c3a655e84cee26de6dd8`；`UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md` SHA256 `127e7704dffa665a452bbfd4f7df4a79ef27e96561a6490dea0935b553f8d9ec`。不得clean/reset删除。没有修改Desktop宿主源码、日常DSH_HOME、远端仓库或美术批准。

入口候选仍 **ART_REVIEW**，生产静态选择器与首帧门禁不变。棋盘是原创代码矢量开发预览，原餐桌与角色均复用已批准资源；没有新家具原画或新的准确抓棋手部资产。旧preview.1不能读schema8；回退只可停止新包并在另一隔离profile使用受保护旧快照，禁止删字段降级新档。

## 未完成和下一项

没有把本次交付称为完整0.8/0.9。M2独立可重复随机小事件、M4全部主题收藏分类、M5正式新家具/手部资产、M6书屋仍未全部实现。Windows硬件GPU/DPI/多屏、真实IME及模型并行负载、一小时GUI不因本次短时隔离测试自动通过。

下一项可独立推进的代码工作是M2两类随机小事件：先复核现有自主社交与手动故事，采用稳定ID、模拟tick窗口、有界冷却和独立随机源，避免改变rules4旧RNG消费；玩家明确接受后进入原阶段/路径/CAS流程，拒绝/隐藏/离场语义清楚。不可自动完成特殊心愿或额外创建历史存储。新增持久字段须冻结当前8解码器并明确迁移；按现有四入口接入，经真实隔离UI与旧档保护验收再扩展。

M6须待0.7/0.8完整玩法、性能与数据门禁通过后继续。批准书屋原画缺失可做明确标记开发样板，但不能先改正式世界身份或把占位场景发行成最终内容。

## 继续执行Prompt

> 在 D:\Documents\FeiyangChen\devApps\dsh_plugin 的 codex/feature-ai-village-entrance 继续。先核对实际HEAD/工作树，读本目录IMPLEMENTATION、PACKAGE、qa/RESULTS及native/RESULTS；保留两份用户未跟踪文档。生产实现de862de已增加可完整游玩的餐桌三连棋，211测试/类型/构建/离线通过，最终包SHA cff972c6…96c08d4。不要重做已有证据关闭的阶段，不混用旧候选SHA。优先处理验收中新发现的问题，然后推进M2两类有界可重复随机事件及现有收藏分类；沿用单writer/CAS/模拟时间，明确旧8迁移和独立随机源，先实际玩法后验证。入口ART_REVIEW、首帧门禁、日常profile和远端发布边界不变。0.8完整门禁通过前不提前发行AI书屋；按清楚ownership持续推进可独立完成的工作。
