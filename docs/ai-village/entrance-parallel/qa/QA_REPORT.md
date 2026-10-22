# Thread B · QA_HARNESS_READY

共同 Base / 被测生产 SHA：bc230e7f662f47efb497529a276d09aad90ad4ac。
只读艺术源 SHA：42ee9f46eb0b772fb556631b9a75669c9ea49edf。
日期：2026-10-22（Asia/Shanghai）。QA 提交身份见任务包 coord/B_CHECKPOINT.json；本报告包含在该 QA-only commit 中。

A_CHECKPOINT.json 在本批收尾时不存在，因此 A 集成交叉验证为 NOT_RUN；已实现带文件所有权审核的隔离 eval 工具，未读取 A 的未提交生产文件。

## 实际结果

| 范围 | 结果 | 证据 |
|---|---|---|
| 原入口、frame bridge、runtime、保存事务、存档保留与新增故障测试 | 52 PASS / 1 FAIL | unit-latest.json |
| DQ-ART-01 损坏图层元数据回退 | FAIL，P2，具体复现见下文 | REPRODUCTIONS.md |
| 新 QA TypeScript 严格类型检查 | PASS | typecheck.json |
| PNG 检测器自身截断/CRC/超尺寸/行长/滤波测试 | 2 PASS | png-validator.json |
| 独立 Host/Client/Frame 浏览器构建 | PASS，未运行会重写 manifest 的正式生成器 | browser-full.json 的 build hashes |
| 真实 Chromium 浏览器故障与偏好矩阵 | 12 场景 PASS | browser-full.json |
| 100 次 frame 单测重建 | PASS，无残留 deadline/subscription | dualqa-protocol.spec.ts |
| 100 次浏览器 sidebar 隐藏/恢复及尺寸轮转 | PASS，热态计数稳定；初始保留增长另列 | PERFORMANCE.json |
| 21 张 PNG（19 图层/兼容文件 + 2 母版）完整性/解码/Alpha | PASS | art/ART_AUDIT.json |
| 原始 11 层资源整包 | FAIL：5,747,338 bytes / 17,107,200 pixels | art/RESOURCE_BUDGET.json |
| 8 层 compat 候选预算 | PASS：2,749,401 bytes / 1,773,738 pixels | art/RESOURCE_BUDGET.json |
| 原始门扇 + 门框对不透明门洞 mask 的闭合覆盖 | PASS：230,958 检测像素，漏点 0 | art/ART_AUDIT.json |
| 原美术独立浏览器关键帧 | 30 张 CAPTURED；人工视觉未批准 | art-preview/validation.json（见产物目录） |
| 三尺寸 × 两主题双底色门洞中心透显 | 6 PASS；不代表全门洞逐像素集成验收 | art-preview/validation.json |
| 关闭/全开截图差异 | MEASURED，非自动视觉签收 | compare/door-closed-open.json |

命令见 [工具说明](../../../../tools/ai-village-dualqa/README.md)。图片位于 packages/ai-village/art/QA/entrance-dual/qa/；所有构建、缓存与临时 profile 位于 tools/ai-village-dualqa/.generated/，不进入提交。

## 已验证边界

- ready-to-render 不能冒充当前首帧。首帧先于 ready、重复首帧、旧 token / attempt / assets / view、资产替换中的旧 decode / assets-ready / ACK 不越过门控。
- 随机乱序 decode 在同一 attempt 内单调；新 attempt 清零，不继承旧进度。
- 真实浏览器：慢资源时跳过保持阻断；缺图、同长度错哈希、截断 PNG、decode rejection 均出现受控错误；绘制被暂停时 ticks 为 0。
- unknown 保存结果 + sidebar 隐藏 + frame 重建不能揭幕或重放写入；只读核对能确认提交。多重 hidden/sidebar 暂停、手动 user 暂停、布置草稿与 ticks 保留。
- 租约申请拒绝不能通过伪造当前格式 ACK 或 skip 绕过。
- 320×360 / 340×720 / 580×720 / 1080×760，浅深色 × 中英共 16 个等待画面截图。减少动态/减少透明有单独浏览器场景。
- 单人在场只准备 32 纹理；七头像未造成不在场角色全量纹理解码。
- 100 次循环均只有一个活跃 iframe、无重复 full intro，稳定后无运行 WAAPI。

## 计数与性能的诚实边界

同尺寸 GC 后：初始 602 listeners，热态第 20/40/60/80/100 次均 640；documents 始终 2，热态 nodes 均 249。观察到一次性 +38 listeners / +76 nodes，未观察到热态持续增长。尚未对 retained heap 作对象归因，不能宣称完全零泄漏。harness-calibration-stress.json 保留早期过严绝对阈值失败及更正说明；最终判定见 browser-full.json。

十次冷启（新 context/profile）open-to-entered：p50 819 ms / p95 953 ms；首帧 ACK p50 639.7 ms / p95 786 ms。100 次 sidebar 返回含尺寸轮转 p50 617 ms / p95 661 ms。全部 CONTENDED / NOT_COMPARABLE，仅为采样流程证据，不作为正式性能验收。记录长任务、资源传输及 frame 指标；直接纹理解码 CPU 耗时尚未测量。

## 尚未执行 / 人工待验

- A 最终候选的真实入口开门阶段中断、非矩形门洞、最终图层预算和裁剪 pivot 交叉验证：NOT_RUN，等待已提交 checkpoint。
- 100 次真正 close/show（本次是 100 次 sidebar 生命周期）、设备休眠、低内存、资源 413：NOT_RUN。
- 最终候选全仓库类型检查、正式打包、离线安装、照片 720×960、Git/Live2D 完整共存：NOT_RUN。本批只构建 QA 夹具，不冒充发行验收。
- Windows 真 GPU、DPI/多屏、人工美术、白边黑边/透视观感、HUD 色系：NEEDS_HUMAN_REVIEW。
- 一小时真实运行：DEFERRED。

所有生产和正式美术文件均未修改；没有 push、合并 main、写入真实 profile 或批准 ART_APPROVED。
