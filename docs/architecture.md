# 架构与兼容边界

## AI 小院

`ai-village` 使用 `shell.overlay` 与会话工具栏入口。世界 owner 在插件生命周期中创建，与会话选择及 React 浮卡挂载解耦。Git 与小院共享右列上下布局；Live2D 通过已有展示事件仅与小院互斥，只有显式打开动作参与抢占。侧栏/空间不足、窗口隐藏、关闭、主面板和断连均暂停，用户暂停偏好独立保存。

Host 从 `ProfileContext.dir` 获取可信存档根，通过官方已认证 `connection/request` 提供固定资源及受限存档操作。跨进程 owner 锁、客户端租约/Host epoch、持久 profile 身份、CAS 与 operationId 防止重连和多窗口争写。渲染 iframe 不接触 Host API，资源由父页面校验后传入。固定源码及实际 Desktop `0.2.1-rc.2` 已通过验证，见 [阶段 5 记录](ai-village/PHASE5_RESULTS.md)。

0.6 的七个稳定角色 ID 使用 schemaVersion=6、sceneVersion=3、simulationRulesVersion=3、contentRevision=3 世界模型，actor 表示选中角色，companions 保存其他在场成员。schema 1–3 按冻结的历史场景迁移，schema 4/5 使用保留的解码器，继续保存已有茶会、手账和风铃；首次新保存保护旧指针和快照原字节，升级引用独立于近期普通快照保留窗口。各角色按固定 ID 顺序模拟，选择变化不影响随机数消费；家具独占，行走和落点避开其他居民。

0.6 的 home 数据与世界同一次 CAS 保存：四个家具组各有两个合法锚点，三个布局模板可继续编辑，几何、座位、点击区域与绘制同步。编辑草稿独立于持久世界并暂停模拟，支持有界撤销、取消与确认；0.6.1 在侧栏/宿主面板隐藏时保留草稿，返回重新校验；显式关闭/取消/换页、恢复或连接切换清除草稿。确认重检修订、活动和居民足迹，不瞬移或清除居民。当前几何通过内部模拟适配器复用既有规则，历史默认几何保持。七人配饰独立保存，午后／暮色环境与 UI 主题分离，照片使用实际渲染结果。

邻里事件在候选世界预留席位，按实际路径接近，确认完成后原子记录首次手账、共同经历和装饰奖励。三种布局、六类家具、三件装饰采用明确确认；家具、风铃、额外装饰草稿统一由 runtime 持有，共用布置暂停，预览可取消，隐藏时保留。保存回执不确定时显示未确认并保留草稿，只读核对而不重放写入。主题、语言、减少动态和气泡设置使用独立 Preferences schema 1。浮卡、展开和拍照共用 owner 与 iframe；资源按在场成员准备，蓝鲸单人 32 张、其他单人 23 张、七人 128 张，新增道具和家具采用代码矢量。

相册独立存储受限 PNG 与修订索引，校验格式、解压长度、hash、固定路径和文件链接。上传及删除使用 owner/CAS，回执不确定时只读对账，卸载等待在途事务。索引先发布再清理无引用托管图片，保留上一索引引用以支持恢复。拍照只冻结自己的暂停原因，输出实际渲染 PNG。0.6.1 的展开区域根据对话栏和公开 composer 标记避开主输入区，空间不足暂停；输入法组合期间不消费 Escape，轻点在 pointerup 确认。补齐项与现场验收边界见 [剩余工作审计](ai-village/REMAINING_WORK_AUDIT_2026-10-22.md)。实施、离线包、实际 Desktop 冷恢复和测量边界见 [0.6 验收记录](ai-village/V0_6_RESULTS_2026-10-22.md)；[0.5 验收记录](ai-village/V0_5_RESULTS_2026-10-22.md)；[0.4 记录](ai-village/V0_4_RESULTS_2026-10-22.md)作为历史基线保留。

三个启动入口统一从 `shell.overlay` 挂载，再通过 React Portal 放到官方 `[data-conversation-header-corner]` 标记内、sidebar 按钮左侧。官方 corner 插槽为 single，保持原 sidebar owner 不变；适配器仅管理各自的 DOM 子节点，按 Git / Live2D / 小院排序，跟随新会话、已有会话的 header 重建迁移，卸载移除节点并断开观察。删除 hero/options 与 header/utilities 的重复入口。三个独立包保持相同的小型 header-launcher 适配器，不引入共享库的原生依赖；标记随 DSH 版本复验。

## Live2D 浮动伙伴

`live2d` 使用 `shell.overlay` 与会话工具栏入口，独立拥有资产路由、展示参数、渲染生命周期；不注册 `sidebar.right.pane.tab`、`rightbar`、`shell.accessory` 或 `nidofy.companion`，不依赖 desktop-extras。它与小院通过展示专用 `nidofy:floating-panel-open` 事件互斥，与 Git 共享按内容高度分配的右侧位置，事件不携带业务数据。几何适配只触碰自身的对话留白标记，退出时撤销。

Cubism 在不透明来源 sandbox iframe 中执行；Host 提供固定白名单资源，主页面校验后传递离线字节，iframe CSP 禁止联网。模型和 Core 不进入主客户端 bundle。隐藏移除 iframe，失败静态回退并保留明确重试入口。展示契约由独立插件拥有，保持旧构图语义；无需引用定制 feature 的类型。详见 [Live2D 方案与验证](live2d.md)。

