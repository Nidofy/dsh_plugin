# DSH 0.2.1-rc.3 A1–A6 兼容验收记录

2026-10-26；**A1–A6兼容门禁已通过，按用户要求在进入B前安全暂停。B未启动。** 用户从前一阻塞检查点恢复后，已补齐独立rc.3 QA候选的真实三插件共存及有效角色拖放。恢复前后Village包、129份游戏源码和306份运行文件身份不变，见 [恢复核对](0.13.0-preview.5/resume-identity.json)；最终冻结身份见 [A6检查点](0.13.0-preview.5/checkpoint-a6.json)。

## 固定来源与工作边界

- 初始 HEAD：`ead9a0fb97631bf651421ebac9e1e6ab78012950`，分支 `codex/feature-ai-village-entrance`。
- 当前候选 AI Village：`0.13.0-preview.5`，仅面向 rc.3。world14/content10/region2/frame11 不变；游戏 `src/` 与初始 HEAD 无差异。
- 官方源码：`dsh-v0.2.1-rc.3` / `1f81c047fc48fa190a683e469daa699857e9afe8`。归档 SHA256：`fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。
- 官方 Desktop：0.2.1-rc.3；官方安装器 SHA256 `1e3876baaa20c3f26371dba7b6873bb70c3ef9b91403f6d3f87d2b27d4fd1e3a`，289415960 B。其内嵌 `dshBuildCommit=be72761ee1a6736ebcdf4f3739363b083ae53c98`、dirty=false，与开源 tag 的提交不同，不能合并身份。app.asar SHA256 `04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0`。
- 仅使用仓库 `.build` 内新建 profile。原字节官方 Desktop 解包副本因仓库 ACL 的 Electron 安全检查拒绝，复制到系统 Temp 独立 QA 目录运行；未修改 ACL、未禁用 sandbox、不运行系统安装器、不访问日常 DSH_HOME、不调用模型或上传工程。
- 初始未跟踪规划文件和 `output/` 保留。

## 已落实的适配工作

1. [实际源码差异](DSH_0.2.1_RC3_DIFF.md)：核对完整提交及相关目录，不能仅凭发行说明断言兼容。
2. 新建 `tools/compatibility/ai-village-rc3.json`、独立 npm manifest/lock、运行依赖和源码准备通道。
3. AI Village 构建/测试/浏览器鉴权 Host 可选择 rc.3，禁止将 rc.2 构建标记为 rc.3 包。全仓 `compatibility.json`、原 runtime/lock、其他插件版本不变。
4. 打包和离线依赖说明从每包的 `engines.dsh` 获取版本，避免混合基线时误写身份。
5. 新增空缓存离线官方包管理服务安装、rc.2 冻结包到 rc.3 存档恢复、独立 Desktop 测试通道。脚本存在不代表验收已经通过。
6. pre5 修正构建身份验证：包内源码集合及 hash、嵌入 durable-file/atomic-write 输入、实际安装 runtime 锁与版本均核对；Host 构建关闭源码路径调试注释，消除随机解压目录对包哈希的影响。pre4 包和证据保留。

## 本次恢复与变更归属

用户最新要求仅完成 A6 及之前的工作。恢复审计补充核对了 Git 的 workspace/settings 消费接口，并发现 A5 真实角色拖放尚缺浏览器证据，详见 [恢复审计](RC3_A6_RESUME_AUDIT.md)。本轮将原生共存和拖放分别闭环，不增加游戏内容。

| 文件范围 | 作用 |
| --- | --- |
| `tools/compatibility/ai-village-rc3.json`、`tools/official-runtime-rc3`、`tools/official-source-ui-rc3` | 独立固定 rc.3 官方来源、运行时和源码 UI 依赖 |
| `scripts/ai-village-compatibility.mjs`、`prepare-*-rc3.mjs`、`ai-village-phase4*.mjs`、`ai-village-release.mjs` | 通道选择、身份校验、严格构建与浏览器 Host |
| `scripts/pack.mjs`、`offline-dependencies.mjs`、`offline-install-check.mjs` | 按每包 manifest 标识宿主版本，保留混合基线 |
| `packages/ai-village/package.json`、README、THIRD-PARTY-NOTICES | pre5 精确 rc.3 声明及来源说明；游戏源码不变 |
| `packages/ai-village/tests/host.spec.ts`、`roster-expansion.spec.ts`、`rc3-header.client.spec.tsx`、`scripts/ai-village-rc3.vitest.mjs` | 正确选择构建输出、同等严格资源字节比较、真实 rc.3 Header/More 回归 |
| `scripts/ai-village-rc3-package-check.mjs`、`ai-village-rc3-save-upgrade.mjs` | 空缓存离线安装、最终产物身份与真实旧包存档升级 |
| `scripts/ai-village-rc3-desktop-launch.ps1`、`ai-village-rc3-native*.mjs` | 固定官方 Desktop、隔离 profile、原生菜单/生命周期/共存/拖放证据 |
| `scripts/rc3-coexistence-*.mjs` | 从源码建立两个独立本地 QA 包并单独验证；正式 Git/Live2D rc.2 文件不变 |
| 本目录与 `community-next/tea-square/browser/rc3-pre*` | 本轮结果、身份和真实截图；旧失败和用户文件保留 |

## 门禁状态

| 门禁 | 当前状态 |
| --- | --- |
| 官方来源与差异 | 已核实，见差异报告 |
| 严格类型、完整回归 | PASS；pre5 77文件 / 415测试，93.37秒，零失败/跳过；[摘要](0.13.0-preview.5/tests.json) |
| 最终候选构建与 SHA256 | PASS；两次独立源码解压、严格构建、打包得到同一SHA；[复现证据](0.13.0-preview.5/reproducibility.json) |
| 空缓存离线安装 | PASS；实际rc.3 runProfilePnpm、空store、禁联网registry、禁安装脚本、Koffi原生加载；[包身份](0.13.0-preview.5/package-identity.json) |
| rc.2 包实际写入存档 → rc.3 恢复 | PASS；固定pre3 Host写入、新Host读取/继续CAS，原指针/快照及profile身份保持；[证据](0.13.0-preview.5/save-upgrade.json) |
| 三场景、七人、故障注入、中英文、DPR1/2 | PASS；最终pre5两轮各32检查、30PNG、19旅行，零页面错误/外网，129源码、3bundle、306运行文件与最终包一致；[报告](RC3_PRE5_BROWSER_FULLPLAY.md) |
| 官方 rc.3 Desktop 安装/启停/恢复/UI | PASS；306文件匹配、pre4→pre5升级、独立进程冷恢复、已有会话More/中文草稿、左右More、Sidebar、七人三区、输入框避让、IME事件/Escape/焦点、3轮启停、卸载保留存档；[原生汇总](0.13.0-preview.5/native/native-summary.json) |
| A5 真实角色拖放补测 | PASS；以 `drag-pre5-06` 为唯一关闭证据，实际DPR1.75、1279×821 CSS视口；鼠标移动210.39 CSS px，生产gesture为actor/moved，Qwen从(287.741,421.859)到(65.000,425.007)，实际位移222.76世界像素；r144同operationId回读确认。非法落点也实际拖动320.63 CSS px并返回原位置；七人/长期记忆/单owner/草稿及磁盘哈希保持。`drag-pre5-05`原runner虽写PASS，但仅移动2.14 CSS px且角色未动，明确拒绝采纳；01–05历史保留，不扩称双DPR拖放 |
| 原生 Git / Live2D / Village 共存 | PASS；`coexistence-qa03-01` 正常安装两个独立 rc.3 QA 候选并核对全部21/35文件；三个唯一入口/More/会话草稿、真实临时Git status/diff、上下布局、Live2D animated、双向互斥、Sidebar释放/恢复、Git关闭重开均通过。原 rc.2 包拒绝记录保留，未绕过 engine；[QA构建范围](coexistence-qa/RESULTS.md) |
| 本轮原生收束 | PASS；Git展开/收起释放并恢复真实首帧、三个插件分别停用/重启用、三包冷恢复、有效拖放后的独立进程冷恢复及三包卸载通过；最终三个Host路由404、注册撤销、r147世界原样保留。17组新记录中12组采纳PASS、4组失败、1组假阳性明确排除；[新原生汇总](0.13.0-preview.5/native/coexistence-summary.json) |
| A6 兼容检查点 | **PASS；仅AI Village pre5正式标记为rc.3兼容，冻结并暂停在B之前** |
| B1–B4 新内容 | **未实现、未启动；恢复须用户另行指示** |

## 固定交付与证据边界

本次共存只使用从源码独立重建的 `@nidofy/dsh-source-control@0.1.3-rc3-coexistence.qa.1`（SHA `20fb56cc9fae57dc3c5bef696f3ff30a61150045f0a842bf0c31326b46298e66`）和 `@nidofy/dsh-live2d@0.1.2-rc3-coexistence.qa.1`（SHA `5239666fb905a31b4148abaac3dd92376830c173de3b1b203920747b1336cd63`）。两包四组严格类型及构建通过，14文件36测试通过，2项Hg因未安装跳过。它们是本地组合QA候选，不是正式Git/Hg或Live2D rc.3发行；原rc.2 manifest、源码、lib、包和清单逐hash保持不变。额外UI primitives依赖在独立锁中补齐，没有改变冻结Village runtime。

实际Git差异展开时面板增高，小院剩余空间不足会显示暂停说明；这符合既有空间保护，不宣称此时游戏画布仍在运行。Live2D验证的是 `animated` 能力且静态回退隐藏，不能仅以iframe容器存在代替模型加载。主线程另目视真实拖放、Git+Live2D、Git展开与小院空间保护截图。

候选包 `dist/nidofy-dsh-ai-village-0.13.0-preview.5.tgz`：53,670,374 B，398文件；SHA256：

`c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760`

这个固定pre5包已通过A6，兼容范围为上述官方rc.3来源与实测范围。包内README保留构建时的候选说明，签收绑定本报告与该SHA，不重打已验收包。未发布npm/推送/覆盖main，未批准新美术。地图、书屋、茶会与角色资源沿用此前批准身份。没有新增剧情、交互或收藏；这些属于尚未启动的B阶段。

原生测试使用真实官方Session/JSONL API构造的纯本地非空会话夹具，无AgentLoop/模型调用。原生完整剧情重玩没有执行，完整玩法由同包浏览器鉴权夹具验证；二者证据不混称。实体输入法候选框、物理睡眠/最小化、长期硬件性能未覆盖。隐藏原生截图偶发超时标为NOT_CAPTURED，不能计作截图通过；实际行为断言独立记录。英文200%导航换行/时间省略为与pre3一致的既有表现。

首轮源码UI缺依赖、资源字节深比较超时、QA选择器/前置条件错误、旧carrier ACL拒绝、截图中断及不完整下载均保留原记录。最终回归补齐独立source-ui依赖，并将资源比较改为同等严格的Buffer.equals，没有放宽内容断言。旧QA profile源逐文件哈希复查保持不变。

## 安全暂停与历史

本轮通过官方管理器卸载两个QA候选及Village，三个Host路由均404、Launcher/overlay撤销，最终r147世界原样保留。新原生汇总与清理见 [coexistence-summary.json](0.13.0-preview.5/native/coexistence-summary.json)、[cleanup-resume.json](0.13.0-preview.5/native/cleanup-resume.json)。Git测试自有hook进程的精确清理另见 [QA清理](coexistence-qa/qa02-cleanup.json)。旧原生/浏览器清理记录仍保留。

新冻结目录为 `.build/ai-village-rc3-pre5-a6-complete-20261026`，绑定最终未提交工作树文件hash、补丁、源码、证据与三个包。工作树未提交，HEAD仍为上列初始HEAD；不能用该HEAD单独冒充本轮适配源码。详细续接见 [HANDOFF](HANDOFF.md)。

此前官方拒绝原样Source Control 0.1.3的rc.2 engine，随后未继续安装Live2D，这一事实仍成立；旧暂停检查点 [checkpoint.json](0.13.0-preview.5/checkpoint.json) 与 `.build/ai-village-rc3-pre5-paused-20261026` 原件保留。本轮通过独立源码重建QA候选完成组合，未改变旧包声明或绕过门禁。

## rc.2 保留方式

根 `compatibility.json`、`tools/official-runtime`、`.build/sandbox-enhanced` 继续固定 rc.2。原 `0.13.0-preview.3` 包 SHA256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`、冻结快照、community-next 文档和 QA 原件均保留。可从初始 HEAD 重建历史实现；新候选不声称双版本兼容，也不将其他插件标记为 rc.3 已验收。

## 直接续接

A阶段已完成，当前停止开发。只有用户另行明确要求时才进入B；不得自动恢复原先的连续开发要求或创建后台任务。复验必须使用新label，保留当前包、候选、profile、失败记录及检查点；命令与证据路径见HANDOFF。
