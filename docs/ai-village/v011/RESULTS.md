# AI Village 0.11.0-preview.1 · 邻里的回忆册

本轮按用户附件七阶段任务实施，工作目录仅为独立 `dsh_plugin`。功能候选已构建和打包；书屋分层美术是独立待签收候选，未启用。人工美术签收与物理睡眠/唤醒仍是独立门禁。

## 身份与范围

分支 `codex/feature-ai-village-entrance`，开发起点 HEAD `fb47baa2d3a9366ceae95dfeab7c38d5bd37e939`。2026-10-24 验收时实现尚未提交，因此包及截图中的 HEAD 是基线身份；114 个当前源文件、运行 bundle、381 个包内文件的 SHA-256 见 [package-identity.json](package-identity.json)。2026-10-25 用户明确授权提交并推送 GitHub，本轮实现由包含本记录的提交标识，可用 `git log -- docs/ai-village/v011/RESULTS.md` 查询。原有两个未跟踪规划文档和 `output/` 不纳入本轮提交；未修改 Desktop 宿主、日常 DSH_HOME，未发布 npm。

Git 保留源码、候选原画、截图、结果与原生 MP4。超大原始浏览器 WebM 留在本地，完整路径/大小/SHA-256 见 [原始录像清单](browser-raw-recordings.json)；它们不是 Git 检出后自动存在的文件。生成安装包依照仓库约定仍仅留在 `dist/`，不提交到 Git。

| 项目 | 交付 |
| --- | --- |
| 版本 | `0.11.0-preview.1` |
| 包 | `dist/nidofy-dsh-ai-village-0.11.0-preview.1.tgz` |
| SHA-256 | `d610dda53197a7253785c069637bfcfa01978de3d1c7f2597a5b8bc9612e4d18` |
| 大小 / 文件 | 47,064,850 bytes / 381 |
| 与 0.10 包比较 | +38,450 bytes（旧包 47,026,400 bytes）；新候选美术不在包内 |
| 存档 / 协议 | world12 / content9 / bookhouse2 / frame9 |
| 保持不变 | scene3 / rules4 / region1 / preferences3、12 位可选与最多 7 位在场 |

## 新增可玩内容

- **共同回忆册**：手账 → 回忆，按十二居民分别查看十一种可能关系。折叠来源列出真实首次参与者、世界日期和对应纪念物；bonds 的每对次数与故事的全局重玩次数分开。3/8/15 对自动点亮称号，无领取要求、无 66 对清单强制目标。
- **五段初见**：Seedance、GLM、MiniMax、Llama、Mistral 在入住 CAS 确认后开始；每段两处真实走动、独立台词和角色动作。忙碌时保留手动入口。完成事实持久保存，未知回执不追加写入，重开/离场再入住不重复完成。
- **六组配对故事**：饭碗里的书签、两个答案、风把故事吹远了、明天的小计划、谁偷偷改了节奏、温柔的下午茶。固定参与者，三段各自原因、互动和结尾，以回忆奖励，不增加装饰挂点。先通过前两组实际路线与完成保存，再扩展四组。
- **书架里的谜题**：书柜找三页 → 阅读桌排列种子/发芽/开花 → 窗边保存。可错排、重排、取消、重玩；部分牌面可冷恢复，无缺席惩罚，不误发旧共读书签。
- **场景与反馈**：转场增加轻量门框，仍由原区域提交与首帧确认控制；书屋暮色生效，谜题桌面出现三张书页。纪念物个人回忆台词只属于真实首次参与者。

设计和限制见 [故事与迁移](STORIES.md)、[关系事实](RELATIONSHIPS.md)、[基线核对](BASELINE.md)。没有第二套执行器、EntranceCoordinator、存档或经济系统。

## 数据一致性与工程验证