## Windows Sandbox Enhanced

`windows-sandbox-enhanced` 与 `windows-sandbox-guard` 是面向官方 DSH 0.2.1-rc.2 的独立包，
不依赖 Nidofy 或定制 Electron。前者仅诊断与生成不可执行的恢复计划；后者是专用测试 profile
的拒绝执行 Provider，不能冒充完整沙箱。固定官方源码的验证通道与其他包分离，见
[沙箱实施记录](windows-sandbox-enhanced.md)。真实隔离执行和文件回写仍待后续实现与安全验收。

桌宠和 notebook 各自拥有 Cordis Host/Client 入口、配置、HTTP 路由及卸载生命周期。两者无需互相安装。共享库不注册服务；可选 Companion 类型不启动旧 desktop-extras。

## 完整 notebook

`working-notebook` 默认入口是 v2。SessionQuery 提供原文读取；原有 Session/AgentLoop 负责模型回合；插件注册工具与 system-prompt 注入。笔记存储使用不可变修订、CAS 和持久化 current 指针，固定条目不能由模型覆盖。

原版 DSH 缺少物理代际保护和 basic-summary 钩子，因此 `runtime-adapter` 提供：

1. 从现有 JSONL provider 提取的实现，保留文件格式、kernel lease、写入队列、历史迁移和 worker 校验，增加 `observeDurable` / `withGeneration`。观察值绑定真实文件代际，不用缓存 revision 冒充身份。它是原 provider 的替代项，不增加并行 writer。
2. `BasicCompactionEngine` 子类，仅重写摘要钩子。选区、token policy、请求恢复、事务及成功标记由官方引擎管理。插件候选在真实持久化成功后才发布；取消、设置变化、无效输出和失败不提前推进笔记游标。
3. JSONL 写入边界仅将 schemaVersion=1 的 `nidofy/notebook-compaction` 审计记录标为 `ignorable: true`。它们不改变会话 surface；移除插件后原版 DSH 仍能读取日志。其他未知 required 事件不会被放宽。

Notebook 预设基于原版 Standard 预设，只替换 compaction provider，保留官方 AgentLoop 和工具组合。自定义预设可显式使用同一导出。默认自动整理关闭；开启后会增加有界 evidence 和候选输出，无效候选最多触发一次明确的基础摘要回退。

原版客户端使用 `useSessions` 显式选择会话，通过 connection generation 和组件 AbortSignal 取消过时操作。历史引用通过官方 `slash/input-insert-text` 和草稿 revision 插入已打开的会话。没有依赖 desktop 的 mainSelection/mainBinding/appendText。

`/standard` 是显式基础入口，用于不提供增强 provider 的部署；与 v2 互斥，不会降级覆盖已有 v2 数据。

Notebook 0.2.0 的返回卡与交接包是已提交笔记的只读投影，按原文事件重新验证来源，跨会话选择复用显式项目授权。覆盖预览不推进游标；索引容量不足保留有效旧范围。没有执行时代码回执的验证一律标记需要复验，不推断当前代码通过。

## 桌宠

Host 只读取会话状态并提供 `/api/nidofy-pets/`；总开关关闭时卸载观察器。静态资源校验路径，设置保持修订检查。官方设置页提供直接管理与总开关；不再注册主窗口内的桌宠浮层。Electron 导出控制独立透明窗口、IPC、拖动与退出清理，载体负责认证和协议。固定官方 Windows 载体适配由 scripts/build-pet-carrier.mjs 在本仓库生成，设置保存后刷新窗口；未适配客户端显示明确提示。应用页 preload 只暴露版本和会话导航通知，不提供原生命令或 Host 凭据。

## 验证与发布

`source-control` 独立拥有 Git/Hg HTTP 路由与客户端面板，不依赖其他功能包或 desktop 私有服务。仓库来自可信配置和公开 WorkspaceRegistry；写操作使用内容/索引/HEAD/配置快照及实例代际校验，通过单队列执行。连接重建销毁旧面板内容，卸载撤销注册并取消进程树和未完成的请求体。客户端采用会话工具栏、Settings 和 `shell.overlay` 独立浮层；不注册 sidebar 标签或替换环境侧栏。原版缺少浮层宽度预留 API，因此局部布局适配使用已验证的 DOM 标记，只为主对话内容添加可撤销留白；官方 sidebar 展开时隐藏卡片、释放留白。该适配随 DSH 版本复验。

测试分别指向当前 desktop 源码及固定原版源码。覆盖真实 Loader/AgentLoop、JSONL 持久化、多轮压缩与冷恢复、取消、固定条目、历史、UI 草稿保留和桌宠生命周期。安装 smoke 解压 tgz 后使用公开导出、真实 worker、类型声明及实际 DSH CLI 配置组合。桌面窗口的真实 GUI 验收单独进行。

`.local`、`.build`、`node_modules`、`lib`、`dist` 都是本地生成内容，不提交。交付包内嵌共享库但不打包宿主服务，避免重复 Cordis 服务身份。构建必须保留独立 worker.cjs 与 preload.cjs。
