# B1–B4 交接与验收检查点

2026-10-28。基于 A6 提交 `8131d832d222506db578758291ea209516fcd623`，继续同一分支 `codex/feature-ai-village-entrance`。用户已授权恢复 B 阶段；此前暂停要求已解除。实现范围见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。本文件不修改或覆盖 A6 原始结论。

## 最新候选

- AI Village：**0.14.0-preview.6**；官方 DSH：**0.2.1-rc.3**。
- 世界：**world15/content11/region2/frame12**。保留唯一世界、时钟、RNG 和 CAS 保存 owner。
- 包：`dist/nidofy-dsh-ai-village-0.14.0-preview.6.tgz`，**53,688,401 bytes，398 files**。
- SHA-256：`34d723b00831408c5b1d178806aeadef3184e54cd20c5abad96f18bf40cc7098`。
- 官方源码 revision：`1f81c047fc48fa190a683e469daa699857e9afe8`。
- 官方归档 SHA-256：`fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。
- rc.3 runtime 锁：`cb921ac43ecb67ddf6a9aea667b362848a7b8d5795a1bc2d7686db1eee7c6ba9`。
- 完整源码/产物哈希：[package-identity.json](../compatibility/0.14.0-preview.6/package-identity.json)。包是在上述 A6 HEAD 加 B 工作树上构建，源码哈希是身份依据，不能把旧 HEAD 误认为未包含 B。

## 新玩法

| 阶段 | 交付行为 | 验证依据 |
| --- | --- | --- |
| B1 | Bluewhale/Claude 折纸签；Gemini/Grok 观察并匹配倒影；真实走近、不同操作、收尾移动、明确记忆 | 核心及 Runtime 测试；双 DPR UI 完成/取消/重玩/未知 ACK；真实 Desktop 道具和历史 pre2 完整首次流程 |
| B2 | 茶会/午后经历可在书屋成为来源明确的共同回忆；接入原手账与关系来源 | 原 eventId、首次参与者和选择逐项比较；真实可见自主回忆气泡 |
| B3 | 三地短社交，观察、招呼、邀请短暂停留，正常结束并恢复生活 | 17 项 community 测试；普通 tick 的靠近、交流、结束与参与者恢复；冷却冷读 |
| B4 | 两件可收起纸纪念；三地真实经历解锁庭院三叶卡 | 保存/冷恢复与截图；仅访问区域不解锁，重玩不重复奖励 |

三地卡位于庭院固定点，不支持拖放或独立收起。邀请是短暂一起停留，不会自动开始显式故事或完成心愿。所有关系与来源从真实保存事实派生；community 只存最多 12 条调度历史。

## 自动化检查

**80 个测试文件、446 项通过，0 失败。** 日志：[tests-pre6.log](validation/tests-pre6.log)。包含新增 6 项 afternoon 核心、17 项 community、8 项 afternoon Runtime/CAS 集成。

严格类型及 release 构建、打包、官方 rc.3 runProfilePnpm 空 store 离线安装均通过。日志位于 [validation](validation)。[world15-save-upgrade.json](../compatibility/0.14.0-preview.6/world15-save-upgrade.json) 使用冻结 A6 Host 写出真正 world14，再由新 Host 读取：读取不重写 pointer/snapshot，原字段不变，旧 epoch 拒绝，明确 CAS 才升级，幂等 ACK 与冷恢复通过。

复现入口（在仓库根目录）：

`node node_modules/vitest/vitest.mjs run --config scripts/ai-village-rc3.vitest.mjs`

`node scripts/ai-village-release.mjs`

`node scripts/pack.mjs --only=ai-village`

`node scripts/ai-village-rc3-package-check.mjs`

`node scripts/ai-village-afternoon-save-upgrade.mjs`

## 浏览器验收

最终 pre6 双 DPR 完整轮次：**均 PASS**，目录 `browser/pre6-all-dpr1-01`、`browser/pre6-all-dpr2-01`。每次均从实际 A6 r147 game-only 副本开始，冻结源码/构建，并核对最终 tgz 的 lib/assets。使用真实 Host 与生产 UI，未注入世界、加速时钟或跳过参与者路径。

B1 使用七位居民完成两故事、取消、重玩、存档冷读、隐藏/挂起、三场景资源往返和未知保存结果的只读恢复。B2/B3 使用公开入住控件保留原回忆的两位参与者，使持续观察可复现；七人视觉和路径由前段覆盖。该选择不改首次事实。之后通过真实书屋共读和庭院互动获得三地事实，验证固定卡片的可见与冷恢复。

历次失败原件保留在本地 browser 子目录，最终摘要和哈希见 [evidence-index.json](evidence-index.json)。pre3 DPR1 曾完整通过，但它不是最终包身份的替代；pre5 两轮必须保留 FAIL，不能因前半通过而改写全局状态。

## 官方 Desktop 验收

使用独立 `.build/ai-village-afternoon-desktop/home` 和专用 Electron user-data，CDP 18784。载体是未修改的官方 rc.3 QA 副本，app.asar SHA-256 `04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0`，实际 DPR 1.75。日常 DSH_HOME、真实会话和账号未复制或修改。

pre6 官方安装器安装的 398 个文件与包逐字节核对通过；在保留两项首次回忆的存档上重新安装、道具可见复验、两轮 disable/enable、不同进程冷恢复均通过。最终官方卸载通过：Host 路由、Client 入口与 iframe 已撤销，存档逐字节保留。受 PID/创建时刻/参数保护的专用进程树已停止；PID 及端口终检通过，见 [cleanup.json](cleanup.json)。原始证据在 `.build/ai-village-afternoon-desktop/evidence/b-native-pre6-*`，归档副本仅包含结果、runner 和截图，不包含解包目录、会话或 profile。

原生 pre2 两故事的完整首次保存证据为历史覆盖；pre6 再验故事道具/取消、包字节、存档和生命周期。不要将前者的包 SHA 改标为 pre6。浏览器最终包负责完整首次故事与三地收藏流程。

## 修复记录与限制

- pre1/pre2 道具被树与角色遮挡：独立 Graphics 深度，纸签挂在树冠，手边道具选择较空的一侧；pre4/pre6 原生截图确认可见。场景和居民继续使用已批准原资源，没有新生成位图。
- pre4 两居民社交观察超时：失败尝试从 900 tick 改为 90 tick 后再检查空闲窗口；成功后的全局 900、同 pair 1800、同 source 3600 不变，有回归测试。
- pre5 书屋共读后观察书签误用庭院 chime，触发 INVALID_REGION_WORLD：pre6 改用合法 chat 动作，来源对白不变。完整 codec、冷读、350 tick 结束回归通过；冻结旧校验器未放宽。
- 官方 Windows pnpm 热替换 pre4 时出现 EPERM，禁用再重启仍失败。通过官方卸载残留包、保留 game-only 数据后官方重新安装恢复；**不宣称热替换问题已修复**，未改 ACL、未手工删除包或重置存档。
- Launcher 曾因 ISO 时间尾随零的字符串差异拒绝安全重启；现按 UTC ticks 精确比较，仍同时要求 PID、创建时刻、exe、专用 user-data、端口完全一致。
- runner 早期受控 checkbox、ACK/入口门控时机、函数变量重名和资源清单未按 roster 分组的失败均保留。这些与产品错误在索引中分开记录。
- 物理睡眠/最小化、系统 IME 候选、长时间硬件 GPU 压力未在 B 轮重新覆盖。A6 Git/Live2D 的正式 rc.2 包约束及本地 QA 候选共存范围保持原记录，不扩大结论。

## 检查点与续接

当前没有需要美术批准的新位图，也未发布 npm、修改 main 或生产环境。两份用户原有未跟踪文档和 output/ 保留。

B1–B4 本轮实现与上述门禁已通过。两种缩放的完整结果见 [DPR1](browser/pre6-all-dpr1-01/result.json)、[DPR2](browser/pre6-all-dpr2-01/result.json)；真实 Desktop 副本见 [native](native)。源码、测试、最终证据建立同一 Git 检查点；旧失败大体积浏览器素材只在本地保留，证据索引记录完整文件哈希。

下一个直接可执行任务是使用该 tgz 做用户体验试用；若继续改动源码，递增候选版本并重新绑定验收包。Windows 热替换 EPERM、物理睡眠/IME 和长期 GPU 覆盖仍按上节限制处理，不作为已通过事项。