旧 schema11 和 bookhouse1 冻结，旧 1–11 先严格验证后迁移。在途旧共读补 `kind=reading` 与空牌面，新谜题字段默认空；不改旧坐标、路径、RNG、时钟和首次事实。42 次保存后旧指针与快照字节仍保留；21 个 Play 事实与 66 对关系仍在 48 KiB 预算内。回退须保留完整新 profile，并在独立 profile 使用升级前原件与旧包，不能改版本号让旧插件覆盖新存档。

2026-10-24 实际运行：

| 检查 | 结果 |
| --- | --- |
| 改动前官方配置全量 | 57 文件 / 287 测试 PASS，48.66s |
| 最终官方配置全量（2 workers） | 62 文件 / 305 测试 PASS，80.39s |
| 全仓 `node scripts/typecheck.mjs` | PASS |
| `node scripts/ai-village-release.mjs` | PASS |
| 最终打包 | PASS，381 文件 |
| `node scripts/smoke-packed.mjs --exclude-sandbox` | PASS：提取包 Host、browser factory、公开声明与隔离 DSH CLI |
| `node scripts/offline-install-check.mjs --exclude-sandbox` | PASS：空 store、offline、禁 lifecycle、不可达 registry，Koffi/Sharp 运行检查 |
| `node scripts/ai-village-v011-package-audit.mjs` | PASS：全部 lib/assets 包内字节与构建相同，两个 final DPR 运行源/bundle 身份相同 |

离线 pnpm 输出中的 downloaded 是本地 file tgz 导入计数；启用 `--offline` 且 registry 指向 `127.0.0.1:9`。peer 提示不阻断，由宿主提供公开 peers。未测试 Windows Sandbox 无关包。

## 真实运行证据

浏览器最终 [DPR1](browser/final-dpr1-01/result.json) / [DPR2](browser/final-dpr2-01/result.json) 各 15 项检查、74 张 PNG，通过全部五初见、六配对、谜题错排/reset/途中冷恢复、准确来源、三轮跨区、离场再入住不重复初见和界面矩阵；page errors 与外网请求均为 0。实际 select 计算强调色 `rgb(74, 53, 31)`，没有重复补 CSS。

部分最初矩阵图捕获了 CSS 淡入中间帧，且对长 section 调用 scrollIntoView 导致只展示末尾。补充 [DPR1 稳定视觉](browser/visual-dpr1-02/result.json) / [DPR2 稳定视觉](browser/visual-dpr2-02/result.json) 各 7 张图，通过真实 UI 打开同一副本存档、完成有限 CSS 动画并滚至关系标题；没有更改产品主题或伪造世界。实际 320×360、340×720、580×720，浅深与英文，源/bundle 均匹配同一最终包。已目视检查短卡深色、580浅色、故事对白等代表截图；全部截图留作复核，不声明逐图人工签收。

原生见 [Desktop 记录](native/README.md)：`install-01` 官方 UI 安装及包身份核对；`story-03` 初见已有事实、蓝鲸/Claude 配对、书页谜题与来源验证 PASS，11 PNG、148.96 秒 [原生操作录像](native/story-03/native-operations.mp4)。Seedance 两段初见实际完成保存在 `story-02`，该轮后续脚本导航失败，未冒充整轮 PASS。其他四位初见及五组配对的真实游玩覆盖来自上述浏览器矩阵，不能扩展为全部内容均原生验收。

`admission-race-03` 的消息/点击日志确认资源首帧和入口已完成，但 QA 在已选中的居民标签上再次点击，将面板关闭，随后等待“打开”超时。修正 QA 等入口完成后关闭面板，`admission-race-04` 三轮离开/入住/立即导航 PASS。未修改生产入口代码或降低断言。早先工具重连后见到的 75% 进度不能归因于该点击操作；相关失败、错误推论及更正均保留。

每次失败独立保留，包括首次样板末尾点击容量已满控件、补拍脚本遗漏英文 More、原生 CAS 控件等待/quick 页面导航，以及 Computer Use 访问等待超时。修正脚本不删除证据、不重置存档。

## 性能与资源

原生 Windows / DSH Desktop 0.2.1-rc.2 / DPR1.75 / Intel Arc 140T（32.0.101.8243）硬件 GPU，无录屏、无 profiler，完整隔离进程树身份和成员前后核对一致：

