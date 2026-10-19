# DSH Windows Sandbox Enhanced — 实施与验收记录

## 当前交付边界

日期：2026-10-18。用户同意先完成本机可实施部分，隔离实机验收待环境就绪。

这是 **0.1.0-alpha.1 诊断与安全基础设施预览**，不是完整沙箱产品。
Windows 隔离执行后端、真实文件回写、Terminal/PTC 传输、外部 Agent
适配及可执行 ACL 恢复尚未实现。不能把这些项目仅描述为“代码已完成、待验收”。

- 目标：官方 DeepSeek Harness `dsh-v0.2.1-rc.2`。
- 官方 revision：`687f282e8625c6b8d11ff58211a90524be2e4317`。
- 官方 codeload 归档 SHA-256：`157903b22c2881d3678d846755afe957a48df834e747deda805a1195ce25a146`。
- 本机：Windows 11 Home / 10.0.26200，x64；Node 24.16.0；.NET 8 runtime。
- Windows Sandbox 程序不存在，未发现 Hyper-V 管理模块；`vmcompute` 运行本身不证明存在可用 Windows 客体。
- 本机已安装的 DSH 是 0.2.0-rc.2。两个新包明确要求 0.2.1-rc.2，**未安装到正在使用的 Desktop**，不要使用版本豁免强行安装。
- 未修改官方安装程序、Electron、真实 DSH_HOME 或用户工作区 ACL。

## 包及能力

| 包 | 当前作用 | 不提供的能力 |
| --- | --- | --- |
| `@dsh-extensions/windows-sandbox-enhanced` | 官方 Settings 插槽中的中英文诊断界面；按可信 roots 配置只读扫描；CLI；恢复计划；日志和生命周期库 | 不替换现有沙箱，不修复权限，不提供隔离执行 |
| `@dsh-extensions/windows-sandbox-guard` | 可选测试 profile 的拒绝执行服务，替换 sandbox/subprocess/fs | 不是功能可用的沙箱；文件读取也拒绝；不约束直接调用 Node API 的受信 Host 插件 |

诊断 UI 始终显示“隔离未启用”。没有绿色“安全”状态，没有 full-access fallback。
启用 guard 后，经这三个官方服务的调用会得到 `SANDBOX_UNAVAILABLE`。
已经运行的旧 Provider 子进程不能被新 guard 追溯限制，必须在静止 profile 中重启验证。

## 本轮实际实现

1. .NET Windows 原生只读 helper：通过文件句柄获取安全描述符、对象身份、Low IL、继承标志、硬链接数量、重解析点和祖先目录状态。仅请求 owner/group/DACL/label，不请求审计 SACL。
2. 输入拒绝 UNC、设备路径、ADS、DOS 设备名、路径上跳等；helper 检查最终路径，对别名或竞态拒绝扫描，不遍历 junction。
3. 扫描对象数、输出大小、执行时间和 HTTP 请求体均有限制；不完整扫描保留明确状态。
4. helper 和 DLL 等运行文件的 SHA-256 检查；不通过 shell 拼接执行命令。校验和不是签名，也不防御拥有同一用户权限的恶意本机软件。
5. 同源 JSON POST、可信配置中的 roots 索引授权；HTTP 不接受任意文件路径，也没有恢复 ACL 的写接口。
6. 单实例扫描串行、请求取消、连接切换后的 UI 失效处理、卸载等待在途任务退出。
7. 恢复计划比较对象身份、权限快照、所有者、祖先、硬链接与扫描完整性。没有可信原始快照时只标记待人工审查，**所有计划的 executable 都是 false**。
8. 生命周期协调库：停止准入、等待清理、清理失败保留失败状态。
9. 协作式跨进程独占 ledger：`wx` 锁、序列化 append、fsync、哈希链；不依赖 PID/时间自动抢占遗留锁。它是恢复基础库，尚未用于授权真实执行或权限修改。
10. 独立构建、打包、官方固定源码运行测试，以及解压包到临时 profile 的官方组合器和 CLI 冒烟验证。

原生 helper **没有** SetSecurityInfo、递归 ACL reset 或命令执行接口。
扫描未发现 Low 标签，也不能推出不存在越权、过去污染或其他沙箱问题。

## 构建与验证

现有其他插件继续使用原有 0.2.0 流程；新包走独立验证通道，不修改它们的兼容基线。

```powershell
$env:DSH_SANDBOX_ARCHIVE = '<官方固定 revision 的 codeload tar.gz 路径>'
npm run sandbox:prepare
npm run sandbox:check
```

