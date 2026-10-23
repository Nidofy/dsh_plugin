# 过场角色顺序填色修复 · 0.7.0-preview.3

2026-10-23，在既有 `codex/feature-ai-village-entrance` 开发，基线 `d2678c37521b88ff6f269faa3a1a28a76cc2f3d0`。用户反馈安装和人工视觉验收基本通过，但加载时只看到最右侧角色从下向上填色。此反馈不自动改变入口候选的ART_REVIEW状态。

## 原因与修复

原 `Portrait` 使用 `clip-path: inset(top% 0 0)`，明确是自下向上的遮罩。虽然 `portraitFill(progress,index)` 原本就按七人顺序分段，但直接采用真实进度；较快完成的元数据/资源校验可以一次跨过前几个角色，尤其在接近95%等待首帧时，只剩最右角色有未完成颜色。没有证据说明前六人被CSS隐藏或未参与进度。

现在遮罩改为 `inset(0 right% 0 0)`，每位角色横向从左向右恢复颜色。七人共用一个显示进度，以约700ms/整行的速率追上真实进度，跨多段更新时依然保持“左侧已完成、当前正在填色、右侧保持灰色”。显示值始终不超过真实准备进度；ARIA仍报告真实进度。就绪后的淡出等待颜色完成，之后再次校验真实首帧条件。

这段RAF仅在显示进度落后时存在，追平后停止，关闭/卸载时取消；减少动态或跳过时立即采用真实值，不为填色增加等待。没有改变首帧ACK、资源校验、生产美术选择器、World/偏好/协议格式或已完成棋局功能。当前仍world8/scene3/rules4/content5/preferences3/frame6。

## 验证

- `node scripts/typecheck.mjs`：全仓严格类型通过。
- `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`：41文件215测试通过。新增4项真实React组件用例：初始95%仍显示七人有序填色且不能提前进入；快速就绪时等待填色且卸载取消；减少动态和跳过各自保留真实首帧等待。
- `node scripts/ai-village-release.mjs`：正式官方基线构建通过。
- `node scripts/ai-village-loading-fill-qa.mjs run-02`：6场景通过，实际生产组件、官方鉴权Host、独立profile、Chromium SwiftShader。逐帧观察CSS与实际进度，快速加载、慢素材、扣留首帧都实际观察到0→1→2→3→4→5→6逐人填色；减少动态、跳过、关闭通过。没有向runtime注入假进度，也没有修改存档。
- pack、解包smoke、实际CLI组合及空缓存offline安装通过。没有额外安装SDK或使用用户日常DSH_HOME。

首轮run-01的快速与慢加载通过；扣留首帧场景主动丢弃render后，只放开拦截却未请求新view，导致测试30秒超时。run-02通过真实窗口resize触发新view/ACK后通过；生产协议没有为此修改。原FAIL及录像保留在[run-01](qa/run-01/validation.json)。

最终观察数据和源码/bundle哈希见[run-02/validation.json](qa/run-02/validation.json)。顺序截图：[开始](qa/run-02/sequence-0.png)、[中段](qa/run-02/sequence-3.png)、[末段](qa/run-02/sequence-6.png)；相应场景子目录含实际录屏。截图不冻结模拟或手动设置遮罩，拍摄延迟可能使画面稍晚于触发点。原始逐帧数据确认每位角色的部分填色阶段，所有头像在填色起点已完成加载。

本次没有重新进行原生Desktop安装/长期性能及全部棋局验收；preview.2的原生记录仍属于原包。该修复的新包通过当前专项和离线安装，供用户安装后复验原生过场观感。

## 产物

`dist/nidofy-dsh-ai-village-0.7.0-preview.3.tgz`，276文件，**32,166,364 bytes**。

SHA256：`ed3ff1301e902c9b806341835fef3b2392adc72458643cffcc41a44a8f15aefb`。

preview.2旧归档保留，没有覆盖。仅本地提交，不远端发布；两份用户原有未跟踪文档保持原字节。M5/M6等长期任务范围以[此前交接](../table-preview/HANDOFF.md)为准，本次只修复加载反馈。
