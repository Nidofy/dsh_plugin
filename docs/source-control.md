# Git / Mercurial 独立插件

源码：`packages/source-control`，交付包：`dist/nidofy-dsh-source-control-0.1.0.tgz`。功能、安装与限制见 [插件说明](../packages/source-control/README.md)。

## 开源参考调查（2026-10-18）

- [VS Code Git 扩展](https://github.com/microsoft/vscode/tree/main/extensions/git)：参考仓库状态、暂存区与工作区分离、显式操作的组织方式。VS Code 源码采用 [MIT](https://github.com/microsoft/vscode/blob/main/LICENSE.txt)。扩展依赖 VS Code API，不适合直接装入 DSH。
- [vscode-hg](https://github.com/mrcrowl/vscode-hg)：MIT；已有 Mercurial 跟踪、提交、更新、远端及分支/bookmark 操作。参考 Hg 的语义区别，同样不能直接嵌入 DSH 插件系统。
- [GitButler](https://github.com/gitbutlerapp/gitbutler)：可参考界面，但其 Fair Source 授权不等同于 MIT 开源许可。本实现没有复制该项目代码或素材。
- [Git status 官方文档](https://git-scm.com/docs/git-status)及 [Mercurial status](https://www.mercurial-scm.org/help/commands/status)、[branches](https://www.mercurial-scm.org/help/commands/branches)：命令与机器可读输出依据。

本插件使用自己的 DSH Cordis Host/Client 实现，只借鉴交互组织。用户提供的 Codex / Zcode 截图用于颜色、留白、圆角、仓库分组与分支搜索布局参考；无图片素材或品牌资源复制。

## 实现与验证

`service.ts` 管理可信仓库枚举、原生 CLI 适配、状态快照及写入队列；`process.ts` 管理命令超时、输出限制与取消；`index.ts` 注册认证边界内的 HTTP 路由；客户端以公共插槽注册可卸载入口。

测试使用系统临时目录内新建的 Git/Hg 仓库和本地远端，不提交、推送或修改用户项目。Hg 测试需要可用的 `hg` 或显式环境变量 `DSH_TEST_HG`；显式指定却无法启动时测试失败，不会静默跳过。无 Hg 的普通环境会明确跳过 Hg 套件。

```powershell
$env:DSH_TEST_HG = 'C:/path/to/hg.exe'
node scripts/test.mjs packages/source-control
npm run check
npm run test:original
node scripts/preview-source-control.mjs
```

最后一条生成 `.build/vcs-preview/index.html`：使用真实 React 面板、固定示例数据的可交互预览，写入禁用。开发宿主已安装 Playwright/Chromium 时可追加 `--screenshot`，检查桌面、分支搜索、图谱及 390px 窄屏并输出 PNG。

2026-10-18 验证结果：

- 最终 `npm run check`：21 个测试文件、110 项测试通过；严格类型、构建、5 个包的打包与真实 DSH CLI 隔离 profile 组合检查通过。
- 原版 DSH `639ed01539`：108 项全量测试通过，随后新增的 2 项 Host/Client 生命周期测试单独复核通过。公共工具栏与设置插槽重复启停后无残留。
- Windows Git 与仓库内隔离的 Mercurial 7.2.4：真实暂存/跟踪、提交、分支、获取、本地远端推送、重放拒绝、Git hook 进程树取消通过。
- Chromium：实际 React 面板的桌面、分支搜索、真实父节点图谱和 390px 窄屏无横向溢出；预览数据为固定示例，未对用户仓库执行写操作。
- 后续已按用户明确要求安装到运行中的官方 Desktop，并完成实际宿主及页面验收，见 [官方桌面验收记录](official-desktop-acceptance.md)。真实远程认证、Git 签名交互、原生 Electron 窗口操控和其他操作系统尚未验收。

最终包的大小和 SHA-256 见 `dist/manifest.json`；验证日志位于忽略的 `.local/vcs-final-check.log` 与 `.local/vcs-original.log`。
