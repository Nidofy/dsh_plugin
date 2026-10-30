# Runtime Adapter / Working Notebook / Source Control：DSH 0.2.1-rc.3

2026-10-29，Windows x64、Node 24.16.0。只升级这三个插件；未发布 npm，未修改实际 DSH_HOME，也未修改 Desktop 宿主仓库。

| 插件 | 新版本 | 离线包 |
| --- | --- | --- |
| Runtime Adapter | 0.1.2 | `dist/nidofy-dsh-runtime-adapter-0.1.2.tgz` |
| Working Notebook | 0.2.1 | `dist/nidofy-dsh-working-notebook-0.2.1.tgz` |
| Source Control | 0.1.4 | `dist/nidofy-dsh-source-control-0.1.4.tgz` |

## 修改

- engines.dsh 与全部 DSH peers 精确绑定 `0.2.1-rc.3`；Notebook 配套 runtime-adapter `0.1.2`。打包时内嵌 shared 的私有副本也绑定该消费者的内核版本，避免引入第二套 rc.2 服务。
- runtime-adapter 的独立 `worker.cjs` 使用官方 rc.3 源码构建，包内记录版本、源码 revision、归档 hash 和 runtime 锁文件 hash。
- Notebook 会话预设同步官方 Standard：时间上下文、计划任务、计划模式文案、当前子代理配置与插件市场入口。只保留 Notebook 身份与摘要 provider 定制；移除旧预设的过时条目。验证脚本对完整预设结构进行比对。
- JSONL provider 与 BasicCompactionEngine 的官方 rc.2/rc.3 源码没有差异；现有代际保护与摘要扩展继续使用。笔记 v2 格式、存储路径、固定条目和历史保留不变。Source Control 的公开 API 和布局契约通过回归，无需更改业务逻辑。
- 新增独立类型、行为、离线安装及升级门禁；默认测试、类型检查和打包 smoke 按插件所属内核版本分开执行。

固定基线：`1f81c047fc48fa190a683e469daa699857e9afe8`，源码归档 SHA-256 `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。独立声明见 `tools/compatibility/notebook-rc3.json`；复用已有 `official-runtime-rc3`、`official-source-ui-rc3` 和 `rc3-coexistence-deps` 锁文件，额外 UI 测试依赖固定在 `tools/notebook-rc3-deps/package-lock.json`。

## 验证

- 严格 Host / Client TypeScript 检查与声明生成通过，共享契约也检查 rc.3。
- 21 个测试文件通过，112 项通过、2 项 Hg 测试跳过（未安装 Mercurial）。覆盖真实 Loader/AgentLoop、模型替身压缩、多轮整理、持久化、取消、冲突、历史与返回卡、客户端草稿、项目选择、Git 临时仓库及本地远端、浮层注册与卸载。
- 真实 rc.3 插件管理服务在新建 profile、空缓存、禁用网络与安装脚本条件下导入三个离线包。
- 从安装产物导入 Host、验证官方压缩引擎继承、原生锁、物理代际、冷恢复、实际 worker 线程及公开 TypeScript 声明。
- SHA 固定的旧 runtime-adapter 0.1.1 / notebook 0.2.0 在独立 rc.2 runtime 中写入 JSONL 和含中文的固定 v2 笔记；新包在 rc.3 runtime 中重开同一路径，验证原代际、原文、修订、游标与所有文件字节不变。
- 官方 rc.3 CLI 组合确认原 JSONL provider 禁用、增强 provider 唯一、Notebook 预设指向配套 compaction。

产物与验证摘要见 [机器可读记录](notebook-source-control-rc3-2026-10-29.json)；生成的详细结果在 `dist/notebook-rc3-verification.json`。本轮没有进行原生 Desktop GUI 验收，也未进行真实模型联网调用。Hg 功能未获得本轮实机验证。

## 复现

先按已有脚本准备固定 rc.3 runtime / source / source-ui 和 coexistence dependencies；额外执行 `npm ci --prefix tools/notebook-rc3-deps --ignore-scripts`。旧版升级夹具使用上表配置文件中 SHA 固定的两个历史 tgz，需保留在 `dist/`。

```powershell
npm run plugins:rc3:check
```

此门禁依次进行类型、测试、定向构建、三包打包及安装/升级 smoke。Windows 测试进程需要有权结束它自己创建的 Git hook 子进程树；受限 sandbox 中 taskkill 被拒绝会令清理测试失败，不能将该失败计为通过。单独验证可执行 `npm run plugins:rc3:test` 或 `npm run plugins:rc3:smoke`。存在 Hg 时可用 `DSH_TEST_HG` 显式指定其可执行文件。

## 安装

完整退出目标 DSH 后，在 rc.3 profile 中先更新 runtime-adapter，再更新 working-notebook；source-control 可独立安装。使用插件管理器导入对应 tgz，完成后完整重启。不要同时启用旧 extras owner 或第二个 JSONL provider。自定义过会话 root/compression 的配置仍须原样保留。启用自动整理仍需选择 Notebook 预设，并打开笔记设置中的“压缩时整理笔记”。

旧 rc.2 profile 使用旧包；不要将此次精确绑定 rc.3 的包用于 rc.2。更新保留 `$DSH_HOME/nidofy-extras/notebooks` 和历史文件，无需删除或重置数据。
