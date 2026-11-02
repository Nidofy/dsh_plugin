# Neural Lab 0.2.1 独立审查
2026-11-02 · Windows · 发布目标 DSH 0.2.1-rc.5

## 审查对象与结论

目标分支 `codex/neural-lab-0.2.1`，HEAD 及本次 fetch 的 FETCH_HEAD 同为 `19d8a9867ca47100689b26a5297f30d250ceaa4c`。用户给出的外置 worktree 路径不存在。Git 登记的目标树为 `.worktrees/neural-lab-pr-021`，开始时 git status --short 为空。前次审查点 `050388feecaaaa16f9de988c9fdc044a740ab1af` 存在，但不是目标提交的祖先。两者 merge-base 为 `bc230e7f662f47efb497529a276d09aad90ad4ac`。

```text
目标线    bc230e7 → 19d8a98 feat(neural-lab): add CPU learning workbench v0.2.1
开发线    050388f → 11d5f39 feat(neural-lab): ship the editable training workbench v0.2.1
```

`git diff --quiet 11d5f39 HEAD -- packages/neural-lab docs/neural-lab` 返回 0。下文采用两个端点的插件差异；直接用三点 diff 会把整套插件当作新增。目标提交在插件和插件文档之外没有宿主改动。审查范围包含随包脚本、Cordis patch、课程、Host RPC、前端、Python 和测试。位置默认相对 `packages/neural-lab/`。

**建议先出 0.2.2。** 当前最需要保护的是已经写下的档案、帮助证据归属以及默认数据目录。可编辑 MLP 和微型 Transformer 均已通过真实反例门禁，可以用作后续项目的基础。

## 发现与修复门禁

以下均针对本次 0.2.1。实测项注明输入及观测值，源码推导项单独标记。P1 表示应在继续扩大使用前处理，P2 表示可分批修复。

| ID／等级／性质 | 位置与触发 | 证据及后果 | 最小改动与必须通过的回归 |
|---|---|---|---|
| R1 · P1 数据 | `src/engine.ts:134–142`、`src/workbench.tsx:824–851`。两个窗口从同一档案开始编辑 | 临时 Engine 实测。初值 goal=A；窗口一存 goal=B，窗口二只改 background=C，再保存整份对象，实际读回 goal=A、background=C。另由源码可见，单窗口发出保存后仍可编辑，旧回执会显示“档案已保存”，刷新丢失这段新输入。 | 为旧档案赋初始 revision，保存按 CAS 和提交时快照确认，保留未确认文本。测两窗口改不同及相同字段、延迟保存 A 后写 B/C、刷新恢复、确认冲突再合并。 |
| R2 · P1 教学数据 | `src/tutor-context.ts:33–44,98–103`、`src/engine.ts:350–362`、`src/store.ts:120–131`，`MentorSidebar.tsx:25`（components）。导师答复前点击独立重试 | 用真实 dispatch、SQLite 与延迟的模型替身实测：A 请求 answer，开始 B，释放回调。请求 cycle=initial，交付 attemptId 为 B 的 UUID，B 的 help 实际为 answer。后续程序通过也会带着错误的帮助标签。 | 发起时冻结 attemptId 并贯穿交付、上下文和展示；按尝试查帮助，旧答复归档到 A。测延迟成功、失败、取消及双窗口，B 不继承 A 的帮助，能追溯 A 的请求与答案。 |
| R3 · P1 数据边界（源码确认） | `cordis.patch.yml:5`、`src/index.ts:176–178`、`src/engine.ts:27–34,80–90`。两个 DSH profile 共享同一 DSH_HOME 并使用默认补丁 | rc.5 的 `packages/boot/app-boot/src/index.ts:1223` 提供全局 dshHomePath；`packages/util/home-paths/src/index.ts:160–162` 只拼 home 和传入片段。两 profile 算出同一数据库、同一 bufferScope。顺序启动复用学习记录，同时启动会争 owner；本次未启两个完整宿主复现。官方测试隔离了整个 home，不能覆盖此条件。 | 默认根取可信 profile 身份，保留显式 dataRoot。旧共享库停用后备份，由用户选择归属再导入，禁止按当前 profile 静默复制给所有人。临时同 home 双 profile 验证顺序和并行启动、迁移中断和重试。 |
| R4 · P2 数据恢复 | `src/store.ts:7–48,97–103`、`src/engine.ts:27–46`。既有 runs.body 一行损坏 | 在临时库仅插入一条 body 为左花括号的记录；重开抛 JSON 解析错误，插件无法加载，Windows 同进程随后清理文件得到 EBUSY。构造器失败路径未关闭已打开的 DatabaseSync。未观察到旧数据被重置。 | 所有初始化异常关闭句柄。逐条识别损坏行，保留原字节与可恢复导出；恢复前防止第二 writer。测有效草稿和坏 run 并存、连续重开、失败后立即移动或备份文件。 |
| R5 · P2 工程／发行 | `scripts/build.mjs:108–132`、`tests/install-check.mjs:94–110`、`docs/neural-lab/artifact.json`（仓库根）。用历史 0.2.1 包对照当前干净 checkout | 历史包能在官方 Web 加载，但源码身份检查在 Dockerfile 失败。完整比对见下。重打包后相同安装门禁通过。隐藏差异或跳过哈希检查会使后续发行不可追溯。 | 保留历史哈希；统一发布输入换行，从干净树打新版本，以同一归档完成构建、离线安装、升级、Web 和清单校验。两次独立 checkout 打包对比字节。 |
| R6 · P2 正确性／UX（源码） | `src/components/ActivityTab.tsx:100–108,224–239`。同一训练代码和 seed，只改学习率 | 历史结果标记只比较代码、seed、课包和 testVersion；原 run 数据仍准确，但界面没有提示其学习率已过期。 | 单独比较已提交 effectiveConfig 与将提交的配置；提示原值、新值和 runId。浏览器测试仅改学习率、改回、失败后回看历史。 |
| R7 · P2 教学 | `content/catalog.json:778–794,852–868`、`src/engine.ts:302–317`。将 L09-code 参考实现原样用于 L09-transfer | 两者都调 code09。已有 implementation 与自述 explanation 的区分；同一数值任务可重复取得程序通过，不能据此证明迁移。 | 增加传感器变长前缀或不同输入契约，并独立检查未来扰动。让合法迁移实现通过，原题复制解无法满足新增契约；旧证据保留原题版本。 |
| R8 · P2 工程 | `src/index.ts:141–145,160–165`。合法 JSON POST 携带畸形 Origin | 临时 loopback 实测返回 HTTP 500 internal error。请求被拒绝，但把客户端错误误报为服务故障。 | 将 Origin 解析失败归为 400；测畸形、跨站、正确同源及无 Origin 的既有 RPC。 |

