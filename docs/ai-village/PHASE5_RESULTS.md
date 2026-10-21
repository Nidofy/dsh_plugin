# AI 小院：阶段 5 安装验收

日期：2026-10-20。用户已验收阶段 1–3，并授权补齐全部角色和角色选择，直接完成阶段 5，中途不再安排额外验收。

交付 `@nidofy/dsh-ai-village@0.1.0`：DeepSeek、Claude、Gemini、GPT、Grok、Kimi、千问七位伙伴，完整基础动作、四种表情和工作/吃饭/休息三类场景动作；角色选择保留当前世界和活动进度。采用用户允许的“切换角色选择”方案，同一时刻一位角色。美术制作与逐项检查见 [资源记录](ROSTER_ASSETS.md)。

## 载体与隔离

| 项目 | 实测身份 |
| --- | --- |
| 官方 Desktop | 0.2.1-rc.2 |
| 已安装载体 build commit | `332895e0f7c9d4dbfb29729f5eb367fa263ff986` |
| 固定官方源码回归 | `687f282e8625c6b8d11ff58211a90524be2e4317` |
| Electron / Node | 44.7.0 / 24.21.0 |
| CPU / 内存 | Core Ultra 9 285H，16 个逻辑核心，约 31.5 GiB |
| GPU | Intel Arc 140T，驱动 32.0.101.8243 |

复制本机官方发行目录到 `.build/ai-village-phase5/carrier/` 运行；没有修改原安装文件、宿主源码或用户实际 DSH_HOME。DSH_HOME 和 Electron user-data 均位于 `.build/ai-village-phase5/`，CDP 仅监听本机 18751。测试跳过 API key 配置，没有发送模型请求。

Codex 受限进程下 Electron 在启动 UI 前遭遇安装目录 AppContainer ACL 检查失败；正常 Windows 进程启动后通过。本次只给测试 carrier 中的公开发行文件增加了 ALL_APPLICATION_PACKAGES 读取/执行权限，未给 profile 放宽权限，也没有关闭 Electron sandbox。

## 安装与实际 UI 验证

通过官方 Plugins 管理器安装三个本地 tgz，并启用：

- `@nidofy/dsh-ai-village@0.1.0`
- `@nidofy/dsh-source-control@0.1.0`
- `@nidofy/dsh-live2d@0.1.0`

首次安装只对临时 profile 明确允许 `koffi@3.1.1` 的构建脚本；它提供 Windows 持久化文件操作，脚本命令已核对。安装更新通过官方卸载/重新安装完成，存档目录保留。

**替换已有 tgz 后须完整退出并重新启动 DSH，再开始使用。** 本机连续替换同版本的三个包后，仅刷新页面会停在 Loading plugins，日志显示三个客户端 bundle 资源加载失败，直接读取资源返回 404；完整重启后恢复。表现符合宿主进程仍保留旧包资源解析状态，但本次没有修改宿主缓存实现，因此不宣称根因已修复。最终安装验收采用“安装更新 → 完整重启 → 行为检查”的流程。

实际验收自动化操作可见 UI，存档断言通过当前 Desktop 的已认证接口读取。没有直接改世界来伪造拖放结果：

1. 七位角色逐一选择，切换前后仅 actor.id 变化；全部 21 组书桌、餐桌、坐垫放置成功并保存，逐组截图。
2. 三个插件通过实际入口互相让位，返回游戏后暂停的世界不变。
3. 官方右侧栏打开时移除游戏 iframe 和宽度预留，收起后恢复。
4. 输入草稿后 Esc 不删除草稿；进入新会话页保留小院。
5. 页面重载恢复所选角色、位置、活动进度和用户暂停。
6. 官方管理器连续三次停用/启用，停用时撤销 Host 路由与 overlay；重新启用时恢复同一存档且仅一个实例。
7. 保存暂停世界后强制结束整个测试 Desktop 进程树，重新启动同一临时 profile，世界结构逐字段完全一致。

实际安装发现并修正两项兼容问题：会话工具栏在首条消息前不可见，因此三插件增加公开 `conversation.hero.options` 入口；浮卡背景改用宿主有效的 `--dsw-alias-bg-layer-2`，修复浅色主题对比度。重复启停脚本等待管理器的 aria-checked 确认，避免 Host 已撤销而界面状态尚未同步时再次点击。

证据：[官方窗口](../../packages/ai-village/art/QA/phase5/desktop-courtyard.png)、[重启恢复](../../packages/ai-village/art/QA/phase5/desktop-restarted.png)、[安装行为结果](../../packages/ai-village/art/QA/phase5/validation.json)、[进程恢复结果](../../packages/ai-village/art/QA/phase5/restart-validation.json)。

