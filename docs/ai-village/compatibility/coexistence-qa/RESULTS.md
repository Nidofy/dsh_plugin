# Git / Live2D rc.3 共存 QA 候选

2026-10-26。为 AI Village A6 的三插件原生共存验收，独立复制源码、严格检查并重建两个 **仅限本地隔离 QA** 的候选。本报告不是 Git 或 Live2D 的新正式发行/全面 rc.3 兼容声明，不改变两个正式包的 rc.2 状态，也没有进入 AI Village B 阶段。

## 候选与固定来源

可供原生验收导入的包清单：[manifest.json](manifest.json)。清单中的 `file` 是本机绝对路径，产物位于 `.build/rc3-coexistence/companions-qa-03/artifacts/`。

| 包 | QA版本 | 大小 | SHA-256 |
| --- | --- | ---: | --- |
| @nidofy/dsh-source-control | 0.1.3-rc3-coexistence.qa.1 | 30,641 B | `20fb56cc9fae57dc3c5bef696f3ff30a61150045f0a842bf0c31326b46298e66` |
| @nidofy/dsh-live2d | 0.1.2-rc3-coexistence.qa.1 | 1,434,229 B | `5239666fb905a31b4148abaac3dd92376830c173de3b1b203920747b1336cd63` |

- DSH `0.2.1-rc.3`，官方源码提交 `1f81c047fc48fa190a683e469daa699857e9afe8`，归档 SHA `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。
- 复用冻结的官方 rc.3 runtime，锁 SHA `cb921ac43ecb67ddf6a9aea667b362848a7b8d5795a1bc2d7686db1eee7c6ba9`，未改变 AI Village pre5 的依赖身份。
- Git 声明的 `dsh-client-ui-primitives` 不在官方dsh的传递依赖中；严格预检拒绝回落到rc.2后，用单独 `tools/rc3-coexistence-deps` 锁精确安装其rc.3公开包，仅作为QA peer依据。该小overlay锁 SHA `d9e4d759affb0c6e7561b89aecb0e43723fb7962438b05d1b5dc58223fbcae27`；安装禁用lifecycle脚本，没有修改任何宿主权限。
- 测试所用source-ui依赖锁 SHA `dcacb3b3003919f5d7f6e1fbe75a2470f85135c3a1868d7e894570931e887a9c`。Node24.16.0 / TypeScript6.0.3 / tsdown0.22.2 / Vitest4.1.8。
- Git15份、Live2D14份源码逐hash等于正式源码；未修改运行源码，只在新stage生成明确QA版本、rc.3 peers、`private: true`和本地QA说明。Host/Client/Frame与类型声明由源码重建，未复制旧lib冒充rc.3构建。Live2D固定资源闭包逐hash验证，原角色/SDK授权范围不变，不增加分发权限。
- manifest保存源码/测试源码/全部包文件/各bundle的hash、实际peer版本与路径、构建工具版本、五个构建及解析脚本hash。运行代码未带入staging绝对路径或本地依赖协议。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 官方源码严格Host/Client类型 | 两包四组PASS；Git Host5/Client10，Live2D Host3/Client+Frame11；strict、noUncheckedIndexedAccess、exactOptionalPropertyTypes、noImplicitOverride均开启。检查插件自有源码，不把上游整个仓库宣称重新通过。 |
| 新输出及公共声明 | PASS；Host动态导入、插件name/inject及各exports文件存在性通过，客户端按DSH模块加载器封装，Live2D包含新frame.js。 |
| 原样行为回归 | **14测试文件，36通过，0失败，2跳过**，31.49秒；[原始JSON](tests.json) / [日志](build-and-tests.log)。JSON的16 suites包含describe分组，不等于16文件。 |
| Git覆盖 | 临时Git仓库的修订冲突、中文/特殊路径、暂存提交、分支、本地远端推送/获取、关联worktree、忽略文件保护、嵌套仓库边界、自有hook树取消；HTTP、生命周期、UI审阅确认、项目选择、launcher/浮窗清理。没有对用户仓库执行测试写操作。 |
| Live2D覆盖 | 资源闭包、路径/请求拒绝、卸载/重启、取消请求、bridge/静态回退、面板、launcher/浮窗生命周期。 |
| Hg | 本机PATH未提供Mercurial，原测试的两项Hg集成用例跳过；没有将其改成PASS。本轮用于Git共存资格，不声明新的Hg发行验收。 |
| Desktop / 三插件协调 | 本构建任务未启动Desktop；交由独立原生验收执行，结果另列。 |

测试使用复制到stage的原测试文件与源码，单worker；官方imports沿用固定rc.3源码解析，测试的临时仓库限于该stage的tmp子目录。没有删除/跳过失败用例来取得PASS。

## 正式rc.2文件保留

构建前后对正式 manifests、README、src、lib、已有两tgz和dist/manifest逐hash比较，完全相同。[before](protected-before.json) / [after](protected-after.json) / [断言结果](preservation.json)。

| 原件 | 前后不变的SHA-256 |
| --- | --- |
| source-control/package.json | `598f0985785bfa88dee1240717d336a3350cee7b084950efd6faef7266cf946f` |
| live2d/package.json | `be451aa94c4b603c23b0986b86dd3ceec9ca1b3304c60f16d807779c3afc5c4f` |
| dist/nidofy-dsh-source-control-0.1.3.tgz | `24234212d385d6108ddde7b1f478cb24b0ae7891144bab5e371c89c267bb0f7e` |
| dist/nidofy-dsh-live2d-0.1.2.tgz | `88ed6b045aa2a718dd6ed25df407b0bbf1d9e81b5e1610bd5496f5bf6e517fd7` |

包内README明确首段为local QA / 仅AI Village组合范围；旧README作为标注的历史rc.2使用说明保留，没有将原说明直接改标题冒称正式rc.3发行。

## 保留的失败与清理

`companions-qa-01`预检因缺少独立rc.3 ui-primitives peer而失败，未打包；[失败记录](qa01-failure.json)保留。补独立overlay后使用全新stage。

`companions-qa-02`在工具受限沙箱执行，严格类型和重建通过，但Git hook取消测试的teardown遇到临时目录EBUSY：35通过/1失败/2跳过，hook进程未完整释放。该表现与工具沙箱的进程查询/终止限制一致：本次查询遇到拒绝访问，后续清理时也观察到不同权限身份只能终止部分进程；首次测试中的taskkill输出未采集，不声称已直接记录其错误码。该轮未输出可交接包，[失败记录](qa02-failure.json)保留。

没有修改正式取消逻辑或降低DSH安全边界。`companions-qa-03`在当前用户正常进程权限下原样复验，Git hook树取消及清理均通过。qa02遗留另按精确mock命令、进程父子链、创建时间与临时ready标记核验：只停止该自有Git/Node，剩余shell退出；记录的四PID均已不存在，旧执行会话退出1。[拥有者记录](qa02-owned-hook-processes.json) / [清理](qa02-cleanup.json)。未终止用户或DSH进程，失败临时目录与证据保留。

## 复验入口

```powershell
node scripts/rc3-coexistence-prepare.mjs
node scripts/rc3-coexistence-build.mjs <新的小写QA标签>
```

现有stage不可覆盖。Windows取消进程树用例需要正常用户的进程查询/终止权限；这不要求管理员，也不更改宿主的权限配置。QA候选仅用于已授权隔离profile，不能发布npm或替换正式rc.2产物。
