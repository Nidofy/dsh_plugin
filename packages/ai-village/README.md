# AI 小院 · 0.6.2 · UI-v1

七位居民共享一方离线小院。0.6「我的小院」增加家具锚点编辑、真实布局预览与撤销、可选配饰和两套环境主题，延续邻里互动、手账与照片相册。

## 开始游玩

1. 在 DSH Plugins → Add plugin 中选择本地 `dist/nidofy-dsh-ai-village-0.6.2.tgz`，安装启用后完整重启 DSH。验证基线为官方 DSH 0.2.1-rc.2、Windows x64，运行依赖离线内嵌。
2. 点击右上角 **⌂**。“居民”中选择伙伴，打招呼、舒展、记灵感、整理书桌、读书、浇水、听风或看天空。七人各有 12 条情境台词及微动作。
3. “心愿”提供首次同桌和另外五条不限时心愿。邀请两位居民喝茶／吃饭，或在长椅聊天、分享书页、交流花草、交换点子、安静陪伴。双方真实到齐后才开始；共同经历累积为初次相聚、一起活动、熟悉，不因离线下降。
4. “布置”提供午后小院、阅读角落、花草角落三个预置布局。六类目录是书桌、餐桌、坐垫、长椅、书架、盆栽；每个布局同时使用四类家具、六个活动位。阅读角落支持读书／分享书页，花草角落支持照料／交流花草。
5. 首次同桌发现风铃，分享书页发现纸灯笼，照料盆栽发现花叶挂饰。三个装饰均可选择挂点或收起，预览可取消，保存成功后才生效。布局更换会释放被替换家具上的普通活动；剧情中需先结束或取消活动。
6. “手账”最多记录 12 类首次回忆。重玩保留首次参与者和日期，只累计次数；不刷货币、不重复发装饰。界面支持中英文、主题、减少动态与气泡设置。
7. HUD「拍照」（窄窗位于「更多」）进入拍照：暂停世界、隐藏场景气泡和选择标记，支持 1–1.5 倍有限取景、重置、日期和边框。拍摄后预览真实 720×960 PNG，可直接导出或保存到本地相册；退出只移除拍照暂停原因。

8. “布置 → 家具 → 开始布置”进入暂停预览。书桌、餐桌、长椅、生活角落各有两个锚点；三个布局模板可继续调整。家具的绘制、活动位、障碍和点击区域一起移动。选择暖阳午后／暮色灯火环境，给当前居民选择布艺结／叶形胸针／不佩戴；七人的配饰分别记住。支持撤销最近 20 步、Escape 或按钮取消、明确确认保存。
9. 侧栏或宿主面板暂时隐藏会保留同进程布置草稿，回来重新校验。家具足迹压住居民时拒绝该草稿，请先取消并挪开居民。普通活动在几何确认后释放，剧情中不能开始编辑；取消、确认放弃后关闭和断连丢弃草稿；布置时普通页面入口隐藏，不影响已保存进度或用户暂停。环境主题独立于界面明暗，照片包含实际家具位置、环境和配饰。

相册最多 20 张、总计 40 MiB，单张 PNG 不超过 4 MiB。相册在手账页，可导出和确认删除。删除照片不删除剧情或解锁；上一成功相册修订引用的文件会暂时保留，后续写入清理无引用文件。照片不发送到主聊天或网络，不在世界 JSON 中保存图像。

座位或路线被占用时会明确拒绝邀请，可先挪开居民。主要事件至多一个，抵达期限 36 秒模拟时间；拖动暂挂，取消或无效落点继续，有效离席取消。活动间有短暂冷却，避免连点刷屏。没有强制照顾、每日清零或离线推进。

0.6.1 补齐草稿隐藏恢复、输入法 Escape 保护、抬起确认轻点、编辑焦点返回和 SVG 图标。正文 14px、辅助文字至少 12px，小院操作按钮至少 40px。展开范围避开完整聊天输入卡片，空间不足时显示暂停提示。

关闭、隐藏、sidebar、断连和空间不足时暂停；聊天切换不创建新世界。↗／↙ 切换布局，Esc 先处理当前拖动或编辑草稿。主聊天输入和草稿独立保留。

0.6.2 按 UI-v1 冻结规范实现：同一全视口小院、四入口覆盖抽屉、900px 右侧面板、有限观察镜头、已确认事实消息、家具锚点拖动与规范 720×960 拍照。设置位于 HUD 的系统动作中。软件渲染时自动使用实色面板以降低开销，不改用户偏好。

显示偏好从 schema1 窄迁移到 schema2，保留主题、语言、动态和气泡，新增减少透明与消息已读状态。旧原件由现有 SaveStore 保护。0.6.1 无法读取 schema2 偏好，回退必须使用升级前备份与原安装包，不能直接覆盖新偏好。世界仍 schema6。

本轮结果及人工未测项见 [UI-v1 验收](../../docs/ai-village/ui-v1/RESULTS.md)。一小时真实运行验收继续暂缓，短时自动化不替代现场验收。

## 存档和资源