## 类型、回归与交付校验

- `node scripts/ai-village-phase4.mjs check`：固定官方严格类型；6 文件 9 项行为测试；真实 Cordis/Connection 认证与 Host 生命周期；浏览器覆盖七角色、21 组活动、50 次侧栏切换、断连重连、profile/修订冲突、第二窗口所有权；外部网络请求和 pageerror 均为零；接入归档解包 smoke。
- `node scripts/ai-village-companions.mjs`：Git/Live2D 在固定官方 0.2.1-rc.2 严格类型通过；14 文件 36 项测试通过，2 项 Mercurial 测试因本机未安装 hg 跳过。Git 取消进程树测试在普通 Windows 进程环境完成。
- `node scripts/ai-village-phase3.mjs check`：共享场景、导航、拖放、显隐暂停、CAS、跨进程保存和离线场景回归。
- 全仓库 `typecheck`、`build`、`pack`、`smoke:packed` 覆盖正式导出、类型声明、资源闭包、依赖、解包和组合。游戏单独使用经过验证的 0.2.1-rc.2 基线，不冒称兼容旧版宿主。

Source-control 的 peer 范围增加已验证的 0.2.1-rc.2；两插件声明相同的公开新插槽契约，旧版中 `slots.inject()` 等待声明，不主动创建宿主插槽，原入口继续可用。全仓库类型检查同时覆盖新旧基线。Live2D 两个现有文件的陈旧哈希清单已校正，未改模型内容。美术运行资源共 130 张 PNG，包内包含角色/动作/场景定义和许可证，不包含制作图集、测试数据或临时凭据。

旧场景回归的测试 teardown 改为在 Playwright context 仍存活时显式调用 pagehide 清理并等待 release 响应；立即销毁整个 context 会丢弃 keepalive，合法租约尚未过期时下一轮会收到 WORLD_IN_USE。生产租约规则没有为测试放宽。正式安装脚本也等待包列表加载及卸载落盘后再安装，避免异步列表误判。

正式产物：`dist/nidofy-dsh-ai-village-0.1.0.tgz`；配套 Git/Live2D 包同在 `dist/`。最终大小和 SHA-256 以 `dist/manifest.json` 为准。未发布 npm；本轮没有执行新的 Git 提交或推送。

本次小院包 28,188,822 字节（约 26.9 MiB），SHA-256：`c50442b092ec724bd5a685315e0d6694b1e5f2d2126a5884bc2ee79483ff1502`。实际安装验收记录附三包哈希，并逐字节核对安装目录的 Host、Client、renderer 和 README 与最终构建一致。

## 性能样本与覆盖边界

真实 Desktop 各采样 15 秒：可见时约 26.1 FPS，累计平均 JS 绘制提交 0.35 ms，最大约 36.4 ms；固定 130 张纹理，Pixi ticker 不另行运行。整个隔离 Desktop 的 CPU 时间折合单逻辑核心约 20.6%，关闭小院后约 0.48%；主页面 JS heap 约 30 MB。CPU 包含宿主本身，heap 不包含 GPU/原生纹理，绘制提交耗时不等同 GPU 完成时间。这是本机短样本，不宣称长期或跨硬件基准。[原始数据](../../packages/ai-village/art/QA/phase5/performance.json)

已保留的边界：没有多人同时在场、换装或模型调用；未进行物理中文 IME 候选窗、真实权限审批流、跨操作系统和长时间压力测试。强制结束进程通过不等于断电测试。历史不可变快照尚无自动回收，长期保留策略未在本次引入。真实用户 profile 未安装或修改。

## 复验入口

先在忽略的 `.build/ai-village-phase5/carrier/` 准备同版本官方发行副本，再以普通 Windows 进程运行：

```powershell
./scripts/ai-village-desktop-launch.ps1
# 首次打开跳过 API key 配置；通过官方管理器安装本次 dist 包。
node scripts/ai-village-desktop.mjs install-suite
./scripts/ai-village-desktop-launch.ps1 -Restart
# 跳过欢迎页后，再验证这次新装的包。
node scripts/ai-village-desktop-acceptance.mjs
./scripts/ai-village-desktop-launch.ps1 -Restart
# 无 API key 的隔离环境可能再次显示欢迎页，选择 Set up later。
node scripts/ai-village-desktop-acceptance.mjs restored
node scripts/ai-village-desktop-performance.mjs
```

重启脚本只操作其 pid 文件指向、且可执行文件与 user-data 参数均匹配的测试进程。自动化不会关闭或修改正常使用的 DSH。日志可能包含临时认证入口，不应提交或转发；QA 记录没有凭据。
