# AI 小院 · 0.2.1

七位 Q 版伙伴：DeepSeek、Claude、Gemini、GPT、Grok、Kimi、千问。沿用已批准的 DeepSeek 画风，每位都有四种表情、待机、行走、抓起、拖动、放下，以及书桌工作、餐桌吃饭、坐垫休息。展开“在场伙伴”可逐个选择或全员入住，支持同场 1–7 位角色独立活动。单人时下拉框更换角色，多人时选择在场角色；选择不会重置各自位置与动作进度。拖动任一角色时其他伙伴继续活动，家具位置一次供一人使用。

已进入全仓库 typecheck/build/pack/smoke 流程，并在 **官方 Desktop 0.2.1-rc.2** 的隔离 profile 完成安装、21 组场景动作、三个面板切换、三次启停、页面重载和进程强制退出后的存档恢复验证。包仍为 `private: true`，通过本地 tgz 安装，不发布 npm。详细结果、载体身份及覆盖边界见 [阶段 5 记录](../../docs/ai-village/PHASE5_RESULTS.md)。

## 安装

1. 在 DSH 的 Plugins → Add plugin 中输入 `dist/nidofy-dsh-ai-village-0.2.1.tgz` 的完整本地路径，安装并启用。首次安装若提示 `koffi@3.1.1` 构建脚本授权，其用途是本机持久化文件操作。
2. 在新会话选项区或已有会话工具栏点击 **⌂ / 打开 AI 小院**。使用角色选择框切换伙伴；拖到左侧书桌、右侧餐桌或右下坐垫触发对应动作，拖回地面恢复漫步。
3. Git/Hg 请配套更新 `dist/nidofy-dsh-source-control-0.1.2.tgz`。Git 与小院可同时打开，Git 在上、小院在下，共用一列对话留白；关闭 Git 后小院恢复完整高度。小院与 Live2D 互斥，显式打开后者会关闭前者。它们不是小院的运行依赖。替换更新包后完整退出并重启 DSH。

0.2.0 自动读取旧版单人存档，首次保存转为世界格式 2，保留旧的不可变快照；多人名单、各自位置、动作和暂停状态一起保存。旧版 0.1.0 无法读取格式 2，请使用更新版继续游戏。更新的回归和安装结果见 [0.2 记录](../../docs/ai-village/V0_2_RESULTS.md)。

暂停/继续与所选角色会保存。Esc 取消当前拖动；侧栏展开、窗口隐藏或关闭卡片会暂停，切换聊天不会创建新世界。所有资源随包离线提供，不需要模型 API key。存档位于当前 `<profile.dir>/nidofy-ai-village/`；停用和卸载插件保留存档，异常存档不会自动重置。

- [六位新增角色总览](art/QA/roster/assembled-contact.png)、[场景动作总览](art/QA/roster/activity-contact.png)
- [官方 Desktop 截图](art/QA/phase5/desktop-courtyard.png)、[进程恢复截图](art/QA/phase5/desktop-restarted.png)
- [实际安装验证](art/QA/phase5/validation.json)、[恢复结果](art/QA/phase5/restart-validation.json)、[本机性能样本](art/QA/phase5/performance.json)
- [美术资源记录](../../docs/ai-village/ROSTER_ASSETS.md)、[完整生成提示词](art/prompts/roster-generation-record.json)

## 构建和回归

```powershell
node scripts/ai-village-phase4.mjs check
node scripts/ai-village-companions.mjs
npm run typecheck
npm run build
npm run pack
npm run smoke:packed
```

`dist/manifest.json` 包含包大小及 SHA-256。真实安装验收脚本为 `scripts/ai-village-desktop-acceptance.mjs`，仅连接专用测试 Desktop 的本机 CDP 18751；准备方式见阶段 5 记录，不能对日常 profile 执行。

## 阶段 4：接入预览

```powershell
node scripts/ai-village-phase4.mjs serve
```

`check` 包含固定官方 `0.2.1-rc.2` 接口类型检查、真实 Cordis / Connection 鉴权回归、三个插件的实际客户端组件浏览器测试、候选归档与解包检查。浏览器 fixture 仅替代 DSH 页面布局和会话数据，使用真实 Host 插件及官方认证实现。

`serve` 在 `127.0.0.1:18749` 启动验证页，认证入口保存在忽略的 `.build/ai-village-phase4/preview-entry.json`。用其中 `entry` URL 首次打开，官方 Connection 会签发本机 cookie 并重定向到干净地址。不要提交或转发该临时入口文件。

- [接入页面截图](art/QA/phase4/integrated-courtyard.png)
- [浏览器验证结果](art/QA/phase4/validation.json)
- [完整阶段 4 记录与未覆盖项](../../docs/ai-village/PHASE4_RESULTS.md)

实际 Host 入口只使用可信的 `ctx.profileContext.dir`，存档位于其 `nidofy-ai-village/` 子目录。验证页使用 `.build/ai-village-phase4/profile`，不会修改当前 DSH_HOME；不会自动迁移阶段 3 的预览进度。

`.build/ai-village-phase4/phase4-integration.tgz` 是接入测试归档；正式交付使用 `dist/` 的 0.2.1 安装包。Koffi 3.1.1 是外部运行依赖，DSH/React 为宿主 peer。以下阶段 1–3 记录保留当时的技术试验与预览命令，其阶段性限制以最新结果为准。

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
