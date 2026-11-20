# AI Infra Lab 0.6.1 · 官方 Desktop 0.2.2-rc.5 适配

本地安装文件为 `packages/ai-infra-lab/dsh-plugin-ai-infra-lab-0.6.1.tgz`。包版本升为 `0.6.1`，方便安装器识别兼容修订。课程和归档版本沿用 `0.6.0`。2026-11-20 在 Windows x64 的独立工作树验收。

| 安装包 | 实测值 |
| --- | --- |
| 打包文件数 | 26 |
| 字节数 | 267,364 |
| SHA-256 | `0fca0786aab72cafb861da4cec43c09f0e95d37d79e7fa5a6baf0b3d9607c955` |

## 宿主版本与实际安装

- `engines.dsh` 和 DSH 服务的 peer 范围为 `>=0.2.1-rc.2 <0.3.0-0 || 0.2.2-rc.5`。显式列出目标预发布版，使 pnpm 的常规 semver 匹配和官方宿主的兼容检查均接受该版本。
- Cordis peer 支持 `4.0.5` 和 `4.1.0`，Schemastery peer 支持 `3.18.5` 和 `3.19.0`。客户端清单只声明面板使用的布局、语言、连接、渲染和侧栏模块。React 与 React DOM 由宿主浏览器提供。
- 通过官方 Desktop 内置 CLI 和发行元数据双重核对目标版本。实际运行时为协议 4、Node.js `24.21.0`、pnpm `11.28.5`、Cordis `4.1.0`、Schemastery `3.19.0`。严格 TypeScript 编译沿用官方 `0.2.1-rc.5` 源码基线，打包身份单独记录了类型检查版本与宿主兼容范围。
- 使用独立的 `DSH_HOME`、`DSH_AGENTS_HOME`、Electron 用户数据目录和空 pnpm store。官方安装器以 `--offline --ignore-scripts` 添加本地 tarball，默认 Desktop profile 中只出现一条实验室启用记录。随后重新启动该 profile，从原生侧栏打开课程面板，读到全部 26 个单元。通过窗口的认证 RPC 在 Docker 中提交 `A00-code`，结果为 `passed`，打开面板及运行期间 `pageerror` 为 0。
- 在包目录运行 `node tests/desktop-022-rc5.mjs` 可单独复验。可用 `DSH_DESKTOP_EXE` 指定官方可执行文件。独立结果保存在 `.build/desktop-0.2.2-rc.5-v0.6.1.json`。
- pnpm 在空 profile 的安装日志中报告 peer 提示。另用官方 pnpm 的 `peers check` 核实，列出的七项分别为 Cordis、Schemastery、DSH 的 brand、connection、llm，以及 React、React DOM。独立 profile 的依赖树仅安装了插件。Desktop 从自身发行包加载这些共享模块。目标门禁核对了五个宿主 peer 的实际版本，并使用内置浏览器运行了 React 面板。

## 完整回归

在 `packages/ai-infra-lab` 运行 `node scripts/check.mjs --full`。北京时间 15:30:13 至 15:33:54，九项门禁均以 0 退出。

| 门禁 | 实测结果 | 秒 |
| --- | --- | ---: |
| 严格类型、构建、行为与 SSR | 28 项测试全部通过 | 5.35 |
| 本地打包 | SHA-256 与 `Get-FileHash` 独立复核一致 | 0.78 |
| 旧宿主空缓存离线安装 | `0.2.1-rc.2`、`0.2.1-rc.5` 均通过兼容检查和 Host/Client 生命周期 | 1.80 |
| 真实 Docker | 累计 22 道代码题全部 `reference=passed`、`starter=failed` | 123.09 |
| 分布式回收 | 进程配额拒绝、25 秒漏调诊断、输出限额、四 worker 在途卸载 | 38.52 |
| 同库升级与归档 | `0.1.0` 至 `0.6.1` 七个包逐行核对同库，逐份验证重复导入幂等 | 2.54 |
| 真实 Edge | 七个模拟器共 56 次布局检查，八次开放题中性反馈，页面错误为 0 | 20.44 |
| 旧宿主七插件共存 | 8 个 Host 注册、5 个浏览器 Client、4 条独立 HTTP 路由 | 12.40 |
| 目标原生 Desktop | 真实离线安装、26 节课、认证 RPC 和 Docker 自检 | 15.75 |

全量门禁结束后单独运行 `docker ps -a --filter "name=ai-infra-lab-"`，匹配数为 0。机器记录保存在 `.build/gate-v0.6.1.json`、`.build/browser-v0.6.1.json`、`.build/coexistence-v0.6.1.json` 和目标 Desktop 报告。

## 验收范围

`0.2.2-rc.5` 的目标验收覆盖 Windows x64 原生客户端和当前插件。七个离线插件同时加载的回归使用它们共同适配的 `0.2.1-rc.5` 发行包。八种显示组合的完整浏览器回归使用 Edge 和实际插件 Host。macOS、Linux 原生客户端及在线模型账户未在本次验证。
