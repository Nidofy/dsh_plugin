# AI Infra Lab (`dsh-plugin-ai-infra-lab`)

面向零基础学习者的独立 DeepSeek Harness 插件。每个单元提供中英双语讲义、练习、分级提示和可复核的学习记录。

A bilingual, CPU-first course in AI infrastructure with worked examples, graded labs and a local learning journal.

26 个单元均提供双语图解、手算示例、预测题和小结。实验中可逐级查看概念、步骤、公式与边界、局部伪代码。代码题可另外打开参考实现。
All 26 units include a diagram, a worked example, a prediction and takeaways in both languages. Four hints progress from intuition to pseudocode. Code exercises also include a separate reference implementation.

在同一道代码题完成两次运行后，可选择任意两条记录对照预测、参数、检查项和指标。B05 展示模拟缓冲区实际记录的 HBM/SRAM 读写字节，分布式题展示各 rank 的通信调用。开放设计说明会存入学习档案，可在导师栏选择失败步骤或讨论自己的容量分析。
After two runs of the same exercise, select any pair to compare predictions, settings, checks and measurements. B05 plots the bytes read and written through the simulated buffers. Distributed exercises show communication calls by rank. The tutor accepts questions about a failed step or a saved capacity analysis.

## 课程与工作台

- **E01–E03 / X01 · 推理与容量规划** — KV 增量解码、分页共享、连续批处理、分组 INT4 和 8 卡预算审计。Compare serving policies and qualify plans for 70B inference and 13B training.

- **D01–D05 · 分布式训练** — 实际四进程 Gloo 环形通信、ZeRO-1 和张量并行，配合梯度分桶与流水线调度模型。Run four local ranks and compare their communication traces with the pipeline model.

- **C01–C04 · 训练系统** — 显式激活缓存、显存瀑布、动态损失缩放和三步在线 Attention。Trace tensor lifetimes, audit optimizer state, and stream stable attention over tiles.

- **B01–B05 · GPU** — Warp 访存与 Bank 地址矩阵、边界线程与可计数分块矩阵乘法。Trace memory segments and bank conflicts, launch a guarded grid, then measure tile reuse in bytes.

- **自底向上零基础路线（A00–A07）**：从工作台自检、Python 最小集（支持 2 分钟小测快速跳过）、二维 NumPy 与向量化、IEEE 754 `fp32/fp16/bf16` 位翻转、CPU 指令与 SIMD 点积、内存层次与 Cache Line `stride` 局部性、多核并行与 Amdahl 定律，一路衔接到 Roofline 性能模型。
- **三源区分徽章**：每项实验明确标识 `公式估算`、`CPU 实测`、`架构模拟`，避免将容器 CPU 耗时直接误认为 GPU 结论。
- **单源交互可视化 & 离线降级可用**：内置 IEEE 754 位翻转探索器与对数坐标 Roofline 交互模拟器；未启动 Docker 时仍可阅读讲义、查阅悬停术语表、完成小测、估算题与模拟器探索。
- **硬化隔离容器执行**：代码实验在 `--network none`、`--read-only`、`--cap-drop ALL`、`no-new-privileges` 与 `65534:65534` 降权子进程中执行，服务端按活动白名单控制 `scalar-cpu` / `multicore-cpu` / `distributed-gloo` 三档资源配额。
- **独立存储与生命周期**：默认存储于 `<profileDir>/ai-infra-lab`（`ai-infra-lab.sqlite` 与 `owner.sqlite`），支持修订校验（CAS）、安全导出/导入及无泄漏热启停。

## 准备本地 CPU 容器镜像

镜像解压体积约 **1.34 GB**（Python 3.12 + NumPy + PyTorch CPU）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-image.ps1
```

## 构建与验证

```powershell
cd packages/ai-infra-lab
npm run build
npm test
npm run check
# 包含真实 Docker、历代数据库升级、浏览器八组合、七插件共存及目标 Desktop 验收。
# DSH_DESKTOP_EXE 可指定官方 0.2.2-rc.5 可执行文件。
npm run check:full
```

本地安装包 `dsh-plugin-ai-infra-lab-0.6.1.tgz` 适配 DeepSeek Harness `0.2.2-rc.5`。在插件管理器中选择此文件即可安装。课程与学习归档沿用 `0.6.0`。兼容范围为 `>=0.2.1-rc.2 <0.3.0-0 || 0.2.2-rc.5`，离线安装门禁覆盖 `0.2.1-rc.2`、`0.2.1-rc.5` 和 `0.2.2-rc.5`。

Select `dsh-plugin-ai-infra-lab-0.6.1.tgz` in the plugin manager to install it on DeepSeek Harness `0.2.2-rc.5`. The course and its learning archives retain version `0.6.0`. Offline installation checks also cover the earlier `0.2.1-rc.2` and `0.2.1-rc.5` hosts.
