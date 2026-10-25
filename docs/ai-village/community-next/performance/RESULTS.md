# 获批场景软件性能实测

2026-10-25。独立运行 `approved-scenes-software-dpr1-02` 的测量、资源库存断言和清理完成，结果 **PASS**。这表示测量程序与所列断言通过，不表示硬件前台 FPS、长期内存或未设阈值的性能指标已达标。

固定包为 `0.13.0-preview.3`，SHA-256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`。Host/frame 从包提取；官方鉴权 preview 的 UI fixture 从记录 hash 的当前源码编译。index/client/frame 三 bundle 与包匹配，源码准备后和结束时均重检未变化。没有修改产品、重建包、改用户 DSH_HOME 或触碰旧隔离 profile。

原始证据：[result.json](approved-scenes-software-dpr1-02/result.json)、[identity.json](approved-scenes-software-dpr1-02/identity.json)、[执行脚本快照](approved-scenes-software-dpr1-02/runner.mjs)。脚本入口为 [ai-village-approved-scenes-perf.mjs](../../../../scripts/ai-village-approved-scenes-perf.mjs)。

## 环境与五秒样本

Chromium headless `149.0.7827.55`，DPR 1，1440×960。CDP 实际识别 `ANGLE_SWIFTSHADER` / Vulkan SwiftShader Device (Subzero)，SwANGLE 5.0.0。七居民为蓝鲸、Claude、Gemini、GPT、Grok、Kimi、Qwen；通过真实 UI 入住和地图旅行，每区继续模拟约五秒，不注入世界或 tick。三区截图保存在结果目录。

| 活跃区域 | 渲染 FPS | JS paint 均值 ms | JS paint p95 ms | 纹理 / Source / Blob URL | 解码 RGBA B | 累计解码 ms | 自有浏览器 CPU 单核当量 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 庭院 | 21.76 | 0.579 | 0.80 | 128 / 128 / 128 | 67,346,784 | 351.0 | 343.08% |
| 书屋 | 22.47 | 0.648 | 0.90 | 123 / 123 / 123 | 63,796,952 | 227.6 | 265.94% |
| 茶会广场 | 21.93 | 0.652 | 0.90 | 125 / 125 / 125 | 61,698,008 | 214.9 | 274.19% |

FPS 是 frame 计数差分。p95 是当前 iframe 最多 600 次 paint 的滚动历史，包含入场与暖机，不是隔离的五秒分位数。JS paint 不含 GPU 完成时间。解码时间是该 iframe 的累积值：庭院含逐位入住的七批，书屋和茶区各一批，不能当成同口径的单次入场解码比较。CPU 合计 browser、renderer、GPU、network 的累计 CPU 秒差分，超过 100% 表示占用多个核心；软件 GPU 进程贡献了其中大部分，不等于机器总 CPU 百分比。

## 首帧与确认延迟

首次打开时，真实 click 到 first-frame-rendered 消息为 **595.2 ms**，到只读观测入口完成为 **1,310.6 ms**。此时尚未入住全部七人。

| 七人真实地图操作 | 世界/修订确认 ms | 点击到真实首帧 ms |
| --- | ---: | ---: |
| 首次前往书屋 | 130.0 | 804.5 |
| 回庭院 | 158.9 | 870.5 |
| 首次前往茶区 | 171.5 | 792.9 |
| 随后的十二次旅行范围 | 133.8–197.2 | 740.7–882.2 |

时间起点来自实际按钮 click 捕获；确认通过 Playwright 只读轮询，包含观察调度延迟，不等于 Host 内部执行时间。首帧取真实 iframe 消息，不以保存确认代替已绘制。

## 真实侧栏隐藏

通过 Host 的“侧栏开合”隐藏小院，iframe 实际卸载。随后 **5,004.169 ms** 内世界逐字段不变，ticks **518 → 518**，iframe **0 → 0**；最后可见 frame 计数为 141，隐藏期间没有该渲染实例。

同一自有 browser CDP 报告的四个 PID 在窗口两端均存在，没有新增或退出 PID。总 CPU 增量 **0.011259 s**，单核当量 **0.225%**。页面 `document.visibilityState` 仍为 `visible`：该证据覆盖应用被真实侧栏隐藏，不覆盖 OS 最小化、物理睡眠或窗口遮挡。

## 十二次旅行的短期内存

隐藏后重新打开，额外执行三轮“庭院 → 书屋 → 庭院 → 茶区”。各区域的纹理、Source、RGBA 和 Blob URL 数量在所有重访中完全一致；只有当前区域资源进入 iframe，地图和另两个区域资源没有混入。

下表为每次旅行后的即时快照，单位 MiB。JS heap 仅来自主 page 的 `Performance.getMetrics`，不代表全部 iframe/OOPIF。RSS 与 private 仅针对本测试 browser 的 CDP PID 集合读取；RSS 合计可能重复计算共享页。没有强制 GC、没有空闲稳定期。

| 次序 | 区域 | 主 page JS heap | 自有进程 RSS 合计 | private 合计 |
| --- | --- | ---: | ---: | ---: |
| 1 | 庭院 | 16.10 | 1,259.31 | 706.64 |
| 2 | 书屋 | 20.60 | 1,277.67 | 676.52 |
| 3 | 庭院 | 15.32 | 1,340.32 | 712.93 |
| 4 | 茶区 | 21.17 | 1,315.73 | 686.12 |
| 5 | 庭院 | 14.55 | 1,358.48 | 721.43 |
| 6 | 书屋 | 20.50 | 1,320.68 | 686.20 |
| 7 | 庭院 | 19.85 | 1,352.34 | 714.57 |
| 8 | 茶区 | 21.36 | 1,318.91 | 694.85 |
| 9 | 庭院 | 19.96 | 1,360.87 | 722.54 |
| 10 | 书屋 | 20.65 | 1,334.47 | 694.06 |
| 11 | 庭院 | 20.03 | 1,357.90 | 724.20 |
| 12 | 茶区 | 21.59 | 1,331.44 | 700.24 |

库存未增长与进程内存完全稳定是不同结论。本样本 RSS 有上升及波动；同区第 4/8/12 次茶区 private 为 686.12/694.85/700.24 MiB。短样本不能区分延迟回收、缓存与泄漏，不能宣称长期无泄漏或已达到稳定平台。这里没有为指标更改产品。

## 旧样本并列与范围

[0.12 结果](../RESULTS.md) 的七人书屋 SwiftShader 约 1.5 秒短样本：DPR1 **22.178 FPS / p95 1.2 ms**，DPR2 **23.080 FPS / p95 1.4 ms**；真实旅行首帧分别 **0.522–1.203 s** 和 **0.496–1.302 s**。本次是获批书屋美术、不同采样时长与执行环境的独立记录，不计算提升或回退百分比。旧原生 Intel Arc 隐藏/遮挡约 1 FPS 也不作为可比前台基准。

本轮没有重放完整故事、没有测方向动画，也没有原生硬件前台性能结论。真实故事与原生验收另见对应 QA 记录。

## 失败保留与清理

首轮 [approved-scenes-software-dpr1-01](approved-scenes-software-dpr1-01/result.json) 在 SaveStore 初始化因空 profile 目录未创建而 ENOENT，明确 **FAIL**；当时尚未启动 browser 或监听 Host，未产生性能数据。只在新脚本增加创建空隔离 profile，再用新 label 02 运行，没有覆盖失败或降低断言。

02 的浏览器错误和外网请求均为空。结束时 dispose UI，关闭 context/browser/Host，只读核验自有 PID **15768、5588、26048、26604** 全部退出，`remaining: []`。没有按进程名称批量终止用户程序。旧 0.12/0.13 冻结包与 profile 保持不变。
