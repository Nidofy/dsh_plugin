# AI Infra Lab：后续全阶段详细实施规划（P2 `v0.2.0` → P5 `v0.5.0`）

> [!IMPORTANT]
> **基线状态**：工作树 `.worktrees/ai-infra-lab`（分支 `codex/ai-infra-lab-v0.1`，首个提交 `145f85e`）已完成 **P0 技术验证** 与 **P1（`v0.1.0` 骨架 + 阶段 A `A00–A07`）**，并通过 `node scripts/check.mjs --full` 全套门禁。
> 本文档定义 **P2 至 P5 全部剩余模块** 的精确文件改动、类型扩展、课程契约、模拟器算法、分布式沙箱协议与阶段验收门禁，可直接作为后续自动化编码实施的唯一工程规范。

---

## 0. 全局工程红线与不变量（所有阶段必须严格遵守）

1. **宿主与运行边界**：
   - 包名保持 `dsh-plugin-ai-infra-lab`，Cordis 名 `ai-infra-lab`，RPC 路径 `/api/ai-infra-lab/rpc`，侧栏 `order: 17`。
   - `engines.dsh` 与 `@deepseek-ai/dsh-*` `peerDependencies` 保持 `">=0.2.1-rc.2 <0.3.0-0"`；发布产物不得含绝对开发路径、`workspace:`、`link:` 或 `file:`。
   - 浏览器打包外部模块仅限 `react`、`react/jsx-runtime`、`react-dom`；`@deepseek-ai/*` 在前端仅允许 `import type`。
   - 严禁使用 `dangerouslySetInnerHTML`、`.innerHTML =` 或 `eval()`；所有新增文本、讲义、提示、诊断、UI 标签必须提供完整中英双语 `{ zh, en }`，并适配亮色与暗色主题。
2. **存储与向后兼容**：
   - SQLite 文件路径 `<profileDir>/ai-infra-lab/ai-infra-lab.sqlite`，`application_id = 1229734210`（`0x494C4142`）不变。
   - 升级版本时**严禁删除或重置已有草稿、笔记、运行记录、证据或复习队列**；必须新增跨版本升级回归测试（用 `v0.1.0` 结构初始化的 SQLite 库在新版本 `Engine.open` 下无损读取）。
3. **单源模拟器职责边界**：
   - **无用户 Python 代码的交互模拟**（访存事务、显存瀑布、流水线甘特图、Continuous Batching 队列、容量规划台）一律写成**纯 TypeScript 确定性模块**（`src/sim-stage-*.ts`），由 Browser UI 与 Host `completeSimulator` 共享，**不在 Python 里重复维护第二套相同状态机**。
   - **有用户 Python 策略代码的实验**一律由容器内 `runtime/controller.py` + `runtime/student.py`（及 `runtime/infra_sim/`）在 `65534:65534` 降权进程组中权威执行并输出 `RunEvent` JSONL。
4. **生命周期与工作区纪律**：
   - 所有监听与副作用由 `ctx.on` / `ctx.effect` 管理；卸载时取消所有在途 RPC 与容器进程组，等待清理完成后关闭 SQLite。
   - 不发布 npm、不创建远端仓库、不触碰用户实际 `DSH_HOME`、不修改主工作区的未提交文件。每个阶段提交前必须通过 `node scripts/check.mjs --full` 与 `git diff --cached --check`。

---

## 1. 跨阶段共享协议演进清单

在推进 P2–P5 时，以下基础文件按需受控扩展（保持向后兼容）：