### 技术债和未证实风险

- `src/engine.ts:34–42` 在激活时串行找回容器，`src/runner.ts:35–47` 每命令可等 15 秒。多条 cleanupPending 遇到失联 daemon 的累积时延是源码推断。先做挂起 CLI 的有界回归，再定恢复预算或后台队列，未回收容器必须保持可追踪。
- `src/workbench.tsx:34–53,313–330` 每次编辑同步写 sessionStorage，发生配额异常时会早于 React 更新退出。应做容量受限和最大草稿的真实浏览器回归；直接延迟所有缓存写入会削弱刷新恢复。预测和未提交解释也是独立的 React 状态，换活动会清空，后续可用活动／run 绑定的草稿保存。
- `runtime/training.py:92–98,144–160` 在循环外沿用上一步的 check 闭包，留出集错误显示最后训练步号。拆出具名阶段即可。全量 runs/history 加载和图表性能以压力测试决定优先级。
- 容器采用不可变镜像 ID、禁网、只读挂载、tmpfs、PID/内存/CPU/输出限额，学生进程 UID/GID 65534。检查了 `runner.ts:188–223,253–312,338–451` 和 `controller.py:21–41,54–125`；runId 受限，新目录独占创建，产物名固定。未做恶意宿主用户并发替换父目录／junction、所有内核逃逸或实际凭据泄漏测试。没有 Docker 时 environment 返回失败，无宿主 Python 分支。

## 前次问题与新增模块核对

