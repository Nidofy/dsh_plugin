# @nidofy/dsh-working-notebook

面向标准 DSH Web profile 的独立 Cordis bundle。包含 `notebook_read` / `notebook_update` 工具、下一回合已提交笔记注入、用户修订、固定条目、原始历史检索、项目关联以及可选的 basic-compaction 整理。存储、证据验证和整理引擎均在本包中，不依赖 desktop-extras 或桌宠插件。

原版 DSH 同时安装并启用 `@nidofy/dsh-runtime-adapter` 和本包的 tgz（均已内嵌共享库）。Settings → Notebook 显式选择会话并打开笔记；已有 Companion 服务时还可贡献笔记入口，但不自行启动 Companion。关闭插件撤销工具、事件、路由和 UI，不删除笔记，也不撤销已记录的历史上下文。

默认保留 `$DSH_HOME/nidofy-extras/notebooks` 与原 v2 格式。旧 v1 仍经现有显式恢复流程转换；失败、损坏、未来版本和冲突不会重置数据。不能同时启用旧版与本包的 notebook owner。

默认入口导出 `src/enhanced.ts` 的 Config：active entries 默认 64、active/delta 字节各 16384、evidence 65536、history 16777216、缓存会话 32、最近结果 40、扫描窗口 256。`autoOrganize` 默认 false；已保存设置优先。使用配套 **Notebook** 预设，开启自动整理后在 compaction 中提交有界候选，依赖实际成功的持久化标记。其他预设如需自动整理，应将 compaction provider 换为 `@nidofy/dsh-runtime-adapter/compaction`。

公开库入口 `/context`、`/notebook`、`/compaction` 和类型入口 `/notebook-types` 可供其他插件使用；导入库不会自动挂载本插件。模型笔记包含原文引用，不能改变用户固定条目。全量历史恢复和冷检索仍可能随历史长度增长。

`/standard` 是无增强 provider 的显式基础入口，支持 v1 编辑、固定条目、当前会话历史与回合注入；不能覆盖 v2。它不作为完整功能的默认入口。兼容基线：固定原版 DSH 0.2.0-rc.2 与 Cordis 4.0.4。测试覆盖实际 Loader/AgentLoop、持久化、压缩、冷恢复、冲突、取消、界面编辑和历史引用。
