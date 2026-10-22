# preview.2 实际官方 Desktop 安装与冷恢复

日期：2026-10-23。**本次最终包的实际安装、真实棋局输入、相册保存和两次完整进程冷恢复已通过。** 这不是一次从头到尾无失败的自动化执行；脚本在真实 UI 上遇到的问题、分段继续和启动限制均保留在下面的证据目录。没有重置测试世界、伪造到席、改时间或向世界直接写入数据。

## 固定身份与隔离边界

- 产品源码提交：`de862de4dfb2c8621715ed8c3ff6682fcbfc6117`，分支 `codex/feature-ai-village-entrance`。
- 安装包：`dist/nidofy-dsh-ai-village-0.7.0-preview.2.tgz`，32,165,883 bytes，276 files。
- SHA256：`cff972c6bffb91d62d78148cc4df3a46edd0d48dffbcb137c4b34a86a96c08d4`。最早的 `1ca036…` 包没有安装，不能混用其身份。
- 载体：缓存的官方 `.build/ai-village-phase5/carrier/DeepSeek Harness.exe`，EXE 和 app.asar package 均为 `0.2.1-rc.2`；CDP 回报 Chrome `152.0.7977.130`。
- 全新工作目录 `.build/ai-village-table-desktop`：`home` 作为 DSH_HOME，`electron-data` 作为独立 Electron user-data，CDP `127.0.0.1:18765`。
- 通过官方 Plugins → Add plugin → 本地 tgz → Install → Enable now 安装，之后完整重启。安装目录的 package version、index/client/frame bundles 及 scene.json 与最终构建逐字节一致。
- 没有修改宿主源码、日常 profile、ACL 或 sandbox 参数；没有下载载体、安装 SDK、输入 API key、发送聊天或复制旧用户数据。宿主可能自行进行更新检查，本记录不声称宿主全程零网络请求。

## 实际通过的步骤

| 证据 | 实际检查 |
| --- | --- |
| [install-01](install-01/result.json) / [官方安装截图](install-01/installed.png) | 官方管理器安装固定 SHA 的 preview.2，并启用；随后真正重启宿主进程。 |
| [check-02](check-02/result.json) | 布置 → 家具中选择 Game surface 仅形成草稿，Cancel change 不写入；再次选择并 Confirm table use 保存为 game。此轮随后在测试工具复选框瞬时断言失败，见下表。 |
| [check-04](check-04/result.json) / [真实到席](check-04/residents-arrived.png) | 沿用同一世界、同一局；Bluewhale/Claude 通过真实模拟走到原餐桌两席 `(175,374)` / `(273,374)` 并进入 ready。关闭面板、等退场后以生产 table geometry 和 viewport 投影计算第 0 格坐标，`elementFromPoint` 确认命中 iframe，真实鼠标落子，原子保存玩家圆圈和居民叉号共两子。此轮随后在新空相册的测试脚本假设处失败。 |
| [check-05](check-05/result.json) / [原生棋局照片](check-05/native-board-postcard.png) | 延续同一棋局与已拍摄的预览，通过 Save to album 保存实际 renderer PNG；720×960、1,310,535 bytes；相册 hash 与读取字节一致，拍照前后暂停世界逐字段相同。保存中途棋局冷恢复 checkpoint。 |
| [restored-01](restored-01/result.json) / [中途棋局冷恢复](restored-01/cold-restored.png) | 终止并重启整个身份匹配的测试进程树，重新打开真实小院。暂停世界（含两子 board/choices、住民、坐标、schema8）、相册索引逐字段一致，每张图片字节 hash 一致。随后 Resume，通过正常九格面板逐轮合法落子及 Remember this game 完成，首次 table-game memory count=1。 |
| [final-restored-01](final-restored-01/result.json) / [完成态冷恢复](final-restored-01/cold-restored.png) | 再次终止并重启整个测试进程树，完成态世界和相册、图片 hash 再次精确匹配。最终 ticks=1411、userPaused=true、tableMode=game、active=null，首次完成 tick=1405、count=1。 |

照片 SHA256：`286760404a6f9e29fb8ae5ab5f01a73fa4beff64b4bdf0eb2e97e29b96b73d96`。该照片实际可见两位居民、桌面和圆圈/叉号，已人工查看工具输出。

新纪念物的解锁依据是该首次完成事实；本轮没有在 native UI 中摆放“同桌棋子”。最终 `play.decorations['table-stones']` 仍为 `null`，不能把解锁说成已经摆放或拍摄纪念物。摆放消费者的其它覆盖见本轮专项和实现记录。

