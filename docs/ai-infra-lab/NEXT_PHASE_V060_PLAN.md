# AI Infra Lab：P2–P5 独立验收结论与 v0.6.0 深化实施方案

> [!IMPORTANT]
> **当前基线**：`.worktrees/ai-infra-lab`（分支 `codex/ai-infra-lab-v0.1`，HEAD `f88bad2`，`dsh-plugin-ai-infra-lab@0.5.0`）。
> **验收结论**：P2–P5 的底层架构、单源模拟器数学模型、Gloo 4 进程隔离沙箱、归档安全校验及五代数据库升级链**通过验收（PASS）**；但源码级交叉审计发现**阶段 B–E 的零基础讲义/代码脚手架丰满度、前端细节状态及真实浏览器/多插件共存验证**仍存在明确差距。本方案规划 **v0.6.0（M1–M4）** 将产品打磨至可合入主线并接入官方 Desktop 的正式交付标准。

---

## 一、 P2–P5 独立设计审计摘要

### 1. 已验证通过的工程亮点
- **制品与门禁一致性**：`0.2.0`（`58492c3`）、`0.3.0`（`3d0f63b`）、`0.4.0`（`e689c13`）、`0.5.0`（`f88bad2`）四个阶段提交历史清晰，本地 tarball SHA-256 与验收报告逐字吻合，工作树无任何未跟踪残留。
- **跨代存储与归档安全（`src/archive.ts` & `tests/upgrade-chain.mjs`）**：实现了字段级 `onlyFields` 白名单、代码 SHA-256 重算校验、阶段版本号因果校验 `released()`、幂等导入与冲突回滚，并通过 `git archive` 提取 `0.1.0–0.4.0` 历史版本执行真实五代同库逐行比对。
- **Gloo 分布式沙箱与有界 PID 配额验证（`runtime/infra_sim/dist_harness.py`）**：
  - `os.dup2(2, 1)` 将 C++ Gloo 原生输出与学习者 `stdout` 统一纳入受字节上限保护的管道；
  - 共享内存状态数组实时追踪各 rank 所处通信原语，25 秒死锁超时可精确定位漏调 rank；
  - 采用有界 256 线程触发 Linux cgroup `/sys/fs/cgroup/pids.events` 的 `max` 拒绝计数代替无限递归 fork 炸弹，既验证了内核 `pids.max=256` 真实拦截与回收，又避免冲击宿主机 WSL2 共享内核，工程取舍合理。
- **Ring All-Reduce 双口径呈现（`src/sim-stage-d.ts`）**：同时展示串行关键路径墙钟总耗时 `2(N−1)(α + M/(Nβ))` 与按进程数归一化参考值，消除了理论公式口径歧义。

### 2. 源码审计发现的 4 项差距（v0.6.0 解决目标）

1. **阶段 B–E 零基础讲义与代码脚手架明显缩水**：
   - 阶段 A（`A00–A07`）每篇讲义约 850–1,100 字，包含完整的 5 段式结构、Markdown 对比表与 ASCII 内存/寄存器图解；而阶段 B–E（`B01–X01`，见 `content/lectures.json` 第 82–261 行）每篇仅约 280 字纯文字段落，**无任何表格、无 ASCII 结构图解、无小结要点列表**，对零基础学习者在理解 `C04` 在线重缩放、`D02` 环形收发下标、`E02` 半满尾页写时复制、`E03` 高低半字节打包时跨度过陡。
   - `B03–X01` 代码题的 `starter` 仅有一行裸 `def fn(...): return None`，缺少输入张量形状/类型说明与微步骤递推公式注释；且部分练习（如 `C03-code`）的第 4 级提示 `hints[3]` 直接重复粘贴了 `prompt` 题干而非递进伪代码。
2. **UI 状态反馈缺陷与可视化组件表现力落差**：
   - **状态样式 Bug**：`src/components/ActivityView.tsx`（第 801–815 行）将开放设计说明题（`X01-design`）合法返回的 `'inconclusive'` 状态归入了 `effectiveStatus !== 'passed'` 分支，导致提交成功后展示红色失败样式 `.ail-feedback-fail`。
   - **可视化细节与实测图表联动不足**：P2–P5 新增的 5 个 Explorer 各仅 30–40 行，缺少颜色图例（如 `MemoryWaterfallExplorer` 的 5 段堆叠条无色标对照）、缺少一键典型预设按钮，且 `dist_harness.py` 已采集的多进程 `RunEvent.timeline` 与 `B05` 采集的 HBM/SRAM 四本账尚未在运行结果区渲染为直观的对比图表。
3. **缺少“运行并排对照（Run Comparison）”与聚焦步骤排错工作流**：
   - AI Infra 学习高度依赖“改一个参数看前后指标变化”（如对比不同 `world_size`、有无分块、静态 vs 连续批处理），当前历史运行仅能单条切换查看，缺少双运行并排 Diff 对照面板。