| 文件 | 演进内容 |
| --- | --- |
| `package.json` | 随阶段依次更新 `version`: `0.2.0` (P2) → `0.3.0` (P3) → `0.4.0` (P4) → `0.5.0` (P5) |
| `src/types.ts` | 1. 扩展 `SimulatorWidgetKind`: `'bit-layout' \| 'roofline' \| 'gpu-coalescing' \| 'memory-waterfall' \| 'pipeline-schedule' \| 'serving-scheduler' \| 'capacity-planner'`；<br>2. 扩展 `UnitDimension` 增加 `'token_rate'`（用于阶段 E `tok/s`）；<br>3. `RunEvent` 可选字段增加 `timeline?: { rank: number; op: string; startMs: number; endMs: number }[]`（用于阶段 D 多进程通信/计算事件回放） |
| `src/estimator.ts` | 在 `UNITS` 中补充 `'tok/s'`, `'tokens/s'`, `'ktok/s'`（`dimension: 'token_rate'`），并在 `DIMENSION_HINTS` 补充双语提示 |
| `src/catalog.ts` | `validateCatalog` 支持版本表 `{ '0.1.0': 8, '0.2.0': 13, '0.3.0': 17, '0.4.0': 22, '0.5.0': 26 }`（精确校验单元总数），并同步放行新增的 `SimulatorWidgetKind` |
| `src/runner.ts` | `validateRunEvent` 同步校验可选的 `timeline` 数组边界（长度 `<= 128`，数值有限） |
| `src/engine.ts` | `completeSimulator` 按新增的 5 种 `SimulatorWidgetKind` 补充确定性探索完成条件校验 |
| `src/components/PrereqGraph.tsx` | 支持按阶段筛选（`All / Stage A / B / C / D / E`）展示跨阶段 DAG 拓扑与完成进度 |

---

## 2. 分阶段详细设计规范

### P2 · `v0.2.0`：阶段 B —— 加速器与 GPU 思维（概念 + CPU 确定性模拟）

#### 2.1 新增文件与模块
- `src/sim-stage-b.ts`（TS 单源确定性模拟）：
  - **Warp 访存合并与 Shared Memory Bank 冲突计算器**：
    - 输入：`warpSize = 32`、`cacheLineBytes = 128`、`elementBytes = 4`、`stride`（`1, 2, 4, 8, 16, 32`）、`baseOffsetElements`（对齐 vs 非对齐偏移）、`sharedBankCount = 32`。
    - 输出：32 个 lane 各自访问的全局字节地址、命中的 `128B` 内存事务段列表（`transactionsCount`、有效带宽利用率 `usefulBytes / transferredBytes`），以及映射到 32 个 `4B` Shared Memory Bank 的通道分布与最大路数冲突（`maxWayConflict`，如 `stride=1` 为 `1-way` 无冲突，`stride=2` 为 `2-way` 冲突，`stride=32` 不同地址为 `32-way` 冲突，同地址广播 `broadcast` 特判为 `1-way`）。
- `src/components/GpuCoalescingExplorer.tsx`：
  - 可视化 32 个 Warp 线程到全局内存 `128B` Cache Sector 与 32 个 Shared Memory Bank 的连线/着色矩阵；支持切换 `stride`、对齐偏移与广播模式；在 `simulator` 练习模式下要求学习者分别观察 `100%` 合并访问（1 事务）与跨步分裂访问（`>= 4` 事务）及一次 `>= 4-way` Bank 冲突后解锁完成。
- `runtime/infra_sim/__init__.py` & `runtime/infra_sim/gpu_sim.py`：
  - `launch_2d_grid(grid_dim, block_dim, kernel_fn, *args)`：在 CPU 上遍历 `(bx, by)` 与 `(tx, ty)` 调用学习者编写的 `kernel_fn(bx, by, tx, ty, *args)`，并提供受控的 `TrackedBuffer` 精确统计 `hbm_reads`、`hbm_writes`、`sram_reads`、`sram_writes`（元素个数与字节数，数据来源标记为 `simulated`，不依赖宿主机计时！）。

#### 2.2 阶段 B 课程与练习规格（`B01–B05`，共 5 单元）

