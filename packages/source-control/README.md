# DSH Git / Hg 面板

独立包 `@nidofy/dsh-source-control`，面向原版 DSH 0.2.1-rc.2 / Node 24+，也可在 desktop 使用。无需桌宠、notebook 或 runtime-adapter。宿主需自行安装 Git / Mercurial；没有 Hg 时仍可使用 Git。

## 安装

在停止的目标 profile 中安装构建产物，再启动 DSH：

```powershell
dsh plugin --profile web add .\dist\nidofy-dsh-source-control-0.1.2.tgz
dsh --profile web
```

会话顶部的分支图标及 Settings → 版本控制均可打开面板。面板只显示当前项目对应的仓库，切换会话/项目时跟随切换，并清除旧项目的待确认操作。未选择项目时显示选择提示。仓库默认来自 DSH 工作区登记；嵌套仓库需单独登记，不递归扫描磁盘。也可在 profile 的 `cordis.patch.yml` 中显式配置：

```yaml
- id: nidofy-source-control
  config:
    includeWorkspaces: true
    roots:
      - 'D:/Documents/FeiyangChen/devApps/dshWinUi'
      - 'D:/Documents/FeiyangChen/devApps/dshWinUi/electron'
      - 'D:/Documents/FeiyangChen/devApps/dsh_plugin'
    gitExecutable: git
    hgExecutable: hg
```

`roots` 必须是可信仓库的绝对根路径；`gitExecutable` / `hgExecutable` 可设为可信工具的绝对可执行路径。该配置不会自动写入你的实际 profile。

## 操作

| 功能 | Git | Mercurial |
| --- | --- | --- |
| 当前项目、分支搜索、文件差异、提交图谱 | 支持 | 支持 |
| 选择文件 | 暂存 / 取消暂存 | 跟踪 / 取消跟踪（不删除文件） |
| 提交 | 整个暂存区，保留未暂存编辑 | 选中的 M/A/R 文件，无暂存区 |
| 创建 / 切换分支 | 本地分支 | 命名分支，创建后需提交记录 |
| 获取 | fetch，不 merge | pull，不 update |
| 推送 | 当前审核 HEAD 到同名远端分支 | 当前审核 changeset 及祖先 |
| 工作树 | 查看路径、分支、HEAD | 不适用 |

每次写操作先展示操作检查卡，再显式确认。快照过期会拒绝执行；失败或取消后先刷新，不能自动重试。切分支要求工作区干净。远端只显示已配置名称，不暴露 URL 凭据；首次认证、身份、hooks 与冲突问题在终端处理。Git commit 使用本地身份及 hooks，不自动修改身份或禁用 hooks。

行数显示为“工作区 / 暂存区”，仅计已跟踪文本；二进制与未跟踪文件不计行数。图谱展示最近 40 条提交的真实父子关系，截断父节点用虚线表示。点击刷新读取最新状态，不后台访问远端。

## 边界

此版本不提供 reset/clean、强制推送、rebase、merge 冲突编辑、stash/shelve、Hg bookmarks、克隆、工作树创建/迁移/删除及原生终端窗口。已变更子模块会拒绝写入，应单独登记其仓库。状态输出上限 4 MiB、修改文件内容快照总量 32 MiB、文本预览 256 KiB、单命令超时 45 秒。超过上限转到终端处理。

使用 DSH 已认证的 HTTP 请求边界，JSON POST 与来源检查；客户端只传仓库 ID，不能指定任意执行目录或命令。CLI 无 shell 拼接；路径使用字面匹配并拒绝穿越和符号链接父目录。快照保护覆盖插件内的序列化写入；不能锁定其他终端或 IDE 的操作，也不能把跨进程文件编辑与 Git/Hg CLI 命令变成原子事务。操作前请停止其他程序对同一仓库的写入。

仓库本身是信任边界：Git/Hg 的配置、hooks、扩展、远端工具保留 CLI 原有行为，只登记可信项目。卸载会取消并等待插件拥有的命令。浏览器关闭面板会取消请求；中断写入可能已经部分完成，重新打开后检查状态。

## Desktop 集成

0.1.1 支持与 AI 小院 0.2.0 同时打开：Git 位于右列上方，小院位于下方，两者共用一列留白；关闭小院后 Git 恢复完整可用高度。Live2D 保持互斥。该组合额外验证官方 Desktop 0.2.1-rc.2；替换更新包后完整退出并重启 DSH。

会话工具栏切换独立的 340px 浮动卡片，通过官方 `shell.overlay` 插槽呈现；不注册 sidebar 标签、不使用 Modal 或遮罩。卡片按内容自适应高度，详情过长时内部滚动。展开时只为主对话内容（消息与输入框）预留 364px，顶部工具栏不移动。打开官方 sidebar 后卡片自动隐藏并撤销留白，收起 sidebar 后恢复。主对话可用宽度不足 764px 时暂时隐藏，避免挤压输入区。Settings → 版本控制仍内嵌同一面板。

浮窗随当前会话/项目切换，通过公开 `uiSession.adapter.current` 和会话/工作区快照选择最近一层已登记仓库。显式关闭后保持关闭；sidebar 或空间不足导致的隐藏保留展开意图。隐藏、关闭或连接代际重建时销毁旧内容，取消请求并丢弃确认卡。客户端导出 `RepositoryPanel`，载体嵌入时必须传入 `projectRoot: string | null`；它仅调用本插件 API，不读取 `desktop-extras` 私有状态。

原版没有浮层宽度预留接口，`floating-layout.ts` 将适配范围限制在 DSH 0.2.1-rc.2 的 `data-shell-overlay`、`data-rightbar-col` 和 `data-conversation-content` DOM 标记，不访问私有服务或混淆类名。仅添加自有留白标记，关闭/卸载时移除并断开观察器；找不到兼容布局时不修改宿主。DSH 升级后需复验这层布局契约。

界面采用圆角仓库卡片、分支高亮行、绿色/红色增删统计、可搜索分支列表，提供中英文。字体系列、字号、背景和文字颜色跟随 DSH 全局主题；字号变化通过 `--dsh-content-font-size` 即时生效。实现参考见仓库 `docs/source-control.md`；未复制 VS Code / vscode-hg 源码。

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