## 失败与局限，没有抹去重跑记录

| 记录 | 事实及处理 |
| --- | --- |
| [STARTUP](STARTUP.md) | 首次受限隐藏启动被 Electron install_dir_access ACL 检查拒绝。工具正常 `require_escalated` 启动成功；没有照错误建议改 ACL。首次失败主进程终止时一个子进程拒绝终止，后来正常权限只读确认该子进程已退出。 |
| [startup-01](startup-01/result.json) | DOM 检查成功；旧 fromSurface=false 截图为黑图，不作为视觉通过证据。后续 fromSurface=true 安装及游戏截图成功。 |
| [check-01](check-01/result.json) | More 浮层尚开，Decor tab 不在可用状态，导航超时。修复脚本为关闭浮层并等 260 ms 退场后导航。此轮只保存了暂停，不曾启用棋局桌面。 |
| [check-02](check-02/result.json) | Playwright `check()` 在受控复选框异步 ACK 前立即要求 checked，失败；随后失败截图已经显示 Claude 入住。改为正常 click 后等持久 world 成员确认，继续时只读识别已完成动作，没有再点击移除住民。 |
| [check-03](check-03/result.json)、[inspect-live-01](inspect-live-01/result.json)、[inspect-live-02](inspect-live-02/result.json) | 真实 approach/observe 超过脚本的 120 秒就绪窗口。此前只读世界 ticks 从 33 进到 300，主页面 hidden=false / visibility=visible，不能归因为页面隐藏。发现无 API key 的欢迎页在冷启动后再次出现；随后用官方 Add API Key → Set up later 关闭。后续沿用同一局自然到席成功，没有快进时间。早期 iframe 指标读取器按 URL 寻找 srcdoc iframe，返回 null，未取得该时段 frame visibility/FPS；因此缓慢原因仍未确定，不能宣称已证明欢迎页是原因。 |
| [check-04](check-04/result.json) | 初次相册尚无索引时 API saved=null，脚本直接读 `.world` 抛错；此时两子棋局和真实照片预览已存在。改为初始计数零，check-05 从相同世界继续，通过 UI 保存。没有伪造相册索引。 |

宿主和脚本启动一律指定 `-WindowStyle Hidden`；这不保证 Electron 后续永不显示窗口。冷恢复模式都处理真实欢迎页，不注入 visibilitychange 或伪造可见性。最终只读 [final-inspect-01](final-inspect-01/result.json) 记录主 page 与实际 iframe 均 visible，frame paused=true、tickerStarted=false、frames=4、actors=2、textures=48。该数据只是暂停快照，**不是 native FPS/GPU/长期性能结论**，不能将 4 帧的 p95 作为运行性能样本。

本轮没有跑原生一小时 soak、多 DPI / 多 GPU、原生七人长期自主生活、原生纪念物摆放、人工美术签收或全矩阵游戏结果。浏览器软件渲染的性能数据另见 QA，不能替代此处未测的原生性能。开发棋盘仍是 development preview，入口 ART_REVIEW 与正式资源门禁未动。

## 执行与清理

新脚本为 `scripts/ai-village-table-desktop-launch.ps1` 和 `scripts/ai-village-table-desktop.mjs`，不覆盖历史 Desktop 验收。`AI_VILLAGE_EXPECTED_SHA` 必须设置为上面的最终 SHA；脚本每轮必须使用新的证据 label，已有目录会拒绝覆盖。模式 `check-continue` / `photo-finish` 用于本次真实分段继续，并分别断言当前桌面/棋局，不能把分段结果描述成一次无失败运行。

典型新 profile 流程：launch → `install <new-label>` → launch `-Restart` → `check <new-label>` → launch `-Restart` → `restored <new-label>` → launch `-Restart` → `final-restored <new-label>` → launch `-Stop`。本次具体运行的中间失败、只读 inspect 与继续模式如上述目录完整保留。

最后 PID 16120 及其子进程经 EXE 和独立 user-data 命令行身份校验后全部停止，随后确认 CDP 18765 已关闭；已通知另一代理开始最终串行性能样本。所有原始认证日志、profile、checkpoint 留在忽略目录，不加入 Git；提交证据仅含测试世界、脱敏启动事实和界面/照片。脚本 `node --check` 与相关 `git diff --check` 通过。