正式世界使用 schema 6、scene 3、规则 3、内容 3；布局属于有界目录，frame protocol 3 对资源、照片、镜头和布置意图共同校验 source/origin/token/序列/viewport。历史 schema 1/2/3/4/5 按对应旧定义读取，迁移时保留已有茶会、首篇手账和风铃；首次新格式保存保护升级前指针和原始字节。旧插件不能读取 schema 6，请勿直接降级覆盖新档。

世界仍在 `<profile.dir>/nidofy-ai-village/`，显示设置在 `preferences/nidofy-ai-village/`；相册在 `album/`，独立有界索引在其 `nidofy-ai-village/` 下。邀请、完成、心愿、关系、奖励和布局经同一世界 CAS 提交。结果不确定时只读核对，不自动重放写入；坏档保留原件，不自动重置。卸载不删除数据。

Host 按请求校验并读取固定白名单资源；客户端与 frame 按在场居民加载、释放图像，入场前完成准备。单蓝鲸 32 张纹理、其他单人 23 张、七人 128 张；两个未使用的整件家具贴图不进入运行纹理。新增家具、茶杯、书本、水壶和装饰使用代码矢量图形，复用批准的角色资产。无需 API key 或联网模型，无音频、自由网格装修或多场景入口。

## 构建和验收

```powershell
node scripts/ai-village-phase4.mjs check
node scripts/ai-village-v061-browser.mjs
node scripts/ai-village-v06-browser.mjs
node scripts/ai-village-v06-neighborhood-browser.mjs
node scripts/ai-village-v06-performance.mjs
npm run typecheck
npm run village:build
node scripts/pack.mjs --only=ai-village
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
```

本地鉴权预览仍使用 `node scripts/ai-village-phase4.mjs serve`，端口 18754；入口 token 保存在忽略的 `.build/ai-village-phase4/preview-entry.json`，不要提交或转发。0.6 Desktop 脚本只使用专用 `.build/ai-village-v0.6-desktop` 与本机 CDP 18759，不指向日常 DSH_HOME。

- [剩余工作核对与 0.6.1 验收](../../docs/ai-village/REMAINING_WORK_AUDIT_2026-10-22.md)
- [0.6 实施计划](../../docs/ai-village/V06_IMPLEMENTATION_PLAN_2026-10-22.md)
- [0.6 验收记录](../../docs/ai-village/V0_6_RESULTS_2026-10-22.md)
- [0.5 范围与实施顺序](../../docs/ai-village/V05_IMPLEMENTATION_PLAN_2026-10-22.md)
- [0.5 实施与验收记录](../../docs/ai-village/V0_5_RESULTS_2026-10-22.md)
- [0.4 历史交付](../../docs/ai-village/V0_4_RESULTS_2026-10-22.md)、[综合实施计划](../../docs/ai-village/CONTENT_UI_IMPLEMENTATION_PLAN_2026-10-21.md)

Git/Hg 与小院上下共存，Live2D 与小院互斥。以下阶段 1–3 以及旧 M0/M1 样板仅保留历史用途，其版本、坐标和限制不代表 0.6。

## 阶段 3：可玩小院

在仓库根目录运行，开发依赖与固定官方源码准备见下文：

```powershell
node scripts/ai-village-scene-assets.mjs
node scripts/ai-village-phase3.mjs check
node scripts/ai-village-phase3.mjs serve
```

打开 <http://127.0.0.1:18748>。`serve` 会先检查类型并构建；仅监听本机，Ctrl+C 退出。拖到左侧书桌写字、右侧餐桌吃饭、右下坐垫休息；拖回普通地面后恢复漫步。Esc 取消拖动。收起或隐藏会停下世界时间，用户暂停偏好会保存。

- [场景截图](art/QA/phase3/work-dpr1.png)、[坐姿](art/QA/phase3/rest-scene-dpr2.png)、[实际操作录屏](art/QA/phase3/scene-demo.webm)
- [验证摘要](art/QA/phase3/validation.json)、[阶段 3 实施与限制](../../docs/ai-village/PHASE3_RESULTS.md)
- [家具/手型/坐姿生成提示词](art/prompts/phase3.json)、[资源及哈希](assets/scenes/courtyard/manifest.json)、[场景配置](assets/scenes/courtyard/scene.json)

开发存档固定放在仓库 `.build/ai-village-phase3/profile/nidofy-ai-village/`，不会改实际 DSH_HOME。存档异常会暂停并保留原文件；“开发与恢复”中的按钮可显式恢复上一成功版。第二个窗口会显示占用，关闭原窗口后可重新打开；非正常退出最多等待 15 秒租约过期。

`check` 使用独立临时 profile，验证纯逻辑、磁盘保存、跨进程互斥、真实 Chromium 交互、打包与解包 smoke。`.build/ai-village-phase3/phase3-preview.tgz` 是开发预览归档，需要 Node 24、仓库运行环境与外部 Koffi；不作为可安装插件发布。DSH 浮卡、真实 Host 认证和正式安装属于 P4/P5。

## 阶段 2：动作室

