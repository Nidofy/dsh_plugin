# 0.7–0.9 独立 QA 基线与执行边界

2026-10-23（Asia/Shanghai）。本文件记录开始实施时的只读审计；历史 PASS 不计作本轮新版通过。后续实际运行及最终 0.7.0-preview.1 证据见 [RESULTS.md](RESULTS.md)，本文件的起始版本和“当时未运行”状态不回写成最终状态。

## 实际代码身份

| 项目 | 只读结果 |
| --- | --- |
| 工作目录 | `D:\Documents\FeiyangChen\devApps\dsh_plugin` |
| 分支 | `codex/feature-ai-village-entrance` |
| 起始 HEAD | `963a501947b74498d0924a1c6892aecd3ef116bc` |
| 起始 tracked 改动 | 无 |
| 插件 | `@nidofy/dsh-ai-village@0.6.4` |
| 官方 DSH | `0.2.1-rc.2`，源码 `687f282e8625c6b8d11ff58211a90524be2e4317` |
| 世界 | `HomeWorld` schema 6 / scene 3 / rules 3 / content 3；`world.ts` 内 schema 3 是历史/基础模型，不是正式保存版本 |
| 显示偏好 / frame | schema 3 / protocol 4 |
| 入口 | ART_REVIEW 候选；正式选择器只接收 APPROVED；发行使用静态入口 |

本机忽略目录 `dist/nidofy-dsh-ai-village-0.6.4.tgz` 实测 **29,358,474 bytes / SHA-256 `8ea3229a4034b1f03f56494119b633e92650d1887d579a8b7c41bb3d024104db`**，与当前 `dist/manifest.json` 一致。它不是历史 DELIVERY_INDEX 中的 32,114,727 bytes / `083799...` 集成候选；源码 HEAD 与磁盘旧包不能混为同一产物。

起始仅有两份用户未跟踪文档，必须保留：

| 文件 | SHA-256 |
| --- | --- |
| `docs/ai-village/NEXT_FEATURES_2026-10-21.md` | `96a5d3e87dcdd00989195f5f6c634ce602f962a891a1c3a655e84cee26de6dd8` |
| `docs/ai-village/UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md` | `127e7704dffa665a452bbfd4f7df4a79ef27e96561a6490dea0935b553f8d9ec` |

## 实际运行条件

Node `24.16.0`；项目工具声明 TypeScript `6.0.3`、tsdown `0.22.2`、tsx `4.22.4`、Vitest `4.1.8`、pnpm `11.7.0`。小院 Pixi `8.22.0`、Koffi `3.1.1`、Cordis peer `4.0.5`，React/ReactDOM 宿主 peer `^18.2.0`。

`.local/environment.json` 的工具提供方为 `dshWinUi/electron`（toolchainDshVersion `0.2.0-rc.2`）；实际官方 runtime 位于本仓库 `.build/official-runtime`，固定官方源码位于 `.build/sandbox-enhanced/official`。不能把构建工具提供方误称为正式兼容宿主。已有 Playwright 1.61 系列及本机 `chromium_headless_shell-1228`、ffmpeg 可用，无需下载浏览器、SDK 或安装插件。

## 已实现能力与历史证据

已经完整读取 AGENTS、README、architecture、插件 README、0.4/0.5/0.6 实施验收、0.6.1 剩余工作审计、UI-v1 和 UI-v1.1 RESULTS、UI-v1.1 ACCEPTANCE、Entrance-v1 RESULTS、入口集成 README/DELIVERY_INDEX、独立 QA LATEST_EVALUATION/QA_REPORT。

- 0.4：双人茶会实际寻路/到齐/完成；首次手账和风铃同一 CAS；旧格式原字节保护；未知 ACK 只读核对。
- 0.5：七人各 12 条双语台词/微动作，8 单人和 6 双人活动、6 心愿、12 类首次手账、共同经历；3 布局/6 家具类/3 装饰；真实 720×960 照片和有界相册。
- 0.6：四组家具各两锚点，48 合法组合，20 步草稿撤销；环境/配饰/实际几何和照片一致，世界 schema 6；历史证据有旧档 Desktop 升级和精确冷恢复。
- 0.6.1：隐藏保留装修草稿、IME Escape 合成保护、pointerup 选择、焦点返回、composer 避让。历史最终 103 专项测试，50 次侧栏/50 次展开；一小时真实运行明确暂缓。
- 0.6.2/0.6.3：四入口 UI-v1.1、摘要/详情导航、文字缩放、主题和实色回退、租约心跳只读恢复。原始现场暂停根因仍 NOT CONFIRMED。UI-v1.1 133 单测及隔离组件浏览器证据不等同真实 GPU/人工签收。
- 0.6.4：protocol4 首帧 ACK 与 boot/assets/view 身份匹配后揭幕；跳过不绕过加载；入口不改 world/camera/userPaused。集成记录有 159 单测、13 生产场景、200 生命周期循环、720×960 跨尺寸照片相等及相册 413 检查。