4. **缺少真实浏览器（Chromium）视觉布局验收与主仓七插件共存门禁**：
   - 现有测试为 Node SSR 与轻量模拟 DOM，尚未在真实 Chromium 引擎下验证双 DPR、亮暗色对比度、SVG 实际盒模型尺寸与无横向截断，也尚未与主仓其余 Desktop 六插件做同隔离 profile 共存冒烟。

---

## 二、 v0.6.0 深化实施方案（M1 → M4）

### M1 · 零基础课程丰满度与脚手架对齐（Pedagogy & Scaffolding Parity）

- **修改文件**：`packages/ai-infra-lab/content/lectures.json`、`packages/ai-infra-lab/content/catalog.json`、`packages/ai-infra-lab/src/catalog.ts`、`packages/ai-infra-lab/tests/curriculum-quality.test.ts`（新增）。
- **实施细节**：
  1. **升级 `B01–X01` 全部 18 节中英双语讲义**：全部对齐阶段 A 的 5 段式结构（`### 为什么学这一节` → `### 直觉类比与图解` → `### 一步步算一个例子` → `### 动手前先预测` → `### 本节小结`）。每节必须包含**至少 1 个 ASCII 结构/时序示意图或 Markdown 对比表格**（例如：`B03` 二维块与越界哨兵网格图、`B04` 128B 段与 32 Bank 映射表、`C02` 16P/18P 字节拆解表、`C04` Online Softmax 新旧最大值缩放示意图、`D02` 4-rank Ring 三轮传递图、`E02` 逻辑块表指向物理页与 CoW 示意图、`E03` 字节内高低 4-bit nibble 排布图）。
  2. **升级 `B03–X01` 全部 14 道容器代码题的 `starter`**：在不改变函数签名、且保证原样运行仍为 `check_status === 'failed'` 的前提下，为每个微步骤函数补齐中英双语参数形状/类型注释、边界条件提醒与核心公式骨架（特别是 `C04-code` 补齐 `m_new` / `alpha = exp(m_prev - m_new)` 递推提示注释）。
  3. **审计并重写全部 26 节练习的 `hints[0..3]`**：严禁任何一级 `hint` 与 `prompt` 重复率超过 70%；确保 `hints[0]` 讲物理概念、`hints[1]` 给解题步骤、`hints[2]` 给关键公式或边界检查、`hints[3]` 给局部伪代码结构（`answer` 级仍由 `Engine.hint` 返回完整参考解）。
  4. **新增自动化内容质量门禁 `curriculum-quality.test.ts`**：程序化校验全部 26 节中英讲义均具备至少 4 个三级标题、包含表格或代码块图解、最小字符长度达标（中文 `>= 550` 字，英文 `>= 1200` 字符），且所有练习 `hints` 互不重复、不复读 `prompt`。

### M2 · 交互视觉精修、状态修复与双运行对照工作台（Visual Polish & Run Diff）

- **修改/新增文件**：
  - `src/components/ActivityView.tsx`、`src/style.css`
  - `src/components/ExplorerPanel.tsx`、`GpuCoalescingExplorer.tsx`、`MemoryWaterfallExplorer.tsx`、`PipelineScheduleExplorer.tsx`、`ServingSchedulerExplorer.tsx`、`CapacityPlannerExplorer.tsx`
  - 新增 `src/components/RankTimelineChart.tsx`（渲染阶段 D `RunEvent.timeline` 多进程通信甘特图）与 `src/components/TrafficComparisonChart.tsx`（渲染 `B05` 朴素 vs 分块 HBM/SRAM 字节对比图）
  - 新增 `src/components/RunComparison.tsx`（双运行并排对照器）
  - `src/tutor-context.ts`（支持聚焦指定失败 `step` 与多进程 `diagnosis`）
- **实施细节**：
  1. **修复开放题反馈态**：在 `ActivityView.tsx` 中区分 `'passed'`（绿 `.ail-feedback-pass`）、`'inconclusive'`（蓝灰中性 `.ail-feedback-neutral`，文案显示“已保存分析记录 · 可请右侧导师结合你的账本数据点评”）与 `'failed'`（红 `.ail-feedback-fail`）。
  2. **五大 Explorer 视觉增强**：
     - 为所有 Explorer 增加 2–3 个**教学预设快捷按钮**（例如 `MemoryWaterfallExplorer` 一键切 `7B 混合精度基线` / `长序列 8K 爆激活` / `开启重计算省显存`；`CapacityPlannerExplorer` 一键切 `70B FP16 OOM 反例` / `70B INT4 TP8 达标候选`）；
     - 为 `MemoryWaterfallExplorer` 补齐带颜色圆点、字节数与百分比的图例卡片；为 `CapacityPlannerExplorer` 增加 `80 GiB` 容量警戒进度条；为 `PipelineScheduleExplorer` 区分前向/反向/空闲气泡配色图例；美化 Explorer 内 `<table>` 与 `<select>` 样式，统一圆角、间距与焦点高亮环。
  3. **实测事件可视化**：在代码题运行结果区，当事件流包含 `timeline`（`D02/D04/D05`）时自动渲染 `RankTimelineChart`（按 `rank 0..3` 绘制通信原语时间块）；当包含 `B05` HBM/SRAM 流量指标时渲染 `TrafficComparisonChart`。
  4. **双运行并排对照（`RunComparison.tsx`）**：当某道代码练习存在 `>= 2` 条已完成运行记录时，允许任选基准运行 A 与对照运行 B，自动并排展示配置差异、预测记录、各检查项状态变化以及同名 `metric` 的数值增减与倍率（例如 `hbm_read_bytes: 262,144 -> 16,384 (-93.8%, 16.0x reduction)`）。