```powershell
node scripts/ai-village-parts.mjs
node scripts/ai-village-phase2.mjs check
node scripts/ai-village-phase2.mjs serve
```

在仓库根目录运行，先满足下面阶段 1 的开发依赖条件。动作室地址为 `http://127.0.0.1:18747`，仅监听本机。`check` 复用阶段 1 生成的许可证清单，所以首次使用先运行一次 `ai-village-phase1.mjs check`。

- [中文预览](art/QA/phase2/studio-zh.png) / [English](art/QA/phase2/studio-en.png)
- [实际播放录屏](art/QA/phase2/motion-preview.webm)、[动作与表情](art/QA/phase2/motion-contact-sheet.png)、[20 张透明部件](art/QA/phase2/parts-contact-sheet.png)
- [角色定义](assets/characters/bluewhale/character.json)、[动作关键帧](assets/characters/bluewhale/animations.json)、[部件清单](assets/characters/bluewhale/manifest.json)
- [图集生成提示词](art/prompts/phase2.json)、[呆毛补绘提示词](art/prompts/phase2-ahoge.json)、[验证摘要](art/QA/phase2/validation.json)
- [制作、修正及边界记录](../../docs/ai-village/PHASE2_RESULTS.md)

动作室支持 idle/walk/pickup/dragging/put_down、四种表情、时间轴、96/128/320px、三种背景和中英文。动作室中的 walk 原地播放；实际移动和家具互动请使用阶段 3 场景。阶段 2 动作资产已有独立用户批准。

## 阶段 1：已批准基准

- [中文总览](art/QA/phase1-overview.png) / [English overview](art/QA/phase1-overview-en.png)
- [角色原图](art/candidates/bluewhale-neutral-v01.png)：1254 × 1254，真实透明 PNG。
- [场景原图](art/candidates/courtyard-empty-v01.png)：1086 × 1448，3:4。
- [透明与尺寸对照](art/QA/alpha-and-sizes.png)：白、灰、深色底；96/128 CSS px。
- [资源清单与哈希](art/candidates/manifest.json)、[完整生成提示词](art/prompts/phase1.json)。

两张基准由内置 image_gen 生成，逐字节复制到仓库，未放大或修改像素。角色参考原交接包的蓝鲸 Q 版形象，旧 Live2D 仅作为参考。`art/approved/` 保存获批副本与确认记录。

## 复现

在仓库根目录执行，要求 Node 24+，且已按照根 README 运行 setup：

```powershell
npm ci --prefix packages/ai-village --ignore-scripts --legacy-peer-deps --no-audit --no-fund
node scripts/ai-village-phase1.mjs check
node scripts/ai-village-phase1.mjs serve
```

预览服务仅监听 `http://127.0.0.1:18746`，Ctrl+C 退出。页面支持中文/English。`serve` 使用上一次 `check` 的构建结果，不自动重新构建。

验证还需要现有的固定官方源码 `.build/sandbox-enhanced/official` 及其 `baseline.json`，revision 为 `687f282e8625c6b8d11ff58211a90524be2e4317`。新环境先按 `scripts/sandbox-enhanced.mjs prepare` 的约定指定 `DSH_SANDBOX_ARCHIVE`，运行 `npm run sandbox:prepare`；源码归档 SHA-256 必须为 `157903b22c2881d3678d846755afe957a48df834e747deda805a1195ce25a146`。阶段 1 仅复用这个已核验源码目录，不运行沙箱插件。

浏览器验证复用 `.local/environment.json` 所指源码依赖中的 Playwright 1.61 和本机已缓存的 Chromium headless shell。脚本不下载浏览器。Windows 存档试验使用仓库已有 durable-file 工具及其 Koffi 依赖。

## 代码和证据

| 文件 | 内容 |
| --- | --- |
| `experiments/frame.ts` | PixiJS 8.22.0 离线 WebGL 静态渲染，单次绘制后停止 ticker |
| `experiments/storage.ts` | profile 目录解析、跨进程 owner 锁、CAS、同步原子文件发布和前一版保留试验 |
| `experiments/storage-check.ts` | 临时 profile 测试；独立子进程抢锁和重新读取存档 |
| `art/QA/validation.json` | 最近一次通过的类型、浏览器、存档和打包验证摘要 |

构建、临时 profile 和完整结果均位于被忽略的 `.build/ai-village-phase1/`。其中 `phase1-preview.tgz` 仅包含预览网页、图片、renderer 和依赖许可证，不能安装进 DSH。预览需通过提供 `/frame` 等固定路由的本地 HTTP 服务访问，不能直接双击 HTML。

目前已验证离线 bundle、严格 CSP、不透明 iframe 隔离、DPR 1/2、profile 隔离、跨进程互斥、修订冲突、坏档保留和前一版存档。未验证真实 Desktop 安装、硬件 GPU 性能、断电恢复、客户端租约/epoch、完整存档迁移或 Host 认证路由。

更详细的结论、视觉待修项及下一阶段边界见 [阶段 1 记录](../../docs/ai-village/PHASE1_RESULTS.md)。

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