| 单元 | 前置 | 练习 ID 与类型 | 核心内容与判定标准 |
| --- | --- | --- | --- |
| **B01** 为什么需要 GPU | `["A06", "A07"]` | `B01-quiz` (`quiz`)<br>`B01-estimate` (`estimate`, `formula`) | 对比 CPU（大缓存、强分支预测、低延迟）与 GPU（海量 ALU、高带宽 HBM、靠多线程掩盖延迟）；估算题：给定 GPU 峰值 `312 TFLOP/s` 与带宽 `1.6 TB/s`，求算术强度拐点（`195`，`scalar`） |
| **B02** GPU 架构概念 | `["B01"]` | `B02-quiz` (`quiz`)<br>`B02-estimate` (`estimate`, `formula`) | 认识 SM、Warp（32 线程锁步 SIMT）、寄存器、Shared Memory（片上受控缓存）与 HBM 的容量和带宽数量级；估算题：1 个 SM 若最多驻留 `2048` 个线程，相当于多少个并发 Warp？（`64`，`scalar`） |
| **B03** GPU 编程模型 | `["B02"]` | `B03-estimate` (`estimate`, `formula`)<br>`B03-code` (`code`, `simulated`, `b03-grid-map-v1`) | 理解 `gridDim` / `blockDim` / `blockIdx` / `threadIdx` 全局坐标公式；代码题微步骤：① `global_index_1d(bx, tx, bdim)`、② `ceil_grid_2d(height, width, tile_h, tile_w)`、③ `matrix_add_kernel(bx, by, tx, ty, bdim_x, bdim_y, A, B, out, H, W)`（必须包含越界保护 `row < H and col < W`，Oracle 用非整除尺寸如 `35 × 50` 严测边界！） |
| **B04** 访存合并与 Bank 冲突 | `["B03"]` | `B04-sim` (`simulator`, `gpu-coalescing`)<br>`B04-quiz` (`quiz`) | 讲义内嵌 `GpuCoalescingExplorer`；考察 Warp 分支发散（Warp Divergence）、全局访存合并与 Shared Memory Bank 冲突规避（Padding 技巧） |
| **B05** 分块矩阵乘法（Tiling） | `["B03", "B04"]` | `B05-estimate` (`estimate`, `formula`)<br>`B05-code` (`code`, `simulated`, `b05-tiled-matmul-v1`, `requiresPrediction: true`) | 算清朴素矩阵乘与 `TILE=16` 分块矩阵乘的 HBM 流量降幅（理论减少 `16x` HBM 读取）；代码题基于 `gpu_sim.TrackedBuffer` 实现微步骤：① `naive_matmul_step`、② `tiled_matmul_step`、`controller.py` 精确校验两者数值与 `A @ B` 一致，且 `tiled` 的 `hbm_reads` 严格等于 `naive / TILE`！ |

- **术语表扩充**：新增 `SIMT`、`Warp`、`Warp Divergence`、`HBM`、`Shared Memory (SRAM)`、`Memory Coalescing`、`Bank Conflict`、`Tiling`。
- **P2 门禁**：`v0.2.0` 打包、双基线离线安装、全部 10 道（A+B）代码题真实容器通过、`v0.1.0 -> v0.2.0` 数据库无损升级测试通过。

---

### P3 · `v0.3.0`：阶段 C —— 深度学习负载（系统账本与数值稳定性）

#### 3.1 新增文件与模块
- `src/sim-stage-c.ts`（TS 单源确定性模拟）：
  - **训练一步显存与算力账本计算器**：
    - 输入：参数量 $P$（或 Transformer 层数 $L$、隐藏维 $H$、序列长 $S$、微批次 $B$、词表 $V$）、训练精度模式（`fp32` vs `mixed-bf16-fp32-master`）、优化器（`SGD` vs `AdamW`）、是否开启 Activation Checkpointing（重计算）。
    - 精确输出各分项字节数：模型参数、梯度、优化器状态（如混合精度 AdamW 为 $2P + 2P + (4P + 4P + 4P) = 16P$ bytes，若梯度以 fp32 累加则为 $18P$ bytes——讲义与公式必须把约定假设写得一清二楚！）、前向激活值峰值，以及单步前向 `2PBS` / 前反向合计 `6PBS` FLOPs 估算。
- `src/components/MemoryWaterfallExplorer.tsx`：
  - 交互式堆叠瀑布图/条形图展示静态显存（Parameters + Gradients + Optimizer States）与动态显存（Activations $\propto B \times S$），直观看到为什么小模型长序列爆激活、大模型短序列爆优化器状态，以及开启重计算如何用约 `+33%` 算力换取大幅激活显存下降。

#### 3.2 阶段 C 课程与练习规格（`C01–C04`，共 4 单元）

