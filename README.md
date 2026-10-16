# DSH 独立插件仓库

面向原版 **DSH 0.2.0-rc.2** 的插件开发仓库。Desktop 是可选载体。源代码独立维护，运行时不依赖 `desktop-extras`；保留既有数据路径与笔记格式。

| 包 | 用途 |
| --- | --- |
| `@nidofy/dsh-desktop-pets` | 桌宠状态、设置、资源包、Web 动画预览，可选 Electron 悬浮窗适配 |
| `@nidofy/dsh-working-notebook` | 完整 v2 笔记、固定条目、历史引用与检索、项目关联、回合注入、压缩整理 |
| `@nidofy/dsh-runtime-adapter` | 原版 DSH 的持久化代际保护、摘要扩展及 Notebook 会话预设 |
| `@nidofy/dsh-plugin-shared` | 共享设置、持久化契约和类型；不自动启用功能 |

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

`compatibility.json` 固定原版 revision、提取来源和工具版本。原版测试由 Git archive 导出到忽略的 `.build/original-dsh`，不会 reset desktop。`dist/manifest.json` 给出安装包大小和 SHA-256。`npm run check` 验证本地类型、测试、构建、打包和隔离安装；原版检查另运行 `test:original`。

## 安装和使用

安装过程见 [原版 DSH 安装](docs/install.md)。桌宠可单独安装；完整 notebook 同时安装 runtime-adapter。所有安装包都在 `dist/`，本仓库不自动发布 npm，也不改实际 DSH_HOME。

在 Settings 中打开桌宠或工作笔记。使用 **Notebook** 会话预设并在笔记设置中开启“压缩时整理笔记”，即可启用完整整理流程。其他预设仍可编辑笔记、调用笔记工具和注入已提交笔记；要自动整理，预设的 compaction provider 必须使用配套导出。

浏览器提供桌宠预览；原生桌面悬浮窗需 Electron 载体接入 [Electron 适配说明](docs/electron-adapter.md)。原版 DSH Web 本身不创建原生窗口。现有 desktop 接入没有自动切换。

## 数据和维护

设置及资源沿用 `$DSH_HOME/nidofy-extras`；笔记位于其 `notebooks` 子目录。不要同时启用旧 extras 和新桌宠 owner，或两份 notebook owner。v1 到 v2 在显式同步时转换，保留旧文件；基础模式禁止覆盖已有 v2。停用插件保留数据。

开发规则见 [AGENTS.md](AGENTS.md)，组件边界见 [架构](docs/architecture.md)，来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。跨 DSH 版本须重新验证。真实 Electron GUI、不同系统的原生表现尚未验收。