| 范围 | 判定和可复核证据 |
|---|---|
| 代码、笔记自动保存 | **已修复（已测序列）**。`workbench.tsx:167–257` 逐次确认 submitted 和 revision；独立 Chromium 延迟 A 后继续 B/C，SQLite 和重开读 C，revision +2。CAS 冲突、回执挂起刷新和切课恢复通过。Profile 单列为**部分修复**，普通手动保存通过，竞态见 R1。 |
| 判题 | **已修复（原反例）**。`controller.py:149–250` 的 Softmax 有全零、随机和大数三个域，多头实际覆盖 2/1/3 头、不同 B/T/D。真实失败项：L05 固定输出、错误轴和全 batch 归一化；L10 错转置和固定两头；L08 漏缩放；L09 漏 mask；L03 和 L11 的断梯度／错误残差。未逐题新增错误实现，26 参考／20 starter 的全目录结果属历史。L09 迁移见 R7。 |
| 导师 | **部分修复**。`tutor-context.ts:45–101` 分别传当前草稿与最近提交的哈希、版本、状态、matchesCurrentDraft 和最近 8 条同活动消息。HTTP 测试用替身检查二轮追问、失败／取消／无模型不产生帮助；预置答案前存草稿。成功交付以请求模式记级别，未校验模型文本是否越级；旧尝试跨轮见 R2。真实模型成功回答未验证。 |
| 证据和复习 | **部分修复**。`engine.ts:111–132,187–196,218–272,287–336,378–389` 将阅读、配置实验 observation、真正实现、解释分开，runId/answerId 和版本可追，旧数据在 `store.ts:134–148` 标 legacy。snooze 写回对应队列的 due，训练复习按 run 完成。旧 run 的解释采用当前课包版本，跨版本展示应并列作答与被解释运行的版本。迁移题见 R7；双窗口归属见 R1–R3。 |
| 容器 | **已修复（已测路径）**。`runner.ts:110–157,237–250,300–333,458–497`。实测 inspect、snapshot、create 阶段取消、运行中卸载均无残留；retag 后沿用已解析 ID。超时、取消和执行完成但检查失败分别得到不同状态。daemon 崩溃后长时间不可用仍待故障注入。 |
| 可编辑训练 | **已实现并实测**。L04 由学生写 train_step 和 validate，在提供的 MLP 上前向、求损失、backward、step；八个 minibatch 由 NumPy 独立复核梯度、更新和留出误差。`student.py:4–49`、`training.py:42–162`（runtime）。L12 的 shifted/embed/attention/block/logits 为学生实现，测试脚手架负责 CE、backward 和 SGD；逐步核对 logits、dx、各参数梯度、四步更新、因果前缀、批次隔离及 16 次采样。`runtime/student.py:51–130`、`runtime/char_transformer.py:40–221`。它已有一层两头组装，仍缺跨活动组件复用和多规格项目。 |
| 训练结果身份 | `runner.ts:370–405,493–514`、`TrainingComparison.tsx:25–46`（src/components）。按 run 保存代码、seed、镜像、协议、三种数据/初值摘要、原始事件；对照检查同初值、批次、切分等条件。运行期间检查了权重快照；未发现可供用户恢复训练的 checkpoint。RunRecord 保留原代码，导师按需算 hash；通用 codeHash/artifactId、逐头逐层诊断仍待补。 |
| 存储和工作台 | 新库、外来 schema 拒绝、CAS、owner 互斥／崩溃恢复通过。本轮对真实 0.1.2 包写入草稿和档案，再用当前 Engine 两次冷开均保留；项目升级脚本覆盖 0.1.3→0.2.0→0.2.1，训练历史为夹具。损坏记录见 R4。四尺寸滚动、键盘和拖动、回顶、后台轮询和换课均有实现，当前独立 Web 回归 20 项／0 pageerror；原生 Electron 和系统 IME 未重测。 |

## 验证账本

工作目录为插件包。Node 24.16.0、npm 11.13.0、官方 rc.5 revision `b830ec950faba0a46dda564be3e2d854afed94f1`，本机 CPU 镜像 ID `sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7`。下列 TS 脚本用 `node --experimental-transform-types` 执行。

