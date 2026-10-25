# 0.11 原生 Desktop 验收

最终清理：`cleanup-final.json` 确认仓库测试 carrier 进程数 0、18772 监听数 0；隔离 profile、最终 checkpoint 和所有失败/通过证据保留。

仅使用仓库隔离目录 `.build/ai-village-life-qa-desktop-v011`、CDP `127.0.0.1:18772` 和固定官方 Desktop `0.2.1-rc.2`。未使用日常 DSH_HOME、API key 或生产存档。全部世界变更来自可见 UI；只读 `/state` 用于确认已落盘事实，没有注入 tick 或世界。

最终候选：`0.11.0-preview.1`，47,064,850 bytes，SHA-256 `d610dda53197a7253785c069637bfcfa01978de3d1c7f2597a5b8bc9612e4d18`。安装通过官方 Plugins 管理器；玩法前对已安装 `index.js`、`client.js`、`frame.js` 与该 tgz 逐字节比较。

环境：Windows 原生窗口，DPR 1.75，1279 × 821 CSS px，Intel Arc 140T GPU，驱动 32.0.101.8243；CDP 显示 GPU compositing/WebGL enabled，未强制软件渲染。此环境信息不能替代测量期间的性能结果。

## 已完成

- `prepare-02`：只读检查官方原生窗口与 GPU 信息，通过。
- `install-01`：固定 SHA 包经官方 UI 安装并启用，通过。原生操作录像 14.73 秒，421 帧。
- `story-02`：Seedance 首次确认入住自动开始，两段真实位置变化和玩家操作完成并保存，count = 1。该次整体运行在随后的 QA 导航步骤失败，不能标整个运行 PASS；初见完成证据单独保留。
- `story-03`：从同一存档继续，已完成的初见仍为一次；蓝鲸/Claude 专属三段故事完成；独立书屋谜题经过书柜、阅读桌、窗座和三次真实页面放置完成，首次参与者为 Bluewhale/Seedance，没有共读回忆或微光书签。共同回忆册有 12 个居民选项、11 个关系详情，切到 Gemini 不会错误出现首次谜题来源。整个续跑 PASS，11 PNG，148.96 秒/1389 帧原生操作录像。
- `checkpoint-04`：未完成最小化观察后的等待期间出现 OWNER_LOST 恢复门；使用官方开门按钮一次成功重入，再通过 UI 暂停并保存完整冷启动比较点。没有恢复上一 revision，也没有注入或重写世界。
- `performance-05`：7 位居民，正常 GPU、无录屏/CPU profiler，庭院 20.924 秒为 25.808 FPS、p95 paint 0.9 ms、128 textures；书屋 20.714 秒为 25.538 FPS、p95 paint 1.1 ms、121 textures。均通过原 20–35 FPS 门限，两地关闭浮卡/重开后暂停世界逐字段相同。身份核验完整隔离进程树（含 Host）CPU 分别为单核的 23.293% / 25.266%，测量前后进程成员不变。窗口可见但不是 OS foreground；不能把该短样本扩展成长时间稳定性或系统前台性能结论。
- `admission-race-04`：同一最终包/原生存档，暂停状态下 Grok 连续 3 轮离开、重新入住、保存后马上导航均通过。每轮依靠真实 UI、资源下载、首帧回执与完整入口门禁，没有注入或跳过门禁；帧消息与 DOM 变化只读观测保留在 `frame-ui-observation.json`。`checkpoint-05` 保存最新精确暂停比较点。
- `cold-restored-01`：主线程核验隔离身份后停止原 PID11384 完整进程树，用同一隔离 profile/CDP18772 重新启动 PID44392；官方界面打开小院后，整个已保存世界与 `checkpoint-05` 逐字段相同（7居民、庭院、tick14807、userPaused=true，以及初见/配对/谜题事实），通过。截图等待有限 CSS 动画完成，录像保留3秒/92帧的实际新进程开院过程。

录像由实际 Electron 的 `dsh-app:` 页面通过 CDP `Page.startScreencast` 捕获，并用原始帧时间戳合成为 MP4。它不是 headless 浏览器录屏，也不包含操作系统窗口边框或其他应用。原始逐帧文件在忽略的隔离目录，证据目录保留 MP4、`video.json` 时间戳和 SHA-256。录像存在额外开销，不能用于正常性能对比；性能模式不录屏、不启用 CPU profiler。