| 单元 | 前置 | 练习 ID 与类型 | 核心内容与判定标准 |
| --- | --- | --- | --- |
| **C01** 神经网络在算什么 | `["A02", "B05"]` | `C01-quiz` (`quiz`)<br>`C01-code` (`code`, `cpu_measured`, `c01-mlp-io-v1`) | 首次引入 3D 张量 `[B, S, H]`；**零微积分推导**，纯从“数据依赖记账”讲清为什么 $Y = XW$ 在反向更新 $W$ 时需要读取前向暂存的 $X$（激活显存的物理根源，数学推导指引至 Neural Lab）；代码题用 `torch` 实现带显式激活缓存字典的两层线性前向并统计缓存张量总字节数 |
| **C02** 训练一步的账本 | `["C01", "A03"]` | `C02-sim` (`simulator`, `memory-waterfall`)<br>`C02-estimate` (`estimate`, `formula`)<br>`C02-code` (`code`, `cpu_measured`, `c02-train-ledger-v1`) | 静态显存（`16P` 混合精度 AdamW 基准法则）与动态激活账本；估算题：`7B`（$7 \times 10^9$）参数模型用标准混合精度 AdamW（按 `16 Bytes/param` 计）仅静态状态至少需要多少显存？（`112 GB`，`bytes`）；代码题编写账本函数并用真实小型 `torch.nn.Module` + `AdamW.step()` 核对 `state_dict` 参数与优化器状态实际总字节数完全吻合 |
| **C03** 混合精度训练 | `["A03", "C02"]` | `C03-quiz` (`quiz`)<br>`C03-code` (`code`, `cpu_measured`, `c03-amp-scaling-v1`, `requiresPrediction: true`) | 为什么需要 FP32 Master Weights（防止 `w + (-lr * g)` 大数吃小数停滞）与 FP16 Dynamic Loss Scaling（将微小梯度平移出下溢区，遇 `Inf/NaN` 跳过更新并缩小 scale）；代码题微步骤：① `fp16_underflow_grad`、② `loss_scaled_step`、③ `dynamic_scaler_update(scale, found_inf)`，与 `fp64` 参考解比对 |
| **C04** Attention 与 FlashAttention | `["B05", "C02"]` | `C04-estimate` (`estimate`, `formula`)<br>`C04-code` (`code`, `cpu_measured`, `c04-online-softmax-v1`, `requiresPrediction: true`) | 算清标准 Attention 实例化 `[B, H, S, S]` 分数矩阵的 `O(S^2)` 显存灾难（估算题：`B=1, Heads=32, S=8192` 的 `fp16` 注意力矩阵大小 = `4 GiB`）；代码题将 Online Softmax 与分块 Attention **拆为 3 个带完整递推公式注释的低门槛填空微步骤**：① `online_softmax_update(m_prev, l_prev, block_scores)`、② `online_attention_step(m_prev, l_prev, o_prev, block_scores, block_v)`、③ `tiled_attention(Q, K, V, block_size)`，Oracle 验证峰值不生成 `S×S` 矩阵且输出与标准 Attention 误差 `< 1e-5` |

- **术语表扩充**：新增 `Activation Memory`、`Master Weights`、`Loss Scaling`、`Activation Checkpointing`、`Online Softmax`、`FlashAttention`。
- **P3 门禁**：`v0.3.0` 全套单元/容器/双基线安装与升级回归通过；验证导师上下文仅引用当次运行事件且不越级剧透答案。

---

### P4 · `v0.4.0`：阶段 D —— 多机多卡分布式训练（容器内多进程 `gloo`）

#### 4.1 新增文件与多进程安全协调器
- `src/sim-stage-d.ts`（TS 单源确定性模拟）：
  - `alphaBetaCost(alphaUs, betaBytesPerSec, messageBytes)` 与 Ring All-Reduce 理论耗时 $2 \frac{N-1}{N} (\alpha + \frac{M}{N \cdot B})$ 计算；
  - GPipe vs 1F1B 流水线并行微批次（Micro-batch $M$，流水级 $P$）精确时间块生成器与 Bubble 率公式 $\frac{P - 1}{M + P - 1}$。
- `src/components/PipelineScheduleExplorer.tsx`：
  - SVG 调度甘特图：对比 GPipe（全部前向再全部反向，峰值激活存 $M$ 份）与 1F1B（稳态一前一后，峰值激活降至 $P$ 份），实时计算 Bubble 占比与设备空闲时间，支持调节流水级 $P$ 与微批次数 $M$。
