# 架构与兼容边界

桌宠和 notebook 各自拥有 Cordis Host/Client 入口、配置、HTTP 路由及卸载生命周期。两者无需互相安装。共享库不注册服务；可选 Companion 类型不启动旧 desktop-extras。

## 完整 notebook

`working-notebook` 默认入口是 v2。SessionQuery 提供原文读取；原有 Session/AgentLoop 负责模型回合；插件注册工具与 system-prompt 注入。笔记存储使用不可变修订、CAS 和持久化 current 指针，固定条目不能由模型覆盖。

原版 DSH 缺少物理代际保护和 basic-summary 钩子，因此 `runtime-adapter` 提供：

1. 从现有 JSONL provider 提取的实现，保留文件格式、kernel lease、写入队列、历史迁移和 worker 校验，增加 `observeDurable` / `withGeneration`。观察值绑定真实文件代际，不用缓存 revision 冒充身份。它是原 provider 的替代项，不增加并行 writer。
2. `BasicCompactionEngine` 子类，仅重写摘要钩子。选区、token policy、请求恢复、事务及成功标记由官方引擎管理。插件候选在真实持久化成功后才发布；取消、设置变化、无效输出和失败不提前推进笔记游标。
3. JSONL 写入边界仅将 `nidofy/notebook-compaction` 审计记录标为 `ignorable: true`。它们不改变会话 surface；移除插件后原版 DSH 仍能读取日志。其他未知 required 事件不会被放宽。

Notebook 预设基于原版 Standard 预设，只替换 compaction provider，保留官方 AgentLoop 和工具组合。自定义预设可显式使用同一导出。默认自动整理关闭；开启后会增加有界 evidence 和候选输出，无效候选最多触发一次明确的基础摘要回退。

原版客户端使用 `useSessions` 显式选择会话，通过 connection generation 和组件 AbortSignal 取消过时操作。历史引用通过官方 `slash/input-insert-text` 和草稿 revision 插入已打开的会话。没有依赖 desktop 的 mainSelection/mainBinding/appendText。

`/standard` 是显式基础入口，用于不提供增强 provider 的部署；与 v2 互斥，不会降级覆盖已有 v2 数据。

## 桌宠

Host 只读取会话状态并提供 `/api/nidofy-pets/`；总开关关闭时卸载观察器。静态资源校验路径，设置保持修订检查。Web bridge 提供动画预览；Electron 导出控制透明窗口、IPC、拖动与退出清理，载体负责认证和协议。

## 验证与发布

测试分别指向当前 desktop 源码及固定原版源码。覆盖真实 Loader/AgentLoop、JSONL 持久化、多轮压缩与冷恢复、取消、固定条目、历史、UI 草稿保留和桌宠生命周期。安装 smoke 解压 tgz 后使用公开导出、真实 worker、类型声明及实际 DSH CLI 配置组合。桌面窗口的真实 GUI 验收单独进行。

`.local`、`.build`、`node_modules`、`lib`、`dist` 都是本地生成内容，不提交。交付包内嵌共享库但不打包宿主服务，避免重复 Cordis 服务身份。构建必须保留独立 worker.cjs 与 preload.cjs。
