独立桌宠 0.2.1 与小院竖向背景 0.3.2 见 [补充发行记录](docs/releases/native-pets-tall-village-2026-10-21.md)。

本轮界面修复、鲸屿皮肤与权限排查见 [发行记录](docs/releases/ui-fixes-2026-10-21.md)。Git 可与 Live2D 或小院共存；桌宠在官方设置页直接控制。

# DSH 独立插件仓库

[AI 小院 0.7.0-preview.3](packages/ai-village/README.md)（[剩余工作核对与验收边界](docs/ai-village/REMAINING_WORK_AUDIT_2026-10-22.md)） 修复加载角色从左到右依次填色；保留连续故事、三种小游戏、居民个性与自主社交，以及可选桌面棋局开发预览，手账扩展为20类。详见 [棋局验证与门禁](docs/ai-village/table-preview/IMPLEMENTATION.md)。原有版本支持七位居民、邻里互动、12 类手账、家具锚点编辑、布局草稿与撤销、配饰和两套环境、真实照片相册及浮卡／展开界面；与 Git/Hg 0.1.3 上下共存，与 Live2D 互斥。Notebook 0.2.0 新增覆盖状态、历史索引降级保留、返回卡与交接包。安装包位于 `dist/`；笔记与存档兼容见 [Notebook / Village 发行记录](docs/releases/notebook-village-2026-10-21.md)。

新增 **DSH Windows Sandbox Enhanced** 独立预览包，单独以官方 **0.2.1-rc.2** 为验证基线。
当前提供只读 ACL 诊断、恢复计划和可选拒绝执行 guard，**尚无隔离执行后端**。
开发、安装限制与待验收项目见 [实施记录](docs/windows-sandbox-enhanced.md)，验证命令为 `npm run sandbox:check`。

全仓库十个包统一面向官方 **DSH 0.2.1-rc.2**，Windows x64 离线安装包位于 `dist/`。安装包内嵌第三方运行依赖，DSH/Cordis/React 复用已有宿主；保留既有数据路径与笔记格式。版本、验证与安装顺序见 [本次发行](docs/releases/0.2.1-rc.2.md)。

| 包 | 用途 |
| --- | --- |
| `@nidofy/dsh-desktop-pets` | 桌宠状态、设置、资源包、Web 动画预览，可选 Electron 悬浮窗适配 |
| `@nidofy/dsh-working-notebook` | 完整 v2 笔记、固定条目、历史引用与检索、项目关联、回合注入、压缩整理 |
| `@nidofy/dsh-runtime-adapter` | 原版 DSH 的持久化代际保护、摘要扩展及 Notebook 会话预设 |
| `@nidofy/dsh-plugin-shared` | 共享设置、持久化契约和类型；不自动启用功能 |
| `@nidofy/dsh-source-control` | 跟随当前项目的 Git/Hg 状态、差异、提交、分支与远端操作面板 |
| `@nidofy/dsh-live2d` | 官方桌面可用的离线 Live2D 伙伴，采用与 Git 相同的右侧浮动卡片，独立启停 |
| `@nidofy/dsh-ai-village` | 七位 Q 版角色同场、工作/吃饭/休息、跨会话持久化小院；官方 0.2.1-rc.2 |
| `@nidofy/dsh-whale-skin` | 官方设置内切换的鲸屿浅深色皮肤、本地背景和装饰 |
| `@dsh-extensions/windows-sandbox-enhanced` | 只读 Windows ACL 诊断与恢复计划预览；内嵌自包含 .NET helper |
| `@dsh-extensions/windows-sandbox-guard` | 专用验收 profile 的拒绝执行 guard，不是可用隔离后端 |

## 开发

当前环境：Windows、Node 24、Git `main`。使用已安装依赖的兼容 DSH 源码作为开发依赖提供方；`setup` 创建本地 junction，不改原仓库。共享库会内嵌于交付 tgz，DSH/Cordis 由安装环境提供。

```powershell
cd D:\Documents\FeiyangChen\devApps\dsh_plugin
$env:DSH_SOURCE = 'D:\Documents\FeiyangChen\devApps\dshWinUi\electron'
node scripts/setup.mjs
npm run typecheck
npm test
npm run prepare:original
npm run test:original
npm run build
npm run pack
npm run smoke:packed
```

首次 setup 前运行 `node scripts/prepare-runtime.mjs`，使用 `tools/official-runtime/package-lock.json` 安装固定发布版到 `.build/official-runtime`，禁止依赖脚本。`DSH_SOURCE` 仅提供已安装构建工具，官方运行依赖会覆盖仓库自己的 DSH 链接，不修改工具来源仓库。官方源码由 `DSH_SANDBOX_ARCHIVE` 与 `npm run sandbox:prepare` 准备，校验 SHA-256，所有测试及 worker 共用这一固定基线。

`compatibility.json` 固定原版 revision 和工具版本。`dist/manifest.json` 给出十个离线包的大小和 SHA-256。`npm run check` 验证类型、全插件测试、构建、打包、官方 CLI 组合及空缓存离线安装；客户端真实浏览器交互另运行 `npm run village:check`。已有 `.build/live2d-official-deps` 用于源码客户端测试；新环境安装 `use-sync-external-store@1.6.0` 与 `@types/use-sync-external-store@1.5.0` 到该目录。

## 安装和使用

Git/Hg 面板独立安装说明见 [版本控制插件](packages/source-control/README.md)，开源参考与设计见 [调查记录](docs/source-control.md)。

Live2D 的方案比较、验证范围与截图见 [Live2D 实施说明](docs/live2d.md)，安装与运行边界见 [插件说明](packages/live2d/README.md)。该包另外通过固定官方 `0.2.1-rc.2` 源码回归与真实 Chromium 离线渲染验收。

安装过程见 [原版 DSH 安装](docs/install.md)。桌宠可单独安装；完整 notebook 同时安装 runtime-adapter。所有安装包都在 `dist/`，本仓库不自动发布 npm，也不改实际 DSH_HOME。

在 Settings 中打开桌宠或工作笔记。使用 **Notebook** 会话预设并在笔记设置中开启“压缩时整理笔记”，即可启用完整整理流程。其他预设仍可编辑笔记、调用笔记工具和注入已提交笔记；要自动整理，预设的 compaction provider 必须使用配套导出。

浏览器提供桌宠预览；原生桌面悬浮窗需 Electron 载体接入 [Electron 适配说明](docs/electron-adapter.md)。原版 DSH Web 本身不创建原生窗口。配套载体适配包生成可独立运行的 Desktop 副本；原版安装不会被自动替换。

## 数据和维护

设置及资源沿用 `$DSH_HOME/nidofy-extras`；笔记位于其 `notebooks` 子目录。不要同时启用旧 extras 和新桌宠 owner，或两份 notebook owner。v1 到 v2 在显式同步时转换，保留旧文件；基础模式禁止覆盖已有 v2。停用插件保留数据。

开发规则见 [AGENTS.md](AGENTS.md)，组件边界见 [架构](docs/architecture.md)，来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。跨 DSH 版本须重新验证。历史 Desktop GUI 验收与本次全仓库自动化、离线安装检查的范围不同，具体通过项和未覆盖项见 [本次发行](docs/releases/0.2.1-rc.2.md)。
