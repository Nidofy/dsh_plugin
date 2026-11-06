# 0.6.0 完整范围

| 范围 | 实现与证据 |
|---|---|
| 运行绑定调试 | DebugWorkbench/debug-model，真实依赖、layer/shape/check/梯度/源码、未知值、分级帮助归属 |
| 执行迁移与学习来源 | 六个新增独立活动，三输出MSE、B/T/head、两层、修复；learning-progress与版本隔离回归 |
| 聚焦两轮导师 | run/component/check校验、当前草稿与历史快照、unknown实际帮助；真实成功验收见最新记录 |
| 顺序实验组 | 原SQLite KV/history，冻结尝试/代码/环境，最多6项/600秒，分lr统计、CAS结论、取消/重启中断 |
| 两层与观察 | 新协议独立版本，4步判题、8–24步观察；17真实数值/强错解，最大规格485事件 |
| 工程门禁 | check/check:full、57行为测试、35CPU参考、20攻击、5生命周期、空store离线与旧包升级 |

逐项实际通过与当前边界见 [0.6验收](v060/VALIDATION.md)，历史P0盘点保留如下。

# 2026-11-06 现场能力矩阵与冻结契约

基线 HEAD `22eec9f8b2e74452cdb1b311989f465bf7a2028e`，插件 0.5.0，固定宿主 DSH 0.2.1-rc.5 (`b830ec950faba0a46dda564be3e2d854afed94f1`)，Node 24.16.0。输入三份规划文档是条件性 backlog；未跟踪原文保持原样。

| 能力 | 现场状态 | 源码/现有测试 | 下一步 |
|---|---|---|---|
| 12课/41活动、14组件组装 | Done | content/catalog.json、content.test.ts | 不复制课程/运行器 |
| 学生 MLP/Transformer 前反向训练 | Done（源码）；本轮CPU待测 | runtime/training.py、char_transformer.py、vibration.py；training-real.ts、projects-real.ts | 扩充错梯度/拆分变异 |
| tensor/attention/梯度与双run对照 | Partial | components/Diagnostic、TrainingComparison；project-ui.mjs | 多变量/未知环境因果提示 |
| 快照/实验复现 | Partial | engine.projectFile/inspectProject、ProjectExchange | 单文件MLP尚被components门控排除，补齐并验证不信任导入结果 |
| 导师当前草稿/旧run/帮助交付 | Partial | tutor-context.ts、ui-check.mjs | 旧run解释版本与跨attempt帮助归属修复；扩大回归 |
| SQLite v1、CAS、旧资料/卸载 | Done | store.test.ts、host.test.mjs、upgrade-020.mjs | 保留schema、不重写旧行，重跑升级 |
| 隔离/镜像ID/取消 | Done（源码） | runner.ts、runner-lifecycle.ts | create回复不确定/清理恢复注入；真Docker复核 |
| rc.5 strict/构建/行为测试 | Done（本轮） | `npm test`: 14/14，strict及Host/Client构建通过 | 最终包再次门禁 |
| Docker/官方Web/Electron安装 | Unverified（本轮开始时） | 历史VALIDATION不可当本轮结果 | Docker daemon初始未启动，已请求启动；最终逐项实测 |

选择五包：D数值/取消边界；C两项目诊断教学深化；B运行归因与复现UI；E导师多轮/证据来源；A核心MLP复现/历史解释修复与发布。优先复用现有路径，不宣称所有旧功能缺失。

## 契约 1106-v1（最小演进）

- Activity沿用 Exercise.id/lessonId/kind/testVersion + Catalog.version + Lesson.prerequisites；不新增平行课程系统。
- Run沿用 RunRecord.id/attemptId/codeHash/contentVersion/testVersion/seed/config/effectiveConfig/resolvedImageId/trainingManifest。splitHash/initialHash/batchHash是已有数据身份，不伪造datasetHash/envDigest；run_status与check_status独立。
- Metrics沿用 RunEvent(runId,seq,source,type,name,step,value)。矩阵128×128，shape/stride有界；artifactId+runId+codeHash通过Host读取。导入文件自带摘要只用于一致性比较，不是可信执行证明。
- ProjectFile仍`neural-lab-project/1`，单文件训练components=[]；组件项目保持原清单。只载入草稿，显式运行后才产生可信新run。
- Evidence旧记录保留；新run关联解释使用来源run版本及attempt，解释时的当前帮助另行记录；程序判定不受导师覆盖。
- A唯一写者：types、engine/store/runner/runtime、RPC、catalog索引、workbench、版本与构建。B只组件及专用测试；C独立教学目录；D独立tests；E tutor-context/mentor及独立测试。各自worktree/分支，小批提交由A集成。

当前失败环境探测：沙箱账户Git ownership导致首次npm test失败，用户权限重跑成功；Docker用户权限也报Linux engine pipe缺失（尚未启动）。最终结果见VALIDATION最新段落，不把这些失败抹去。


## 结束复核（0.5.1）

上述表为不可覆盖的P0现场状态。完成后：MLP/Transformer实训、真CPU强错解、取消/隔离、MLP复现、跨run归因、历史解释/导师、两项目教学、旧包升级、官方空缓存安装、Web及Electron冷重启均 **Done / VERIFIED**，证据逐项见VALIDATION最新段落。真实模型成功回答 **Unverified**；全主题/辅助技术专门认证未覆盖。已完成旧能力没有被重复建设，剩余项目未伪标完成。固定Activity/Event/ProjectFile1/SQLite1沿用；仅新增可选answer来源字段与明确的0.5.0导入兼容。