`prepare` 先检查归档 SHA-256，再在 `.build/sandbox-enhanced/official` 解压官方源码。
测试里的 DSH/Cordis 源码别名来自这个副本。开发机已安装的第三方依赖仅用作依赖解析，
不复制或打包 Nidofy/Desktop 源码。常规声明生成使用当前工作区已安装的类型；
官方版本行为兼容由固定源码的运行测试验证，尚不能代替完整官方发布环境的端到端检查。

新 helper 是 framework-dependent 的 x64 程序，需 .NET 8 runtime；没有下载器、系统服务、驱动或管理员安装脚本。
当前不宣称 ARM64 或无 .NET 环境已支持。原生二进制尚未 Authenticode 签名。

输出：

- `dist/dsh-extensions-windows-sandbox-enhanced-0.1.0-alpha.1.tgz`
- `dist/dsh-extensions-windows-sandbox-guard-0.1.0-alpha.1.tgz`
- `dist/windows-sandbox-manifest.json`
- `.build/sandbox-enhanced/tests.json`
- `.build/sandbox-enhanced/packed-tests.json`

测试报告中的 skipped/todo 不能计为通过。

## 安装预览包

仅在专用 **官方 0.2.1-rc.2** 测试 profile 中，通过 Plugins 安装本地 tgz。
在诊断插件配置中显式设置 `roots`；默认空列表不会遍历磁盘或自动扫描用户项目。
这一步本轮未在真实官方 Desktop GUI 执行，仅验证了官方 profile 组合器能读取安装包。

需要验证拒绝路径时另装 guard。其卸载/禁用会移除补丁并可能恢复官方 ACL Provider，
不能继续显示“受保护”。不热更新正在执行任务的 profile。
第三方包的通用一键更新入口不能假定存在；预览版在停止的测试 profile 中更换指定版本并重启。

## CLI

解压包后可用 Node 直接调用（同样需要 .NET 8 runtime）：

```powershell
node <包目录>/lib/cli.js doctor
node <包目录>/lib/cli.js scan 'D:\专用测试项目' --out before.json
node <包目录>/lib/cli.js scan 'D:\专用测试项目' --out after.json
node <包目录>/lib/cli.js recovery-plan before.json after.json --out plan.json
```

`--out` 使用排他新建，拒绝覆盖已有快照。CLI 没有 `apply` / `restore` / `reset`。
快照包含本机路径和安全属性，仅保存在调用者明确指定的位置，不上传。

## 实际测试结果及限制

本轮基础测试 36 项通过；打包/临时 profile 冒烟测试 1 项通过。
其中原生 Windows 运行测试覆盖只读不变性、junction 不跟随、硬链接识别、扫描上限、hash 不匹配和预先取消。

Low IL 造样：仅对新建 `.build/sandbox-enhanced/fixtures/audit-*` 测试目录调用
`icacls /setintegritylevel (OI)(CI)L`，Windows 返回拒绝访问。该项明确 skipped，
没有修改用户项目权限，没有通过提权或修改父目录来绕过失败。
严格验收使用 `DSH_SANDBOX_REQUIRE_LABEL_TEST=1`，此时同一失败必须使测试失败，不能跳过。

下列 8 项明确 todo：

1. 客体 EXE 写私有 Temp/AppData、宿主导出完整性。
2. 父目录 FILE_DELETE_CHILD 删除逃逸。
3. 符号链接、硬链接、重解析点竞态下的回写安全。
4. Terminal / PTC 控制通道和策略切换。
5. Host、worker、broker 异常退出的全进程树回收。
6. 外部子 Agent 与全部执行入口的负向测试。
7. Desktop 文件界面与隔离文件视图一致性。
8. 真实 Plugins 页面安装、更新、禁用、卸载生命周期。

## 继续实施的门槛与任务

需要一台可还原、明确不含个人凭据的 Windows 客体及可信的管理通道。
本机具有虚拟化相关服务并不等于已经满足该条件。

后续需实现：

- 独立 Windows worker 和受信代理的身份认证、版本协商、租约、流控、全进程树管理。
- 不含宿主可写映射的工作区副本及 SDK/缓存配置。
- 配套 fs/subprocess/sandbox Provider 和受限模式的准入检查；禁止不受控全权限绕过。
- 原生基于句柄的文件回写、CAS 冲突处理、受保护部署目录、秘密与网络策略。
- 权限恢复的持久化原始基线、对象所有权证据、逐项审批与异常恢复；当前只提供计划。
- Terminal、PTC、内部与外部子 Agent、Desktop 文件视图逐项接入和测试。
- 并发父子工作区与多个实例的授权协调，不能把当前 ledger 锁等同于已经实现这些功能。
- 真实官方 Desktop 安装生命周期验收和签名发布。

上述未完成项通过之前，不发布稳定版本、不安装进生产 profile、不宣称已修复 Low IL。