- `runtime/infra_sim/dist_harness.py`（核心多进程运行底座）：
  - 专用于 `resourceProfile: 'distributed-gloo'`。
  - **关键安全约束**：`controller.py` 在 root 暂存代码后，先以 `user=65534, group=65534, start_new_session=True` 启动单个非特权主控子进程，由该 `65534` 子进程内部调用 `mp.get_context('spawn')` 拉起 `world_size`（2–4）个 worker，配置 `MASTER_ADDR='127.0.0.1'`、绑定 `127.0.0.1` 随机空闲端口 `sock.bind(('127.0.0.1', 0))`、`GLOO_SOCKET_IFNAME='lo'`、`torch.set_num_threads(1)`。
  - **死锁诊断与超时全组强杀**：每个 worker 将当前所处步骤写入共享状态或临时文件；若在 `25s` 内未完成，主控读取各 rank 最后停留原语，生成清晰的双语死锁排错提示（如某 rank 漏调通信原语或张量形状不一致），随后 `controller.py` 执行 `os.killpg(pgid, signal.SIGKILL)` 确保所有派生 worker 100% 终止。

#### 4.2 阶段 D 课程与练习规格（`D01–D05`，共 5 单元）

| 单元 | 前置 | 练习 ID 与类型 | 核心内容与判定标准 |
| --- | --- | --- | --- |
| **D01** 网络通信基础 | `["A05", "C02"]` | `D01-quiz` (`quiz`)<br>`D01-estimate` (`estimate`, `formula`) | 区分节点内互联（NVLink 百 GB/s、微秒延迟）与节点间网络（RDMA/RoCE）；掌握 `T = α + M / β` 成本模型（小消息受延迟 $\alpha$ 限制，大消息受带宽 $\beta$ 限制）；估算题计算给定 $\alpha, \beta, M$ 的单次传输耗时（`time`） |
| **D02** 集合通信原语 | `["D01"]` | `D02-estimate` (`estimate`, `formula`)<br>`D02-code` (`code`, `cpu_measured`, `distributed-gloo`, `d02-ring-collectives-v1`) | 剖析 Broadcast、All-Gather、Reduce-Scatter、All-Reduce 的数据切分流向；在 `world_size=4` 真实 Gloo 进程组中仅用点对点 `dist.send` / `dist.irecv` 实现微步骤：① `ring_reduce_scatter`、② `ring_all_gather`、③ 组合成 `ring_all_reduce`，与 `dist.all_reduce` 参考值完全一致 |
| **D03** 数据并行（DDP） | `["C02", "D02"]` | `D03-quiz` (`quiz`)<br>`D03-code` (`code`, `simulated`, `scalar-cpu`, `d03-ddp-bucketing-v1`) | 为什么不能逐个小参数发 `All-Reduce`（触发上千次 $\alpha$ 延迟）而要梯度分桶（Bucketing）并与反向计算流水重叠（Overlap）；代码题实现反向层完成回调驱动的分桶通信重叠时间线计算器，验证总步时相对串行通信显著缩短 |
| **D04** ZeRO / FSDP 显存切分 | `["C02", "D02", "D03"]` | `D04-estimate` (`estimate`, `formula`)<br>`D04-code` (`code`, `cpu_measured`, `distributed-gloo`, `d04-zero-shard-v1`) | 对比 ZeRO-1（切优化器状态）、ZeRO-2（+切梯度）、ZeRO-3/FSDP（+切参数，通信量从 $2P$ 增至 $3P$）的显存与通信权衡；代码题在 4 进程中实现简版 ZeRO-1 优化器分片步进（`reduce_scatter` 梯度 → 本地更新 `1/4` 参数分片 → `all_gather` 同步参数），验证 4 进程最终权重与单卡完全一致 |
| **D05** 张量并行与流水并行 | `["C01", "D02"]` | `D05-sim` (`simulator`, `pipeline-schedule`)<br>`D05-estimate` (`estimate`, `formula`)<br>`D05-code` (`code`, `cpu_measured`, `distributed-gloo`, `d05-tp-mlp-v1`) | Megatron 式 MLP 列并行（第一层切列免同步）+ 行并行（第二层切行后接 1 次 `all_reduce`）原理，以及流水线并行 GPipe / 1F1B 气泡分析；估算题计算 `P=4, M=12` 时的流水线 Bubble 率（`20%`）；代码题在 4 进程实现列+行张量并行两层 MLP 前向，验证输出与完整单进程 MLP `torch.allclose` |

