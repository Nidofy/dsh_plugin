# 获批场景独立软件性能测量准备

2026-10-25，状态 **已执行**：并行浏览器和原生 QA 完成并清理后运行。首轮 `approved-scenes-software-dpr1-01` 的 harness 初始化失败保留；只修复脚本创建空 profile 的遗漏，新 label `approved-scenes-software-dpr1-02` 完成测量与清理。数值、边界与证据见 [实际结果](RESULTS.md)。不得将脚本语法通过记作性能通过。

固定目标：`0.13.0-preview.3`，SHA-256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`。脚本拒绝不同包或与包不一致的当前 index/client/frame bundle；复制包内 lib/assets 到新隔离目录，用现有 phase4 官方鉴权 Host 和真实 UI fixture。记录全部生产源码 hash，并在准备后、执行结束时重检源码未变化。UI fixture 从这些源码编译；不能称作直接安装后的 Desktop 测试。

脚本：[ai-village-approved-scenes-perf.mjs](../../../../scripts/ai-village-approved-scenes-perf.mjs)。执行命令（需独立新 label，不覆盖旧证据）：

```powershell
node scripts/ai-village-approved-scenes-perf.mjs approved-scenes-software-dpr1-01 --run
```

每个 label 写入本目录的独立子目录；profile、包提取和测试 harness 留在 `.build/ai-village-approved-scenes-perf/<label>`。不改产品、历史 QA 脚本、用户 DSH_HOME 或冻结包。

| 测量 | 方法与解释 |
| --- | --- |
| 七人三区 | 真实 UI 入住蓝鲸、Claude、Gemini、GPT、Grok、Kimi、Qwen，经真实地图前往书屋和茶会；每区连续约 5 秒 frame/tick 差分。 |
| 绘制成本 | 记录 `__sceneMetrics` 的 mean 增量和 p95；p95 来自当前 iframe 最多 600 次 paint 的滚动历史，包含入场/暖机，不能写成严格独立的五秒分位数。JS paint 不等于 GPU 完成时间。 |
| 首帧与 UI 确认 | 只读 click 捕获时间与实际 first-frame-rendered 消息；旅行世界/修订确认通过只读轮询观测。后者包含轮询调度延迟，不是精确 Host 内部耗时。 |
| 资源与解码 | 实际 frame 的 textures、TextureSource、RGBA、Blob URL、decode 时间及 decode 数量；只准备活跃场景，不把地图资源计入 iframe。 |
| 短期内存趋势 | 另做 12 次真实地图旅行，记录各区库存、主 page `Performance.getMetrics` 和该自有 browser CDP 报告 PID 的 Windows working set/private bytes。主 page JS heap 不代表 OOPIF 或整浏览器；RSS 合计可能重复计算共享页。 |
| 隐藏五秒 | 点击真实 Host “侧栏开合”隐藏并卸载小院 iframe；断言五秒后世界逐字段相等、iframe 仍不存在，同时记录该自有 browser 的 `SystemInfo.getProcessInfo` 累计 CPU 差分。记录 document.visibilityState；这是应用被侧栏隐藏，不伪装为物理最小化/睡眠或 OS 前台状态。 |
| CPU | 仅计算同一 CDP 自有 browser 前后均存在 PID 的 cpuTime 增量，列出新建/退出 PID；单核百分比以累计 CPU 秒 / 实际秒计算。 |
| 清理 | 正常 dispose UI、关闭 context/browser 和官方 Host；只读核验该 browser 报告的 PID 已退出。不枚举用户进程，不按名称批量结束进程。 |

本轮不重跑完整故事，不做新游戏操作注入或快进。只有短期趋势，不能宣称长期无泄漏；headless SwiftShader 不冒称硬件 FPS。最终说明中可并列 0.12 已有短样本和环境，但不能计算不具可比性的性能回退百分比。

准备验证：`node --check scripts/ai-village-approved-scenes-perf.mjs` 已通过。实际结果、身份、截图、逐次旅行记录及清理状态已保存于各 label；原始失败证据未覆盖。
