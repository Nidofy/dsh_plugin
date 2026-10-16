# DSH Runtime Adapter

原版 DSH 0.2.0-rc.2 的 notebook 完整模式配套包。JSONL 服务沿用原有格式、锁与迁移实现，增加原子持久化观察及物理代际保护。压缩子类只扩展摘要钩子；事务仍由原版引擎管理。

先停止目标 profile，将此 tgz 添加到原版 Web profile，再添加 working-notebook。本 bundle 禁用 `session-persistence-jsonl` 并插入 `nidofy-runtime-jsonl`，默认 root 为 `dshHomePath('sessions')`。若已有自定义 root/compression，必须把相同完整配置写到新行；两个 provider 不能同时挂载。

新增 **Notebook** 预设基于原版 Standard，压缩 provider 使用本包 `/compaction`。其他预设不自动修改；需要整理功能时自行在预设定义中替换该 provider。working-notebook 的自动整理设置默认关闭。

根入口和 `/jsonl` 是相同 provider 的替代导出；只挂载一次。`/compaction` 是官方 BasicCompactionEngine 子类。`worker.cjs` 用于隔离验证历史格式迁移，随包发布并有实际执行 smoke 验证。共享库内嵌；宿主 DSH/Cordis 与原生依赖作为 peers 提供。

新 notebook 审计事件写入 ignorable 标记；旧 desktop 的同名 required 审计事件仅在读取时兼容，不改旧日志。其他未知 required 事件仍拒绝。类型增补不代表任意 provider 支持增强 API，working-notebook 激活时会检查方法。