- **术语表扩充**：新增 `α-β Model`、`All-Reduce`、`Reduce-Scatter`、`All-Gather`、`Gradient Bucketing`、`ZeRO / FSDP`、`Tensor Parallelism`、`Pipeline Bubble`。
- **P4 专项安全对抗门禁**（新增 `tests/runner-distributed-adversarial.ts`）：
  1. **Fork 炸弹拦截**：在 `distributed-gloo` 下执行无限 `os.fork()`，验证被 `--pids-limit=256` 限制且宿主与外层清理正常；
  2. **单 Rank 死锁回收**：仅 `rank == 0` 故意跳过 `dist.all_reduce`，验证内部协调器按时中止、返回死锁诊断且不残留孤儿进程；
  3. **标准输出洪泛拦截**：4 个 worker 同时疯狂打印日志，验证在超出 `outputBytes` 时被立刻截断强杀；
  4. **中途卸载插件回收**：在 4 进程实验运行途中触发 Cordis 插件 `dispose()`，验证容器被立即强制移除且 `docker ps -a --filter name=ai-infra-lab-` 为空。

---

### P5 · `v0.5.0`：阶段 E —— 推理服务、综合容量规划项目与完整交付验收

#### 5.1 新增文件与模块
- `src/sim-stage-e.ts`（TS 单源确定性模拟）：
  1. **Continuous Batching & Paged KV 离散事件模拟器**：
     - 输入：固定请求到达轨迹（可调并发度、输入长度分布与输出长度分布）、最大并发槽位数、KV 总物理块预算、调度策略（`Static Batching` 等待同批最长序列结束 vs `Continuous Batching` 逐 iteration 动态插入新请求并立即释放已完成请求的 KV 块）。
     - 确定性输出：平均/P95 `TTFT`（首字延迟）、`TPOT`（每输出 token 间隔）、系统总吞吐（`tok/s`）、KV 物理块利用率时间曲线。
  2. **X01 容量与并行方案预算校验器（`evaluateCapacityPlan`）**：
     - 给定目标场景预设（例如：在单机 `8 × 80 GiB` GPU 上部署 `70B` 推理服务满足 `TTFT <= 500ms, concurrency >= 32`，或训练 `13B` 模型不 OOM），校验学习者选择的精度（`fp16/bf16/int8/int4`）、TP 度、PP 度、ZeRO 阶段与最大 Batch Size 是否同时满足单卡显存上限、算力延迟约束与互联带宽合理性，返回逐项账本明细。
- `src/components/ServingSchedulerExplorer.tsx` & `src/components/CapacityPlannerExplorer.tsx`：
  - 分别提供推理批处理时间线/吞吐对比可视化，以及 X01 综合方案交互配平仪表盘。

#### 5.2 阶段 E 与综合项目规格（`E01–E03` + `X01`，共 4 单元）

