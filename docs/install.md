# 原版 DSH 安装

基线：DSH 0.2.0-rc.2、Node 24+。请先停止目标 profile，再安装；安装后重新启动。以下命令是安装步骤，本次开发未在你的实际 DSH_HOME 中执行。

## 完整模式

从仓库根目录运行，按顺序添加配套适配包和功能包：

```powershell
dsh plugin --profile web add .\dist\nidofy-dsh-runtime-adapter-0.1.0.tgz
dsh plugin --profile web add .\dist\nidofy-dsh-working-notebook-0.1.0.tgz
dsh plugin --profile web add .\dist\nidofy-dsh-desktop-pets-0.1.0.tgz
dsh --profile web --dump-config
dsh --profile web
```

`dsh plugin add` 将 bundle 加入指定 profile；若使用 Web Plugin Manager，请安装相同 tgz 并按上述顺序启用。桌宠可单独添加，不要求 notebook 或 runtime-adapter。共享库已内嵌，不必单独安装。包管理器可能需要下载依赖，离线 smoke 验证使用开发宿主已安装的 peer 依赖。

检查 dump 中原 `session-persistence-jsonl` 已 disabled，新 `nidofy-runtime-jsonl`、`preset-notebook`、`nidofy-working-notebook` 和 `nidofy-desktop-pets` 存在。不要再次手动挂载同一个 provider 或 notebook owner。

若原 profile 给 `session-persistence-jsonl` 配置了自定义 root/compression，把相同值完整写入该 profile 的 `cordis.patch.yml` 新行。补丁替换整个 config，不能只写 compression：

```yaml
- id: nidofy-runtime-jsonl
  config:
    root: 'D:/YourExistingDshSessions'
    compression: zstd
```

默认 root 为 `dshHomePath('sessions')`。不要将旧 root 留在被禁用的行上，误以为新 provider 已继承它。此仓库不复制或移动实际用户会话。

## 使用完整 notebook

1. 打开或切换到 **Notebook** 会话预设。它基于原版 Standard，只替换摘要 provider。
2. Settings → 工作笔记中选择会话、打开面板。添加笔记时选择原文事件与准确引用；可固定、编辑、退役和恢复条目。
3. 开启“压缩时整理笔记”；下一次实际 compaction 才整理，不额外启动 AgentLoop。关闭时手动笔记和回合注入继续工作。
4. 历史检索支持当前会话、同工作目录与显式关联项目。插入引用要求对应会话输入框已打开；草稿修订检查防止覆盖其他输入。

自定义预设沿用其原有配置，将 compaction-basic 的 `name` 改为 `@nidofy/dsh-runtime-adapter/compaction`。这是预设定义中的变更；普通 patch 的 `name` 只是匹配检查，不能用它重命名现有插件行。不要覆盖一份有用户定制的完整预设来省略此步骤。

## 数据与退出

新笔记沿用 `nidofy-extras/notebooks`；新桌宠沿用 `nidofy-extras/preferences.json` 和资源目录。已有 v1 在显式同步时保留原文件并转换；不要同时启动旧版与新包的同类功能 owner。

runtime-adapter 对新 notebook 审计记录写入官方 `ignorable` 标记，所以新日志可由原版 provider 继续读取。旧 desktop 曾把此记录写成 required；适配器只在读取时兼容该类型，不改旧文件，因此这种旧日志在卸掉适配器后仍受原版原有的未知 required 事件限制。

停用 notebook 后再停用 runtime-adapter；恢复原 JSONL provider 前确认没有两个 provider 同时挂载。停用不会删除笔记或资源。不要把已有 v2 数据切换到基础模式后继续写入。

## 基础模式与 Desktop

确需不装 runtime-adapter 时，禁用 `nidofy-working-notebook`，单独插入 `@nidofy/dsh-working-notebook/standard`。它只提供基础 v1 功能，不支持自动整理；现有 v2 会明确拒绝降级。

真实桌宠悬浮窗见 [Electron 载体接入](electron-adapter.md)。原版 Web profile 中使用设置和动画预览；没有浏览器权限绕过或后台启动 Electron 的行为。
