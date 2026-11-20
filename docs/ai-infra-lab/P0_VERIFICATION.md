# AI Infra Lab · P0 技术验证记录

日期：2026-11-18
分支：`codex/ai-infra-lab-v0.1`（基于 `main` `f4c2ac6`）

## 1. DSH 宿主 API 审计与双基线离线安装实测

- **核验基线**：
  - 下限基线：`.build/official-runtime`（`@deepseek-ai/dsh@0.2.1-rc.2`，revision `687f282e8625c6b8d11ff58211a90524be2e4317`）
  - 中间基线：`.build/official-runtime-rc3`（`@deepseek-ai/dsh@0.2.1-rc.3`）
  - 最新基线：`.build/official-runtime-rc5`（`@deepseek-ai/dsh@0.2.1-rc.5`，revision `b830ec950faba0a46dda564be3e2d854afed94f1`）
- **API 同构性结论**：
  - `@deepseek-ai/cordis`（均为 `4.0.5`）、`@deepseek-ai/schemastery`（均为 `3.18.5`）
  - Host：`ctx.get('profileContext')?.dir`（`dsh-app-boot`）、`ctx.on('connection/request')`（`dsh-client-connection`）、`brandString`（`dsh-brand`）、`createUserMessage`（`dsh-llm`）、`currentSelection`（`dsh-agent-default-model`）在 `0.2.1-rc.2` 至 `0.2.1-rc.5` 中完全一致。
  - Client：`window.__ModuleLoader__.load`（`dsh-client-modules`）及 `slots` / `locale` / `layout` 注入契约在 `0.2.1-rc.2` 至 `0.2.1-rc.5` 中完全一致。
- **SemVer 与空缓存离线安装结论**：
  - `@deepseek-ai/dsh-app-boot` 的 `evaluatePluginCompatibility` 明确让预发布标签参与区间匹配（`Prereleases participate in ranges`），且在存在 `engines.dsh` 时以其为准。
  - 锁定版本声明为 **`>=0.2.1-rc.2 <0.3.0-0`**。经官方 `runProfilePnpm`（`--offline --ignore-scripts --registry=http://127.0.0.1:9`）在 `0.2.1-rc.2` 与 `0.2.1-rc.5` 两个空 store 隔离临时 profile 实测，安装均以 `exitCode=0` 通过，`evaluatePluginCompatibility` 均返回 `undefined`（兼容）。

## 2. CPU 容器镜像构建与锁定信息

- **宿主机 Docker 环境**：Docker Engine `29.9.2`（WSL2 Linux backend，12 逻辑核，16 GiB 内存）
- **镜像标识**：`dsh-ai-infra-lab-cpu:0.1`
- **镜像 Digest / ID**：`sha256:cd7be85023d4c08ca949ad9f43f8b2276ffb580597ce9f68bc954d4c43fd275b`
- **解压体积**：`1,344,851,365` bytes（约 `1.25 GiB` / `1.34 GB`，环境面板需按此真实体积提示学习者）

## 3. 硬化断网降权下的 4 进程 Gloo 集合通信实测

- **容器参数**：`--network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 256 --memory 1536m --shm-size 256m --cpus 4 --tmpfs /tmp:rw,noexec,nosuid,size=128m --user 65534:65534`
- **环境变量**：`MASTER_ADDR=127.0.0.1`、`MASTER_PORT=29505`、`GLOO_SOCKET_IFNAME=lo`、`OMP_NUM_THREADS=1`、`MKL_NUM_THREADS=1`
- **实测结果**：
  ```json
  {"status": "ok", "uid": 65534, "elapsed_ms": 1585.9, "peak_container_threads": 19, "all_reduce_sample": [10.0, 20.0, 30.0, 40.0]}
  ```
- **结论**：无需放开任何网络权限，仅靠容器内置 `lo` 回环接口与 `256m` `/dev/shm` 即可稳定跑通 `world_size=4` 的 PyTorch Gloo 进程组；4 进程并发峰值总线程数为 `19`，`--pids-limit=256` 留有充足安全裕度且能拦截 fork 炸弹。

## 4. WSL2 容器内内存层次（Stride / 行列局部性）与多核并行实测

- **NumPy 视图切片（64 MiB `float32`，9 轮采集中位数）**：
  ```json
  {
    "ns_per_elem_median_and_sd": {
      "stride_1": [0.369, 0.043],
      "stride_2": [0.499, 0.054],
      "stride_4": [0.889, 0.109],
      "stride_8": [1.516, 0.175],
      "stride_16": [2.625, 0.33],
      "stride_32": [4.743, 1.211]
    },
    "row_slice_sum_ms": 0.34,
    "col_slice_sum_ms": 7.16,
    "col_over_row_ratio": 21.06
  }
  ```
  - 从 `stride=1` 到 `stride=16`（跨满 64B Cache Line），单元素耗时单调上升 `7.1x`；二维数组按列跨步规约比按行连续规约慢 `21.06x`，趋势极度显著，采用中位数相对比值阈值（如 `stride_16 / stride_1 >= 2.0`、`col / row >= 2.5`）可在不同 CPU 上稳健判定。
- **多核并行（`multicore-cpu`：`--cpus 4`，单进程内 BLAS 单线程）**：
  - 12 组 `384x384` SVD 在 `Pool(4)` 下实测 `serial_ms=134.2`、`pool4_ms=81.9`（含约 45ms 进程池启动固定开销），增大单任务粒度可清晰展示进程启动串行开销与 Amdahl 定律曲线。

## 5. P0 门禁结论

全部 4 项验证均一次通过，无不可行项需移出范围，正式进入 **P1（v0.1 骨架 + 阶段 A）** 实施。