| 单元 | 前置 | 练习 ID 与类型 | 核心内容与判定标准 |
| --- | --- | --- | --- |
| **E01** Prefill 与 Decode 两阶段 | `["A07", "C04"]` | `E01-estimate` (`estimate`, `formula`)<br>`E01-code` (`code`, `cpu_measured`, `e01-kv-decode-v1`, `requiresPrediction: true`) | 用 Roofline 解释为什么 Prefill（一次并行处理整段 Prompt，矩阵乘矩阵）是 Compute-bound，而自回归 Decode（每次 1 个新 token，矩阵乘向量）是极度 Memory-bound；估算 KV Cache 大小（`2 × L × H_kv × D × S × bytes`）；代码题实现带 KV Cache 增量追加的解码步，并与每步全序列重算对比数值等价性及随序列增长的耗时曲线 |
| **E02** Paged KV 与 Continuous Batching | `["E01"]` | `E02-sim` (`simulator`, `serving-scheduler`)<br>`E02-code` (`code`, `simulated`, `e02-paged-allocator-v1`) | 为什么连续预分配最大长度 KV 会造成严重内部/外部显存碎片；参考 vLLM PagedAttention 思想，用 Python 实现固定 `block_size=16` 的物理块空闲链表分配器（微步骤：`allocate_sequence`、`append_token`、`free_sequence` 与前缀共享 `fork_prefix` 引用计数），统计有效利用率提升 |
| **E03** 量化与投机解码 | `["A03", "E01"]` | `E03-estimate` (`estimate`, `formula`)<br>`E03-code` (`code`, `cpu_measured`, `e03-group-quant-v1`) | 为什么权重从 `FP16` 压到 `INT4` 在 Decode 阶段能直接带来接近带宽比例的提速（Memory-bound 阶段搬运字节减至 1/4）；学习按组对称量化（Group-wise Symmetric Quantization）抑制离群值误差，以及投机解码（小草稿模型猜 $K$ 步 + 大模型一次并行验证把矩阵乘向量变回矩阵乘矩阵）；代码题实现 `quantize_int4_grouped` 与 `dequantize_int4_grouped` 并对比全局量化与分组量化的均方误差 |
| **X01** 综合容量规划项目 | `["C02", "D04", "D05", "E02", "E03"]` | `X01-sim` (`simulator`, `capacity-planner`)<br>`X01-code` (`code`, `formula`, `x01-capstone-v1`)<br>`X01-design` (`explanation`) | 综合结课实战：① 在容量规划台中配平一套 `70B` 推理方案和一套 `13B` 训练方案；② 编写 `plan_cluster_budget` 自动化容量审计函数通过多组真实规格用例；③ 撰写架构权衡设计说明（保持 `inconclusive`，可调用导师点评） |

- **术语表扩充**：新增 `Prefill`、`Decode`、`KV Cache`、`TTFT / TPOT`、`PagedAttention`、`Continuous Batching`、`Group Quantization`、`Speculative Decoding`。
- **P5 交付与全流程门禁**：
  1. **归档上限与重放核对测试**：验证超限 JSON（`> 4 MB` 或条目超限）、篡改结构、跨练习伪造 ID 均被拒绝，合法归档导入后证据与运行记录准确恢复。
  2. **跨版本升级链测试**：构造 `v0.1.0` -> `v0.5.0` 升级回归测试，确保旧库平滑打开、零数据丢失。
  3. **官方宿主隔离会话冒烟**：在隔离临时 profile（绝不改动实际 `DSH_HOME`）中完成 `0.2.1-rc.2` 与 `0.2.1-rc.5` 双基线空缓存离线安装、Host/Client 包加载及全套 26 个单元完整性校验。

---

## 3. P6（远期留白，本轮不实施）

- `RunnerBackend` 接口（位于 `src/runner.ts`）保持稳定，当前仅实例化 `LocalDockerCpuRunner`（`runnerProfile: 'cpu'`），UI 中不渲染远程 GPU 配置入口。后续若引入远程 GPU Runner，需单独提交包含双向 mTLS/Token 鉴权、配额熔断与租户沙箱隔离的设计方案评审。

---

## 4. 推荐分步提交节奏

建议每完成一个阶段独立验收并提交一次干净的 Git Commit（分支保持在 `codex/ai-infra-lab-v0.1` 或按需在当前 worktree 递进提交）：

1. `feat(ai-infra-lab): add v0.2.0 stage B GPU concepts, coalescing simulator, and tiling lab`
2. `feat(ai-infra-lab): add v0.3.0 stage C training memory ledger, AMP, and tiled attention`
3. `feat(ai-infra-lab): add v0.4.0 stage D gloo distributed harness, collectives, ZeRO, and TP/PP`
4. `feat(ai-infra-lab): add v0.5.0 stage E serving labs, capstone planner, and upgrade gates`

每次提交前依次执行：
```powershell
cd D:\Documents\FeiyangChen\devApps\dsh_plugin\.worktrees\ai-infra-lab\packages\ai-infra-lab
node scripts/check.mjs --full
cd D:\Documents\FeiyangChen\devApps\dsh_plugin\.worktrees\ai-infra-lab
git diff --check
```
