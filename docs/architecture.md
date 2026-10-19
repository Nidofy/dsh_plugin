# 架构与兼容边界

## Live2D 浮动伙伴

`live2d` 使用 `shell.overlay` 与会话工具栏入口，独立拥有资产路由、展示参数、渲染生命周期；不注册 `sidebar.right.pane.tab`、`rightbar`、`shell.accessory` 或 `nidofy.companion`，不依赖 desktop-extras。它与 Git 卡片通过展示专用 `nidofy:floating-panel-open` 事件互斥，最后一次显式打开者占用右侧位置，事件不携带业务数据。几何适配只触碰自身的对话留白标记，退出时撤销。

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

## 桌宠

Host 只读取会话状态并提供 `/api/nidofy-pets/`；总开关关闭时卸载观察器。静态资源校验路径，设置保持修订检查。Web bridge 提供动画预览；Electron 导出控制透明窗口、IPC、拖动与退出清理，载体负责认证和协议。

## 验证与发布

`source-control` 独立拥有 Git/Hg HTTP 路由与客户端面板，不依赖其他功能包或 desktop 私有服务。仓库来自可信配置和公开 WorkspaceRegistry；写操作使用内容/索引/HEAD/配置快照及实例代际校验，通过单队列执行。连接重建销毁旧面板内容，卸载撤销注册并取消进程树和未完成的请求体。客户端采用会话工具栏、Settings 和 `shell.overlay` 独立浮层；不注册 sidebar 标签或替换环境侧栏。原版缺少浮层宽度预留 API，因此局部布局适配使用已验证的 DOM 标记，只为主对话内容添加可撤销留白；官方 sidebar 展开时隐藏卡片、释放留白。该适配随 DSH 版本复验。

测试分别指向当前 desktop 源码及固定原版源码。覆盖真实 Loader/AgentLoop、JSONL 持久化、多轮压缩与冷恢复、取消、固定条目、历史、UI 草稿保留和桌宠生命周期。安装 smoke 解压 tgz 后使用公开导出、真实 worker、类型声明及实际 DSH CLI 配置组合。桌面窗口的真实 GUI 验收单独进行。

`.local`、`.build`、`node_modules`、`lib`、`dist` 都是本地生成内容，不提交。交付包内嵌共享库但不打包宿主服务，避免重复 Cordis 服务身份。构建必须保留独立 worker.cjs 与 preload.cjs。