| 本次命令 | 结果和范围 |
|---|---|
| npm test | 固定宿主严格 TS、Host/Client 构建和 11/11 测试通过，约 4 秒。首次沙箱因 Git 属主检查失败，以获准用户身份重跑通过。 |
| node tests/ui-check.mjs | 临时 HTTP/SQLite + Chromium 20 项，1366/1920/900/640 宽度，0 pageerror。 |
| tests/runner-lifecycle.ts、tests/runner-adversarial.ts | 真实 Docker 5 个生命周期场景；17 个错解／攻击全部 completed/failed，另有 timed_out、cancelled。 |
| tests/training-real.ts | 28 次真实 Docker。MLP 10 个定向错误（含复用训练集、伪造 loss、漏清梯度／反传／更新、验证改权重或错误模式）；字符模型 10 个定向错误（未移位、漏位置、未来泄漏、串 batch、错缩放／拼头、断输入／Q 梯度、错 Pre-LN、缺 FFN）全部被拒。仅 shifted 的部分解局部通过、整题失败。固定 seed 重跑，逐步验证曲线及字符采样一致。两份会写 tracked JSON 的脚本在相同源文件的 .build 审查副本中运行。 |
| node tests/upgrade-020.mjs | 三个历史 tgz 逐次升级，通过。额外最小实验覆盖 0.1.2 的两项数据及坏行，详见 R4。 |
| node tests/install-check.mjs、npm pack --ignore-scripts、node tests/ui-official-session.mjs | 历史归档 90069 字节，SHA-256 `74698870d9820217d71bcaebb4e913aa51153cc507e9b06f443585bcc7dd9b9b`。rc.5 临时 profile 安装及客户端可见、草稿、提示、无凭据降级、卸载通过；与 PR checkout 的全源比对失败。当前重构建包 90045 字节，SHA-256 `1c4593f4e035fe5b9d812ef9fafdc8a703cb74a030b9983907535b4dee4036d5`，空缓存离线安装和完整源码检查通过。两包文件列表相同，Dockerfile、requirements.lock、prepare-image.ps1、LICENSE 仅换行不同，另外 build-identity.json 随之变化。JS 与 Python 文件字节相同。 |

历史材料 `VALIDATION.md`、`tests/results/` 还记录了完整 33 参数门禁、全目录参考解、Learn 共存等；以上未重跑项目不可计入当前结果。当前实测成功交付导师结果使用显式替身；官方无模型路径使用临时 profile。上述本地审查产物不作为新发行。

重打包后又以 `NEURAL_UI_CPU=1`、`npm_config_offline=true` 执行 `node tests/ui-official-session.mjs`。该次官方 Web 证据 `.build/ui/official-validation.json` 确认同一 `1c4593f4…` 包的侧栏实际挂载、认证 RPC、真实 Docker Attention、MLP 与字符模型对照、解释、复习、四尺寸滚动及官方卸载全部通过，errors 为空，serverStopped 与 cleanupCompleted 均为 true。

## Git 差异明细

`git diff --stat 050388fe HEAD -- packages/neural-lab docs/neural-lab` 和相同范围的 `--name-status` 原始输出如下。A/M 指新增／修改。