## 保留的失败与原因

- `prepare-01`：第一次在沙箱内启动缓存 Desktop 时 Windows sandbox token 读取 carrier 失败，无 CDP 监听。主线程未改 ACL，使用批准的沙箱外隔离启动后 `prepare-02` 成功。
- `story-01`：Playwright `check()` 要求控件立即勾选，但此控件等 CAS 保存后才更新。读取已保存世界确认 Claude 已入住；QA 改为 click + 等待保存事实，未改产品和断言。
- `story-02`：初见成功后停在 Wishes 的 quick 摘要，QA 漏点 All wishes，找不到完整列表的 Begin。保留原结果，补导航后从同一存档继续 `story-03`，未重置进度或重发初见奖励。
- `minimize-01`：观察脚本已取消用户暂停并等待真实 OS 最小化，但 120 秒内未观察到 hidden，原始脚本结果保留 FAIL。主线程后来确认 Computer Use 的窗口状态查询返回 `Computer Use app approval timed out`，从未执行最小化、激活或输入。因此真实最小化/恢复结论为 **未验证**，不是产品失败，也不是已通过；不重试或以其他状态模拟替代。
- `checkpoint-01/02/03`：在 OWNER_LOST 恢复门等待 iframe 超时；QA 最初按按钮可见文本查找，实际 accessible name 为 `Open the doors and enter again`，因此没有点击重入。`checkpoint-03` 保留请求路径与状态，可见 heartbeat 409、state 200，没有 acquire。修正定位后 `checkpoint-04` 成功，不能把前三次脚本失败描述为产品入口重试失败。OWNER_LOST 初始触发原因尚未确认，不能归因为 GPU 或最小化。
- `performance-01`：QA 初版仅等到首帧就导航，尚未确认入口移除/HUD 可操作；随后加入 `data-entered=true` 观察，未降低产品门限。
- `performance-02/03`：暂停状态逐个接纳现有居民时导航超时；结束后重新连接 CDP 检查时曾见入口 `wait`/75%（另一次采集88%）及 `inert`，`reopen-01` 保留原始 DOM。最初将其解释为持续入口缺陷，后续逐事件观测纠正了这一推论：不能将不同 CDP 连接时刻的观察拼成“入住后持续90秒卡在75%”。
- `admission-race-01/02/03`：针对上述现象的原生复现均保留 FAIL。第三次决定性证据显示：热更新收到有效 `assets-ready`、`first-frame-rendered`，进度到100%，入口完成；最终 Residents 的 pointerdown/up/click 时 `aria-selected=true`、`inert=false`，该点击正常关闭了已打开的页签。等待30秒后、失败截图前主动读取仍为 `data-entered=true`，没有入口元素。原因是 QA 在入住短暂 inert 期间查询 Close panel 得不到按钮而跳过关闭，随后点击已选中的 Residents 反而关页签。修正脚本为先等待完整入口再查 Close panel，`admission-race-04` 三轮通过；没有修改产品代码或降低断言。之前跨连接看到75%的具体触发原因未确认，本次证据不支持将它作为已复现产品缺陷。
- `reopen-04`：产品当时已正常显示，Close courtyard 位于 More 内，专为入口卡住编写的直接关闭定位超时；紧接着 `admission-race-04` 无需重开即可通过。保留此定位失败。
- `performance-04`：沙箱中的只读 `Get-CimInstance` 被系统拒绝，尚未取样；经批准的沙箱外 `performance-05` 使用相同门限完成。没有修改 ACL。

## 验收边界

完整进程冷恢复已通过。真实最小化/恢复和物理 OS 睡眠/唤醒未验证；关闭浮卡、页面 hidden 或 Chromium freeze 都不等价于物理睡眠。当前运行书屋仍是明确标注的 Development preview；本测试不构成正式书屋美术批准。

原生新内容只覆盖一位新人、一组配对和一个谜题。其他居民/配对的验证以自动化和独立浏览器矩阵为准，不能扩展本节原生覆盖范围。