| 条件 | 庭院 | 书屋 |
| --- | --- | --- |
| 原生样本 | 20.924s | 20.714s |
| FPS | 25.808 | 25.538 |
| p95 paint | 0.9ms | 1.1ms |
| 纹理数 | 128 | 121 |
| 全进程树 CPU，单逻辑核口径 | 23.293% | 25.266% |
| 压缩资源传输字节 | 26,328,119 | 22,267,955 |
| 估算 RGBA + atmosphere | 66,794,908 bytes | 56,658,708 bytes |
| 当次累计图片 decode | 233.2ms | 178.9ms |

维持原 20–35 FPS、128/121 纹理及 600 paint 样本上限。旧 0.10 硬件短测 26.384/26.319 FPS 是历史对照，样本和名册不同，不能据此宣称优化或回退百分比。CPU 23% 是约 0.23 个核的时间，不是整机 CPU 23%。窗口可见但并非 OS 前台，此结果不是前台专属基准或无泄漏证明。

资源按在场居民选择的既有实现保留。新增有界累计计数表明：区域切换新建 iframe，庭院/书屋都重新解码全部选中图片；浏览器混合名册三轮每次分别传输 30,012,680/25,952,516 bytes，纹理保持 128/121、唯一 iframe。重复拷贝全部选中 ArrayBuffer 和跨区全解码仍是潜在优化点。计数是 frame epoch 内累计，销毁重建后归零，不能把归零当作泄漏修复。未为了未经证明的热点重写缓存。

## 美术与视觉边界

十二人 [固定视觉基线](visual-baseline/README.md) 包含 72 张图、864 个姿态：idle/work/eat/rest × 三种底色 × 96/108/128 CSS px × DPR1/2。201 张生产 PNG 共 37,456,809 bytes，逐图哈希/透明边缘/脚点记录可复查。代表图已目视检查，不能称全部 72 张人工签收。Grok 原有 rest-pose 右侧残片与 Llama/GPT 浅底服装对比度问题已记录，原批准素材未擅自修改。

书屋 [分层美术记录](ART.md) 交付 10 张由 image_gen 生成的独立主图及真实透明前后层、道具、原始提示词/哈希、交互合成预览。32 张生产 PaperDoll 对照包含 24 张实际姿态与 8 张明确标注的坐姿提案。背景取样框注册到 y220，冻结家具几何不变。母图共 15,885,839 bytes，解码约 59.99 MiB，尚未优化为发行纹理。

**第二阶段尚未完整收口**：书柜握书贴合、窗座正式坐姿和书本接触仍需改进，不能仅让用户批准这些缺陷后就启用。精修后还须运行资源尺寸优化、真实正式场景全矩阵/七人性能及用户视觉签收。当前候选不进入资源 manifest，不改 `approvedForRelease`；运行书屋保持 Development preview。测试通过不能代替美术签收。

## 未覆盖

物理 OS 睡眠/唤醒本轮未执行。真实最小化未执行：Computer Use 在取得隔离窗口状态前返回 `Computer Use app approval timed out`，未发送最小化输入；`minimize-01` 因等不到 hidden 超时，不能归为产品最小化失败或通过。renderer freeze、隐藏、暂停和冷恢复不能替代这两项。旧 0.10 候选已有 60 个有效分钟 soak，此轮不将旧记录算作新包 60 分钟通过。

原生 `cold-restored-01` PASS：终止整个隔离进程树后，以相同 profile 重启，完整世界与 checkpoint05 逐字段相同，庭院七人、tick14807、暂停状态和全部新事实保持；3 秒/92 帧录像保存。最终 [清理记录](native/cleanup-final.json) 确认测试 carrier 与 18772 监听均无残留，profile、checkpoint 与全部证据保留。

后续优先完成上述美术适配，再进行正式资源/原生 DPI 与真实最小化、物理睡眠验收；本轮功能候选已可审阅，但不声明整个七阶段全部签收。
