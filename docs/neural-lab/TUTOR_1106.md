# 导师与复习回归（2026-11-06）

基于 `2ae2a43` 的独立导师工作树；保留 0.5.0 已有的当前草稿/执行快照分离、有界历史消息、请求 attempt 归属与帮助来源。未更改 engine、store、types、runner 或数据库格式。

## 本次修复

- tutor-context 校验外部返回状态和文本，只接受 completed/failed/cancelled/unavailable；completed 空白降为 failed。非法返回和同步/异步异常都有失败消息，不记 help。
- 只提取 status/text，防止提供方额外字段覆盖请求身份、角色和 attempt cycle。
- mentor 在回合 completed 与 AbortSignal 已取消同时出现时以 cancelled 为准，不计成功交付。

## 实测

在 `packages/neural-lab` 执行：

```powershell
node --experimental-transform-types --test tests/tutor-1106.test.ts tests/provenance-1106.test.ts tests/store.test.ts
```

12/12 通过（其中新增导师 6 项）。使用 Node 24.16.0、独立临时 SQLite profile；导师 provider 与 session/event 是明确的测试替身。

覆盖两轮追问与八消息/单消息 1200 字符上限、独立 attempt 隔离、旧 run/新 draft、completed 执行但 failed 检查保持原判定、延迟回答归属、无模型/失败/取消/空白/非法返回不记帮助、请求身份防覆盖、复习 snooze 仅作用指定 run、解释及复习完成保留 learner 来源。

在仓库根执行 `node packages/neural-lab/scripts/build.mjs`，固定 DSH rc.5 严格 TypeScript、Host/Client 构建通过。沙箱账户的 Git ownership 检查通过本次进程的 `GIT_CONFIG_COUNT=1`、`GIT_CONFIG_KEY_0=safe.directory`、`GIT_CONFIG_VALUE_0=D:/Documents/FeiyangChen/devApps/dsh_plugin/.build/official-source-rc5` 明确限定源码仓库，未改全局配置。

未运行真实模型、Docker、Desktop GUI、发布打包或安装；这些不属于本批导师单元回归证据。新增测试需集成主控纳入最终门禁；本分支按文件所有权约束未改 package scripts。
