# AI Infra Lab (`dsh-plugin-ai-infra-lab`)

面向完全零基础学习者的 **AI 算力与系统基础设施实验室**（独立 DeepSeek Harness 插件，v0.1）。

## 特性（v0.1 · 阶段 A）

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
# 包含真实 Docker 容器全部参考解/起始模板回归、Gloo 4 进程与对抗性安全隔离检查：
npm run check:full
```

兼容宿主版本范围：`>=0.2.1-rc.2 <0.3.0-0`（已在 `0.2.1-rc.2` 与 `0.2.1-rc.5` 官方离线基线验证）。
