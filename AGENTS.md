# DSH 插件开发仓库

本仓库是独立 DSH 插件的源码所有者。使用中文与用户沟通。先读 README.md 和 docs/architecture.md。

## 边界

- packages/source-control 是独立 Git/Hg 面板。只通过已认证的 connection/request 和公开客户端插槽接入；仓库命令只能在已登记的可信根目录执行。版本控制测试使用临时仓库/本地远端，不对用户项目执行提交、分支切换或推送。

- packages/desktop-pets 是桌宠插件；packages/working-notebook 是 notebook 插件；packages/plugin-shared 仅提供共享库；packages/runtime-adapter 为原版 DSH 提供完整 notebook 所需的 JSONL 与摘要扩展。
- 插件通过 Cordis 服务、事件和可撤销的注册扩展 DSH，不复制 Agent Loop。runtime-adapter 提取并维护现有 JSONL provider 的代际保护扩展，替代原 provider，不能同时运行两个 writer；压缩事务继承官方 BasicCompactionEngine。
- Electron 窗口权限在 desktop-pets/electron 适配器中；Host 插件不能直接创建原生窗口。
- 开发时通过 DSH_SOURCE 指定兼容的 DSH 源码目录；发布产物不得包含绝对开发路径、workspace:、link: 或 file: 依赖。
- 不自动发布 npm、不创建远端仓库、不改用户的实际 DSH_HOME；安装验证使用临时 profile。

## 数据与生命周期

- 保留现有 nidofy-extras 数据目录和版本格式。不能删除或重置笔记、设置、历史或资源包来绕过迁移错误。
- 所有注册都由 ctx.on/ctx.effect 管理。卸载须取消并等待在途任务；重复启停不能累积监听器或窗口。
- 配置、HTTP、磁盘文件等外部输入须校验；设置和笔记写入保留修订校验。结果不确定时读取，不自动重放写入。
- 不提交密钥、真实会话、用户笔记、node_modules 或生成包。

## 开发与验证

- Node 24+、ESM、严格 TypeScript。跨包使用包名，包内使用相对 .ts 引用。
- UI 文案提供中英文；不能将不可信文本拼成可执行 HTML。
- 修改后运行相关行为测试、类型检查、构建和打包校验；涉及笔记格式、卸载、IPC 或路径访问时增加相应回归测试。
- 以当前工作区为准，保留用户未提交修改。只在本仓库管理插件源码；改 desktop 接入时缩小改动范围。
- Git 默认分支 main；功能分支使用 codex/ 前缀。提交前检查 git diff --check，报告实际运行的验证和未覆盖部分。