```text
docs/neural-lab/DEVELOPMENT_STATUS.md              |   29 +-
 docs/neural-lab/NEXT_PHASE.md                      |   23 +
 docs/neural-lab/VALIDATION.md                      |   51 +-
 docs/neural-lab/artifact.json                      |    8 +-
 packages/neural-lab/README.md                      |   25 +-
 packages/neural-lab/content/catalog.json           |  156 +-
 packages/neural-lab/package.json                   |    3 +-
 packages/neural-lab/runtime/README.md              |   16 +-
 packages/neural-lab/runtime/char_transformer.py    |  221 ++
 packages/neural-lab/runtime/controller.py          |  118 +-
 packages/neural-lab/runtime/student.py             |  132 +-
 packages/neural-lab/runtime/training.py            |  162 +
 packages/neural-lab/src/catalog.ts                 |   17 +-
 packages/neural-lab/src/client-api.ts              |    8 +-
 packages/neural-lab/src/components/ActivityTab.tsx |   49 +-
 packages/neural-lab/src/components/CodeEditor.tsx  |   36 +-
 packages/neural-lab/src/components/LectureTab.tsx  |    2 +-
 .../neural-lab/src/components/MentorSidebar.tsx    |   35 +-
 packages/neural-lab/src/components/RecordsTab.tsx  |   32 +-
 packages/neural-lab/src/components/RunResults.tsx  |   40 +-
 .../src/components/TrainingComparison.tsx          |   92 +
 packages/neural-lab/src/components/completions.ts  |    4 +-
 packages/neural-lab/src/engine.ts                  |  209 +-
 packages/neural-lab/src/index.ts                   |   45 +-
 packages/neural-lab/src/mentor.ts                  |    9 +-
 packages/neural-lab/src/owner.ts                   |   28 +-
 packages/neural-lab/src/runner.ts                  |  475 +--
 packages/neural-lab/src/store.ts                   |   27 +-
 packages/neural-lab/src/training-protocol.ts       |    4 +
 packages/neural-lab/src/tutor-context.ts           |   59 +-
 packages/neural-lab/src/types.ts                   |   65 +-
 packages/neural-lab/src/workbench.tsx              |  498 ++-
 packages/neural-lab/tests/content.test.ts          |   13 +-
 packages/neural-lab/tests/host.test.mjs            |   87 +
 .../tests/results/adversarial-results.json         |  737 +++--
 .../neural-lab/tests/results/parameter-runs.json   | 1354 ++++----
 .../neural-lab/tests/results/reference-runs.json   | 3415 +++++++++++++-------
 .../neural-lab/tests/results/training-020.json     |  540 ++++
 .../neural-lab/tests/results/training-021.json     | 1733 ++++++++++
 packages/neural-lab/tests/runner-adversarial.ts    |   24 +-
 packages/neural-lab/tests/runner-lifecycle.ts      |  105 +
 packages/neural-lab/tests/runner-limits.test.ts    |    1 +
 packages/neural-lab/tests/store.test.ts            |   22 +
 packages/neural-lab/tests/temporary-directory.mjs  |    4 +-
 packages/neural-lab/tests/training-real.ts         |  198 ++
 packages/neural-lab/tests/training-ui.mjs          |   79 +
 packages/neural-lab/tests/ui-check.mjs             |  162 +-
 packages/neural-lab/tests/ui-official-session.mjs  |   21 +-
 packages/neural-lab/tests/ui-official.mjs          |   18 +-
 packages/neural-lab/tests/upgrade-020.mjs          |   90 +
 50 files changed, 8717 insertions(+), 2564 deletions(-)
M	docs/neural-lab/DEVELOPMENT_STATUS.md
A	docs/neural-lab/NEXT_PHASE.md
M	docs/neural-lab/VALIDATION.md
M	docs/neural-lab/artifact.json
M	packages/neural-lab/README.md
M	packages/neural-lab/content/catalog.json
M	packages/neural-lab/package.json
M	packages/neural-lab/runtime/README.md
A	packages/neural-lab/runtime/char_transformer.py
M	packages/neural-lab/runtime/controller.py
M	packages/neural-lab/runtime/student.py
A	packages/neural-lab/runtime/training.py
M	packages/neural-lab/src/catalog.ts
M	packages/neural-lab/src/client-api.ts
M	packages/neural-lab/src/components/ActivityTab.tsx
M	packages/neural-lab/src/components/CodeEditor.tsx
M	packages/neural-lab/src/components/LectureTab.tsx
M	packages/neural-lab/src/components/MentorSidebar.tsx
M	packages/neural-lab/src/components/RecordsTab.tsx
M	packages/neural-lab/src/components/RunResults.tsx
A	packages/neural-lab/src/components/TrainingComparison.tsx
M	packages/neural-lab/src/components/completions.ts
M	packages/neural-lab/src/engine.ts
M	packages/neural-lab/src/index.ts
M	packages/neural-lab/src/mentor.ts
M	packages/neural-lab/src/owner.ts
M	packages/neural-lab/src/runner.ts
M	packages/neural-lab/src/store.ts
A	packages/neural-lab/src/training-protocol.ts
M	packages/neural-lab/src/tutor-context.ts
M	packages/neural-lab/src/types.ts
M	packages/neural-lab/src/workbench.tsx
M	packages/neural-lab/tests/content.test.ts
M	packages/neural-lab/tests/host.test.mjs
M	packages/neural-lab/tests/results/adversarial-results.json
M	packages/neural-lab/tests/results/parameter-runs.json
M	packages/neural-lab/tests/results/reference-runs.json
A	packages/neural-lab/tests/results/training-020.json
A	packages/neural-lab/tests/results/training-021.json
M	packages/neural-lab/tests/runner-adversarial.ts
A	packages/neural-lab/tests/runner-lifecycle.ts
M	packages/neural-lab/tests/runner-limits.test.ts
M	packages/neural-lab/tests/store.test.ts
M	packages/neural-lab/tests/temporary-directory.mjs
A	packages/neural-lab/tests/training-real.ts
A	packages/neural-lab/tests/training-ui.mjs
M	packages/neural-lab/tests/ui-check.mjs
M	packages/neural-lab/tests/ui-official-session.mjs
M	packages/neural-lab/tests/ui-official.mjs
A	packages/neural-lab/tests/upgrade-020.mjs
```
