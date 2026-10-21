# Notebook 0.2.0 / AI Village 0.3.0

日期：2026-10-21。源码起点 `394e60538fe0c55afdeca10086c23ab5d2474c59`，本次交付包含其后的工作区修改。官方基线仍为 DSH `0.2.1-rc.2` / `687f282e8625c6b8d11ff58211a90524be2e4317`。本轮不开展 Sandbox 开发或验收，不更新实际用户 DSH_HOME。

## Notebook

- 索引增长、检查点大小或发布临时空间达到上限时，继续查询已通过会话、物理代次与来源锚点校验的旧检查点。结果包含覆盖终点及容量/结果数降级原因；无效旧来源不会复用。FTS 仍使用有界单来源重建。
- 面板显示已提交证据游标、已持久化历史终点、待覆盖事件数，以及下一批次预计停下的事件。此预览不包含官方压缩器附加内容，不代表实际提交；整理失败仍保留既有失败状态。
- 返回卡从已提交笔记生成，不调用模型。支持当前会话，以及显式项目关联下由用户选中的另一会话；不会合并冲突决定。跨会话读取和导出前后重新验证项目关联修订、工作区成员与会话代次。
- Markdown/JSON 导出包含笔记类别、原文引用、来源角色、时间、摘要和笔记修订。导出动作重新读取，内容仅作参考，不转移执行授权。Markdown 中的非可信正文逐行引用。
- 历史验证记录展示来源和时间，区分工具结果和模型陈述。当前笔记格式没有与执行时代码绑定的回执，因此此类记录都显示“需要复验”；代码基线、命令及未提交修改未知时保持 null。本版本未实现 Git 内容指纹或自动判定当前代码测试通过。

保留 v2 笔记格式、固定条目保护、单 writer、压缩成功后提交和原始证据校验。超大事件目前仍按完整事件处理；本轮实现阻塞可见性，分段证据协议另行设计，不跳过事件推进游标。

## AI Village

- 七位居民自主选择工作、吃饭、休息或走动。固定本地偏好和种子随机数，不调用模型。活动有结束时间，行进有超时，阻路后放弃预留并重试；使用结束后离开家具。
- 家具实例、活动和座位分别表达；预留随角色活动意图保存。当前美术保持原场景，每处一个位置。简单可见图绕开现有桌子障碍，逐段检验可达性。
- 世界格式升级为 3。旧格式 1/2 在内存迁移，保留角色、位置、暂停、随机数和进度；旧持续活动获得有限时长。新写入才使用格式 3，旧原件不改写。0.2.x 不支持格式 3，回退需使用升级前快照，不得重置现有存档。
- 拖动冻结被选角色的活动时钟，取消或失败落点保留原状态，成功移动后释放旧预留；移出居民也释放预留。隐藏/断连/用户暂停继续遵守既有生命周期。
- 新周期快照使用 `managed-v1-` 名称，只回收已确认结构及归属的此类文件。保留最近 32 份，以及 current/previous 和恢复证据引用的快照；旧版 UUID 文件、未知文件、恢复原件不自动回收。受保护文件可以使总数超过 32，整个存档目录不是严格恒定大小。
- 回收在现有事务锁内执行并检查 owner；恢复指针损坏、链接、未知格式或扫描上限触发保守停止。已持久化的保存不因回收失败而变成失败重放；心跳和界面提供回收异常提示。

## 验证命令

```powershell
node scripts/typecheck.mjs --exclude-sandbox
node scripts/build.mjs --exclude-sandbox
node scripts/test.mjs
node scripts/ai-village-phase4.mjs check
node scripts/ai-village-phase3.mjs check
node scripts/pack.mjs --exclude-sandbox
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
```

`scripts/test.mjs` 本身排除 Sandbox 测试；不要用会额外调用 Sandbox 的根 `npm test` / `npm run check` 替代本轮命令。排除参数保留 manifest 中已有 Sandbox 产物记录，不构建或测试它们。

浏览器与 Desktop 证据输出至 `.build/ai-village-v0.3-qa/`，历史阶段截图和验收记录保持原样。Desktop 只连接仓库隔离副本的 `127.0.0.1:18751`。

## 本轮实际结果

- 排除 Sandbox 的全仓库回归：42 个文件，169 项通过，2 项 Mercurial 测试因未安装 hg 跳过。Git hook 进程树取消测试在受限执行环境出现临时目录 EBUSY；允许回收测试子进程后单独和全仓库复验均通过，没有修改 Git/Hg 业务代码。
- Notebook / runtime-adapter / Village 定向回归：21 个文件、107 项通过。包括旧索引容量耗尽及冷启动、来源锚点变化拒绝、超大事件覆盖、只读交接、项目关联撤销、验证来源不一致、存档上限/恢复引用保护、活动预留、拖动时钟、schema 1/2 迁移和七人一小时确定性模拟。
- 严格类型、构建、打包、实际解包 Host/worker、类型消费者、官方 CLI 单 JSONL provider 组合通过。7 个非 Sandbox 包用全新 pnpm store、offline、ignore-scripts 和不可连接 registry 安装后实际调用 Koffi/Sharp 通过。
- Village 固定官方 Host/Client 集成：10 个文件、21 项通过，真实浏览器验证七人、21 组活动、50 次侧栏切换、Git 共存/Live2D 互斥、重连和重载。DPR 1/2 存档/拖放浏览器通道、跨进程 owner 锁和解包 smoke 通过。页面错误与外部网络请求为零。
- 官方 Desktop：通过 Plugins 管理器安装新包并重启；核对 tgz SHA-256 和安装后的 Host、Client、frame、README 字节。通过 21 组动作、七人存档、三类活动并存、面板切换、草稿保留、页面重载、三次禁用/启用及进程级冷恢复；页面错误为零。记录见 `.build/ai-village-v0.3-qa/desktop/validation.json`、`restart-validation.json`。
- Desktop 首次配置页曾让工作区目标接受 DOM 操作但不能完成截图。脚本现通过官方“Add API Key → Set up later”跳过可选配置，不填入凭据。验收使用 1400×1000 的固定渲染视口，标记为 emulated；真实原生窗口尺寸变化仍需另外验证。
- Desktop 两段各 15 秒采样：七人显示时约 25.9 FPS，桌面进程合计 CPU 约为一个逻辑核心的 19.54%；关闭小院后约 0.42%，iframe 和布局占位撤销。父渲染器堆约 28.9 MB；它不包括原生/GPU 内存，不代表增量占用。证据见 `desktop/performance.json`，不是长期负载或跨机器性能保证。

## 尚未包含

Notebook 分段证据、自动项目知识晋升、执行时 Git 指纹回执和真实模型接续质量 A/B；Village 家具编辑器、社交对话、真实 Agent 状态映射。真实机器睡眠唤醒与长时间主 Agent 并行负载尚需专门现场验证。模拟一小时不等于原生桌面运行一小时。