独立入口 QA 必须保留提交区别：B 最后独立测试 `123d169`（生产树与 `4d9cd1a` 相同）仍有 DQ-SEAM-01 P2 中缝；A 后续 `ea8708d` 增加门扇重叠后用原断言得到 0 漏光。A 复测不能改写成 B 独立签收。人工美术没有批准，生产门禁保持。

起始缺少的是可持久连续多阶段故事、与实际世界结合的三种小游戏、行为偏好驱动的新自主生活及新可见收藏；既有 12 手账/照片/布局不能重做并当新增内容。

## 脚本副作用审计与门禁建议

| 命令 | 副作用及处理 |
| --- | --- |
| `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs` | 调用本机 Vitest；专项测试使用临时数据。主代理负责运行与原始日志。 |
| `node scripts/typecheck.mjs` | 不是纯只读：准备 `.local/original.json`、调用小院资源生成器及声明生成，后续含其他插件类型检查。现有官方基线已准备，不需联网安装。 |
| `node scripts/ai-village-release.mjs` | 生成资源清单，构建 `.build/ai-village-phase4`，删除/替换本包匹配的 lib 产物，复制 notices/LICENSE；由主代理串行执行。 |
| `node scripts/ai-village-phase4.mjs check` | 构建、测试、浏览器和候选 smoke；默认浏览器证据可能覆盖历史目录。本轮不直接作为独立 QA 入口。 |
| UI-v1.1 interaction/recovery 脚本 | 支持 `VILLAGE_QA_DIR` 重定向证据，但仍重建共享 phase4 fixture。不要与 release 或独立构建并发。 |
| `node scripts/pack.mjs --only=ai-village` | 本机 npm pack，ignore-scripts；写 dist 小院包/manifest，保留其他归档。相同版本重包会替换该版本 tgz，应先保留旧包身份。 |
| `node scripts/smoke-packed.mjs --exclude-sandbox` | 解包到 `.build/installed-*`，临时 profile；CLI 明确设置独立 DSH_HOME；只清理自己生成的 tmpdir；写 `dist/profile-smoke.txt`。 |
| `node scripts/offline-install-check.mjs --exclude-sandbox` | 新建空 store，offline/ignore-scripts/不可达 registry；写 `dist/offline-validation.json`；验证全部非 Sandbox 归档，不访问日常 profile。 |

独立浏览器入口为 `node scripts/ai-village-living-qa.mjs <run-label>`，只在主代理最终构建就绪后运行；每次必须使用新 label，已有证据目录将被拒绝，避免覆盖历史。使用已存在正式 lib、独立 fixture 输出与独立 `profile`，生产 UI 执行操作；网络仅允许该夹具 localhost。截图/录像在此目录对应 run-label，忽略的临时 profile/token 不复制到证据。

性能保留真实窗口尺寸、七人、20 秒样本、CPU/heap/DOM、texture 和 p95 JS 提交；不以软件提交耗时冒充 GPU。通过需要实际断言，不以 exit 0 代替内部失败状态。后续新增玩法交互断言在 UI 定型后补齐，未运行前一律 NOT RUN。

## 仍未完成的验收

本基线形成时，新版自动化尚未运行；现已执行的范围见 [RESULTS.md](RESULTS.md)。真实 Windows GPU、100/125/150/200% 系统 DPI/多屏、真实中文 IME/宿主审批组合、睡眠唤醒、低内存、独占硬件性能、模型并行负载与人工美术仍不能从软件证据推断通过。不为测试擅自休眠电脑或发起模型请求。一小时真实运行保持 DEFERRED，只有用户明确恢复该项后才执行。
