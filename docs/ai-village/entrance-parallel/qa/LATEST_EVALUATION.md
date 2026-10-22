# 最新独立评估：QA_EVALUATED_WITH_FINDINGS

最终直接重测 A_SHA：123d1697e033456101e541a093eebd64fd192007。
完整矩阵 A_SHA：4d9cd1ab06ec506cc28f2d574b4c7c3a8c40d503。
QA_CODE_SHA：b6311d0cb8f65e1bceaba67dc1e7b7df0133dae1。
三次评估均使用独立 detached worktree，仅叠加已提交 QA-only commits；生产源码、正式资源与生成清单无改动。

123d169 只接受早期 QA 提交并更新文档，其生产 src/assets/experiments 树与4d9cd1a一致，见 PRODUCTION_EQUIVALENCE.json。因此未对相同产品无限重跑200次压力；在123d169上直接重跑58单测、受限预览构建和关键失败探针。

| 项目 | 结果 | 证据 |
|---|---|---|
| 123d169 的入口/运行时/保存/保留测试 | 58 PASS | evaluation-123d169/unit-latest.json |
| DQ-ART-01 null 图层回退 | FIXED_VERIFIED | 同上 |
| 4d9cd1a 生产浏览器回归 | 13 PASS | evaluation-4d9cd1a/browser-full.json |
| 100次 sidebar 隐藏恢复 + 尺寸轮转 | PASS，热态listeners640稳定 | evaluation-4d9cd1a/SUMMARY.json |
| 另100次真正关闭/重开 + 尺寸轮转 | PASS，热态listeners610稳定 | 同上 |
| 候选预览关键帧/阶段中断/404回退 | 14 PASS | evaluation-4d9cd1a/integrated-review.json |
| 闭门安全门洞透色 DQ-SEAM-01 | P2 FAIL，123d169仍复现 | evaluation-123d169/integrated-review-seam-probe.json |
| 当前8张正式候选PNG及预算 | PASS，2,749,401 bytes / 1,773,738 pixels | evaluation-4d9cd1a/art/RESOURCE_BUDGET.json |
| 当前闭门裁剪Alpha重建 | FAIL，设计x538..541透过率最高3.9216% | evaluation-4d9cd1a/art/ART_AUDIT.json |
| QA strict TypeScript与隔离构建 | PASS | 各eval类型报告与build hashes |

## DQ-SEAM-01：当前未解决

精确580×720、浅色、中文、DPR1。真实候选DOM处于wait，门扇关闭，合法首帧ACK仍被测试夹具保留，canReveal=false。

在入口下加入两个纯色诊断平面并截图。安全区26,700个像素中300个RGB变化超过2，最大通道差56；完整截图差异还包含安全区外边缘，不应混用其全图最大值。屏幕上为很细的中心缝隙，但可由下层画面透色独立复现。

命令（在新eval根目录）：

    node scripts/ai-village-dualqa-build.mjs --review
    node scripts/ai-village-dualqa-review.mjs seam-probe

该命令应退出1，不能删断言或提高容差掩盖。严重度P2：视觉闭合契约不满足，未发现门控提前释放或数据损坏。建议A处理派生门扇边缘Alpha/闭合重叠，再由B对新已提交SHA重测；原始美术保持只读，ART_REVIEW不得自动变APPROVED。

当前图片位于 packages/ai-village/art/QA/entrance-dual/qa/evaluation-123d169/integrated-review/。4d9cd1a的完整截图、差异图位于对应evaluation目录和compare/latest-closed-seam-*。

## 性能、保留与验收边界

sidebar循环热态：documents2 / nodes249 / listeners640；close/show循环热态：documents2 / nodes218 / listeners610。两者在20/40/60/80/100次均稳定，末尾WAAPI运行数0。初始listeners602分别增长38和8，尚未做retaining-path归因；只能说明本次100次热态未继续累积。

已有10次冷启与100次sidebar耗时样本见 PERFORMANCE.json，全部CONTENDED / NOT_COMPARABLE。此次200次循环是自动化测试，不代表一小时真实使用验收。SwiftShader与显式reviewMotion只证明软件后端/DOM流程，不替代真实GPU。

NOT_RUN：正式独占性能基线、直接纹理解码CPU计时、低内存/休眠/413、由B独立执行最终可安装包/离线安装、最终照片720×960与完整跨插件回归。A自身检查不能当作B已运行。
NEEDS_HUMAN_REVIEW：真实Windows GPU/DPI/多屏、最终美术与门框透视/边缘观感。
DEFERRED：一小时真实运行。

没有P0/P1已证实问题；存在P2闭门缝隙，故当前不是独立QA全绿签收，不批准发布。
