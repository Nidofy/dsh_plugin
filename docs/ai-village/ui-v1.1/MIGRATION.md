# 0.6.3 偏好迁移与回退

世界 schema6、scene/rules/content3 与 frame protocol3 保持不变。偏好 schema1/2 → schema3：旧主题、语言、动态、透明、气泡和已读状态保留，textScale=1；仅全新安装默认 host。未知版本和非法值拒绝。

第一次保存新偏好沿用 SaveStore：保护旧 current/previous 指针及快照原始字节；upgrade-v1-<SHA256>.json 是历史保护引用，不等于新建游戏存档。运行期不删除原件以绕过迁移。schema1/2 字节保护有独立参数化测试。

回退操作：先完全停止插件。保留整份当前 profile 的只读备份，包含世界、preferences 与 album。另建隔离 profile，从升级前整份备份恢复并安装保留的 0.6.2 包；不要把旧 current.json 写回正在使用的新目录。确认旧版读取后再由用户决定使用哪个 profile。需要保留升级后的世界进度时，应另做人工核对，不自动混合两个 profile。

隔离验证脚本：先按 RESULTS 中基线准备步骤导出 e85ccc7，再执行 node --import tsx scripts/ai-village-ui-v11-rollback.mjs。实际 0.6.2 decoder 拒绝 schema3 且不改变字节；独立备份可由旧 decoder 读取；原 schema3 目录仍保留新 textScale。结果见 art/QA/ui-v11/rollback.json。没有修改日常 profile。