### M3 · 真实 Chromium 会话验收与 Desktop 七插件共存门禁（Real Browser & Coexistence Gates）

- **新增/修改文件**：
  - `packages/ai-infra-lab/tests/ui-browser-real.mjs`（真实无头 Chromium/Edge 渲染与交互门禁）
  - `packages/ai-infra-lab/tests/coexistence-rc5.mjs`（官方 `0.2.1-rc.5` 七插件隔离共存门禁）
  - 更新 `packages/ai-infra-lab/tests/upgrade-chain.mjs` 与 `packages/ai-infra-lab/scripts/check.mjs`
- **实施细节**：
  1. **真实浏览器渲染门禁（`ui-browser-real.mjs`）**：启动本地回环 HTTP 测试页挂载生产构建 `lib/client.js` 与真实 `Engine` RPC，使用本机已安装的 Chromium/MSEdge（或 Playwright/CDP 无头连接）在亮色/暗色主题、`1280×800` 视口（`deviceScaleFactor: 1` 与 `2`）下遍历检查：
     - 全部 7 个交互可视化组件（`BitLayout`、`Roofline`、`GpuCoalescing`、`MemoryWaterfall`、`PipelineSchedule`、`ServingScheduler`、`CapacityPlanner`）的实际渲染边界框 `width > 200 && height > 40`（彻底杜绝 0px 折叠）；
     - 中英文切换后零未翻译残留、无页面级水平滚动溢出、零 `pageerror` / `console.error`；
     - 在真实页面中完成一次 `X01-design` 提交，验证渲染 `.ail-feedback-neutral` 而非失败红框。
  2. **官方 `0.2.1-rc.5` 七插件隔离共存门禁（`coexistence-rc5.mjs`）**：若主仓 `dist/` 中存在已构建的 Desktop 六插件离线包，则在新建隔离临时 profile 中将它们与 `dsh-plugin-ai-infra-lab-0.6.0.tgz` 一同安装并执行 `evaluatePluginCompatibility` 与 Host/Client 模块共存检查（若部分外部包不在当前 worktree，则至少验证与本仓核心插件同 profile 离线安装无路由、插槽 `order` 或依赖冲突）。
  3. **六代升级链门禁**：扩展 `upgrade-chain.mjs`，覆盖 `0.1.0 -> 0.2.0 -> 0.3.0 -> 0.4.0 -> 0.5.0 -> 0.6.0` 全链路 SQLite 无损读取与归档导入。

### M4 · `v0.6.0` 候选封版与合入准备

- 更新 `package.json` 版本至 `0.6.0`，同步 `src/catalog.ts` 与 `src/archive.ts` 版本列表为 `['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0', '0.6.0']`。
- 运行完整 `node scripts/check.mjs --full`（包含新增的讲义质量门禁、真实浏览器门禁、分布式对抗门禁、六代升级链与双基线离线安装门禁）。
- 输出 `docs/ai-infra-lab/V060_VERIFICATION.md`（记录包大小、SHA-256、浏览器视口实测数据与安全安装说明）。

---

M1–M4 的逐项实测数据、离线安装条件与验收边界见 [v0.6.0 验收记录](V060_VERIFICATION.md)。

面向官方 Desktop `0.2.2-rc.5` 的本地安装包为 `0.6.1`。兼容范围、原生窗口实测和产物校验值见 [0.6.1 宿主适配记录](V061_HOST_COMPATIBILITY.md)。

## 三、 远期可选扩展（P6 · 本地 WSL2 CUDA / 远程 GPU 实测通道，不在 v0.6.0 实施）

若后续希望在配备 NVIDIA 显卡的机器上体验真实 GPU Kernel 与 NCCL 通信，可在保持纯 CPU 26 单元 100% 独立可学的前提下单独开启 `v0.7.0` 选修扩展：
- 实现 `LocalDockerCudaRunner`（继承 `RunnerBackend`，`runnerProfile: 'local-gpu'`，显式检测 `docker info` NVIDIA Runtime，使用 `--gpus 1 --network none --user 65534:65534`）；
- 新增第 4 类数据来源徽章 `'gpu_measured'`（GPU 实测），为 `B05`（Triton/CUDA Tiled GEMM）、`C04`（FlashAttention vs Eager 显存峰值实测）提供可选加餐实验，无 GPU 机器自动隐藏或标记为选修跳过。
