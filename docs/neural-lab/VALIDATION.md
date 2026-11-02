# 0.5.0 验收 · 2026-11-02

工作树 .worktrees/neural-lab，源码提交 6755316f446fa4fdc9a734751d61041d83089d87。官方 DSH 0.2.1-rc.5，源码 revision b830ec950faba0a46dda564be3e2d854afed94f1；Node 24.16.0，CPU 镜像 sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7。

| 门禁 | 本次证据 |
|---|---|
| 构建与单元行为 | npm test 完成 strict TypeScript、Host/Client 构建及 14 项测试。覆盖 SQLite、生命周期、输入身份、矩阵轴、非有限数、长度上限与配置。 |
| 全课程及工作台 | 最终源码副本执行 tests/runner-real.ts，29 个可运行活动的参考解通过，23 个未完成代码模板均被拒绝，两个既有实验的固定种子重跑一致。NEURAL_UI_CPU=1 执行 tests/ui-check.mjs 共 26 项通过，0 pageerror。 |
| 新项目真实数值 | tests/projects-real.ts 通过 3 份参考实现，拒绝 9 个定向错误，包括固定两头、错误移位、未来泄漏、错残差、断开梯度、跳过更新、跨切分取窗、错误标准差和非因果预测。两个字符项目各自还需通过 B=1/T=2/H=1 的额外探针。信号的训练进程只接收训练批次，冻结权重后再在独立学生进程评估留出输入。 |
| 项目学习与复现 | tests/project-ui.mjs 在两个独立 HTTP/SQLite/Docker profile 中实际操作浏览器。验证组件复用、来源 runId、三头变式、延后到期时间、解释草稿恢复、仅完成选中运行的复习。热图单元格数值与相同身份的 SQLite 产物一致，错误 hash 查询被拒；P95 仅改变色阶，Alt+E 返回编辑器。640px 空 profile 预览／载入后运行数为 0，显式重跑后与原运行结果匹配。篡改代码被拒，0 pageerror。 |
| 既有运行协议 | 0.5 开发周期内重新执行 training-real.ts 的 28 次可编辑 MLP／字符训练，runner-parameters.ts 的 33 个参数用例，runner-adversarial.ts 的 18 个错解／攻击及取消和超时。runner-lifecycle.ts 验证运行中卸载、分阶段取消与镜像 retag，无本次残留容器。 |
| 离线安装／升级 | npm pack --ignore-scripts、tests/install-check.mjs、tests/upgrade-020.mjs 通过。用空缓存、临时 profile 核对安装内容；从 0.1.2 经 0.1.3、0.2.0、0.2.1、0.2.2 升至 0.5.0，旧草稿、运行及解释保留。升级测试的训练历史为合成夹具。 |
| 官方 Web | NEURAL_UI_CPU=1、NEURAL_WITH_LEARN=1、npm_config_offline=true 执行 tests/ui-official-session.mjs。最终包实际侧栏挂载、认证 RPC、四尺寸、Learn 共存、MLP／单文件 Transformer 和三模型振动项目均通过，振动 run 为 f38405ae-9591-4635-a2f4-30e01e3423f7。0 pageerror；服务停止，临时 profile 清理。 |
| 官方 Electron | 指定官方可执行文件执行 tests/native-022.mjs。独立 desktop profile 安装同一包，运行 CPU 练习、切课、重启后恢复原代码和同一 run。随后在可见编辑器运行三头项目并读取 head2 的实际矩阵；项目 run 为 ea1588e2-a2de-4320-b818-c76549ebf05d。 |

跨 profile 来源运行 e50a38d4-5c63-46f7-a3d8-7f80b13d9320，复现运行 394031a1-e644-4f41-9684-7bbe8f63ea77。14 个组件的完整提交 SHA-256 为 d75090acf9bf2650291cf93abf86e4c3335fc543bab02d9760a1d0bb5607e17c，两次独立输出摘要为 9e6edcb4e0939ce709d7433f120874b768aeead7d25ca736c1331e3875a78ac1。界面明确比较 seed、学习率、镜像、协议、数据／初值／批次摘要、源码和实际结果。

最终包 108100 字节，SHA-256 为 e37c101e06c85ac0f77d718bbe75b7b5086a3481e3f5fa4e5936a7ca73347f83。两个独立干净 sparse checkout 重建哈希均与最终离线安装、官方 Web、Electron 的实际归档相同。数值门禁使用本地真实 Docker CPU；按既定约定，导师只验收官方无模型路径和测试替身。所有安装、导入和数据回归均在隔离环境完成。

# 0.2.2 验收 · 2026-11-02

实现提交 d430f46ccb61c7b3e177ad6177aeeb80424dbd39，固定官方 DSH rc.5 源码 b830ec950faba0a46dda564be3e2d854afed94f1。Windows、Node 24.16.0、npm 11.13.0、Docker 29.9.2。CPU 镜像 ID 与下方 0.2.1 记录相同。命令从 packages/neural-lab 运行；TS 入口使用 node --experimental-transform-types。开发合并与本地生成包均在 neural-lab 工作树。

| 门禁 | 本次结果 |
|---|---|
| npm test | 严格 TS、Host/Client 构建及 13 项行为测试通过。真实 SQLite/HTTP 覆盖档案 CAS、导师迟到交付、迁移题证据、畸形 Origin。两个同 home 的 profile 独立持有默认数据库；显式旧库导入拒绝活动 owner 和重复覆盖。损坏行报出 ID，文件随后可移动。注入 Docker 清理超时，激活可用，停用保留 pending。 |
| runner-real.ts、runner-parameters.ts、runner-adversarial.ts、runner-lifecycle.ts | 26 个参考解通过，20 个代码 starter 均失败。33 个参数用例覆盖 22 接受与 11 拒绝。18 个错误实现／攻击（含原样复制 L09-code 到迁移题）被拒，另测 timed_out 与 cancelled。创建／快照阶段取消、卸载、镜像重打标签均无本次残留容器。 |
| training-real.ts | 28 次真实 Docker 运行，覆盖重复种子、改变学习率、导数与参数更新、留出集、因果性与坏组件。两类训练各 10 个定向坏实现被拒，部分组件得分与整题状态独立。数值门禁在忽略目录内的源码副本执行，保留已有版本证据。 |
| NEURAL_UI_CPU=1 node tests/ui-check.mjs | 独立 Chromium + HTTP/SQLite/Docker 共 26 项、0 pageerror。档案延迟确认 A 时继续写 B/C；刷新恢复本地稿、远端不同字段更新后显式合并，两字段均保留。还验证改学习率出现旧快照提示、改回后解除、四尺寸滚动和训练对照。 |
| npm pack --ignore-scripts；node tests/install-check.mjs；node tests/upgrade-020.mjs | 94370 字节，SHA-256 为 5353874ee5586ef8107951eca9673be700c0fb65dee4e061dfc21cc3a095d144。两个独立干净 sparse checkout 分别构建，两个包与交付哈希完全相同。空缓存离线安装及已安装内容身份一致。从 0.1.2 写入草稿后，经 0.1.3、0.2.0、0.2.1 至 0.2.2，草稿及后续版本的档案、帮助、解释、复习记录保留。升级中的历史训练 run 使用夹具。 |
| NEURAL_UI_CPU=1、NEURAL_WITH_LEARN=1、npm_config_offline=true，node tests/ui-official-session.mjs | 官方 Web 安装同一哈希候选包、认证 RPC、CPU Attention、MLP 与字符模型训练、双运行对照、复习、四尺寸、Learn 0.5.2 共存与卸载通过。官方 MLP run 为 1159eb97-c8df-4692-b664-3dc51cc7743c 和 9f7aaaed-d2ca-4d70-adbe-3ec3d18b9f2e；字符模型 run 为 225807ed-18c0-4840-974d-4a2a79c39dcf 和 9e77f292-8497-4280-946f-8732a5da2795。0 pageerror，临时 profile 与服务清理完成。 |
| 设置 NEURAL_DESKTOP_EXE 为官方可执行文件后运行 node tests/native-022.mjs | 核对官方 CLI 为 0.2.1-rc.5，使用独立临时 DSH_HOME、Electron userData、desktop profile，安装同一 SHA 的包。可见编辑器提交 L01，Docker CPU 通过（run 8a4a36cf-4715-463b-a025-bbf20b547195），切课、退出整个 Electron 再启动，原代码和同一 run 恢复。 |

本次导师验收覆盖未配置模型时的实际官方界面，以及显式测试替身的两轮上下文、成功／失败／取消、跨尝试迟到答复。按本次指定范围，真实供应商成功调用不列入验收。所有用户数据测试使用临时目录。归档与安装身份见 [artifact.json](artifact.json)，历史发行包的既有哈希保留在下文。

# Neural Lab 0.2.1 验证记录 · 2026-11-02

本轮验证最终 0.2.1 工作树和本地归档。主机为 Windows、Node 24，官方 DSH 0.2.1-rc.5 固定提交 b830ec950faba0a46dda564be3e2d854afed94f1。真实 Docker CPU 镜像 sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7。运行以下命令时工作目录为 packages/neural-lab，TypeScript 测试脚本使用 node --experimental-transform-types。

| 门禁 | 本轮实测 |
| --- | --- |
| npm test | 构建检查固定宿主与 strict TS，11 项行为测试通过。目录校验 12 节课、38 项活动。 |
| tests/training-real.ts | 两条可编辑任务共 28 次真实 Docker 执行。Transformer 参考解通过，重跑的四个验证损失和逐字符样本完全一致；改变学习率后曲线改变，数据与初始参数摘要一致。只完成 shifted 时单项通过、整题失败。另有十个定向错误解全部失败，包括未移位、遗漏位置、看见未来、批次串扰、缩放错误、拼头错误、输入或 Q 梯度断开、错误 Pre-LN、缺 FFN。检查记录在 tests/results/training-021.json。 |
| tests/runner-real.ts | 26 份参考实现通过，20 个代码 starter 按预期失败。Transformer 参考运行 e79422b3-581c-4e77-b554-6077c581c7c5 在 seed 42 下第 1、4 步留出损失分别为 1.652730 和 1.653315。起始 a，含起始字符的采样为 adcbedeaaebbcdebe。完整事件见 tests/results/reference-runs.json。 |
| 既有门禁 | runner-parameters.ts 验证 33 个参数用例；runner-adversarial.ts 验证 17 个反例/攻击以及超时与取消；runner-lifecycle.ts 验证卸载、分阶段取消及镜像标签变化后的容器身份和回收。 |
| 独立浏览器 | NEURAL_UI_CPU=1 node tests/ui-check.mjs 通过 25 项检查，0 pageerror。MLP 与 Transformer 均经可见编辑器完成两次训练，对照代码、参数和四条实际曲线，查看旧运行并提交解释、完成复习。四尺寸、草稿和原实验同时回归。 |
| 安装和升级 | npm pack --ignore-scripts --cache .build/npm-cache 后运行 node tests/install-check.mjs，官方空缓存离线安装及发布文件身份通过。node tests/upgrade-020.mjs 用真实 tgz 逐次从 0.1.3 打开至 0.2.0、0.2.1，核对旧 SQLite 数据。升级前 MLP 运行、预测和解释使用合成夹具。 |
| 官方 Web | NEURAL_WITH_LEARN=1、NEURAL_UI_CPU=1、npm_config_offline=true 运行 node tests/ui-official-session.mjs。在临时 profile 经认证 RPC 提交 MLP 和 Transformer，验证采样、对照、解释和复习，Learn 0.5.2 共存和官方卸载。证据位于 .build/ui/official-training.json 和 official-validation.json，含实际 runId 与安装哈希，服务和临时 profile 已清理。 |

归档共 90069 字节，SHA256 为 `74698870d9820217d71bcaebb4e913aa51153cc507e9b06f443585bcc7dd9b9b`。原生 Electron GUI 和真实模型导师成功回答本轮未验证。

# Neural Lab 0.2.0 验证记录 · 2026-11-02

0.2.0 插件与课包，37 项活动。可编辑训练检查版本 1，既有活动检查版本 3。Windows、Node 24.16.0、DSH rc.5 固定提交 b830ec950faba0a46dda564be3e2d854afed94f1。以下为本轮实测。命令从 packages/neural-lab 执行，runner 与 training-real 的 .ts 脚本使用 node --experimental-transform-types。

| 验收 | 实际结果 |
| --- | --- |
| 严格构建与行为 | npm test 校验固定宿主及 strict TypeScript，11 项扩充测试通过。真实 HTTP 测试覆盖缺预测、非法学习率、跨活动 runId 被拒绝，以及解释的 answerId/runId、程序通过状态、复习完成冷开和导出。该组运行记录为合成数据。 |
| 新协议的真实 CPU | tests/training-real.ts 在实际 Docker 镜像中执行 14 次。参考解、固定种子复现、只改学习率、换种子四次正确通过。固定种子重跑曲线完全相同，学习率从 0.05 改成 0.2 时曲线改变且数据与初始参数摘要相同。 |
| 十份错误训练代码 | 漏 zero_grad、漏 backward、漏 step、错误损失函数、硬编码返回值、错误验证输入、验证时改权重、验证时启用梯度、验证时用 train 模式、实际缓存最后一个训练批次替代留出集，均返回 completed/failed。逐项检查名称和 runId 在 tests/results/training-020.json。 |
| 全课程和沙盒 | tests/runner-real.ts 的 25 份参考解通过、19 个代码 starter 检查失败。tests/runner-parameters.ts 验证既有 33 次参数门禁。tests/runner-adversarial.ts 验证 17 个反例/攻击以及 timeout/cancel。tests/runner-lifecycle.ts 验证卸载运行中容器、三个取消时点和标签变化，按 runId 查无残留。 |
| 浏览器 | NEURAL_UI_CPU=1 node tests/ui-check.mjs 的 24 项检查通过，0 pageerror。2 次真实训练经可见编辑器提交，对照面板核对实际 ID、代码差异和四条程序曲线。查看旧运行、提交解释、在记录页定位运行、从复习项返回并完成。草稿冲突、四尺寸滚动及旧引导实验同时回归。 |
| 安装及宿主 | npm pack --ignore-scripts --cache .build/npm-cache；node tests/install-check.mjs 验证临时空缓存离线安装和发布输入。设置 NEURAL_UI_CPU=1、NEURAL_WITH_LEARN=1、npm_config_offline=true 运行 node tests/ui-official-session.mjs，通过官方认证 RPC 完成两次可编辑训练、对照、解释和复习，Learn 0.5.2 共存并通过官方 CLI 卸载。官方运行 ID 见 .build/ui/official-training.json，安装身份与临时环境清理见 .build/ui/official-validation.json。 |
| 跨版本数据 | node tests/upgrade-020.mjs 取本地两个实际 tgz 的 Host 与课程文件。用 0.1.3 写入隔离数据根，冷开 0.2.0 后比对原工作区、草稿、笔记、作答、帮助、学习档案、证据与复习，新训练草稿修订从 0 开始。 |

安装包 84403 字节，SHA256 `e8ca32a13b07a039eda8d3ec65092c40434e462044c1e7988b52971ad8b8d7fd`。可在 DSH 插件管理器安装；升级/回退见插件 README。真实模型成功调用及原生 Electron GUI 本轮未验证。自评解释和复习完成记录不授予额外程序通过。0.2.x 的微型 Transformer 组装仍按 NEXT_PHASE 推进。

# Neural Lab 0.1.3 验证记录 · 2026-11-02

环境为 Windows、Node 24.16.0、官方 DSH 0.2.1-rc.5，固定源码 b830ec950faba0a46dda564be3e2d854afed94f1。Docker 29.9.2，CPU 镜像身份 sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7。以下命令从插件包目录运行。

| 门禁 | 本轮结果 |
| --- | --- |
| 基线与严格构建 | 修改前 npm test 的 11 项通过。修改后 npm test 先运行 build.mjs 校验宿主 revision 和 strict TS，再运行 11 项扩充后的测试。 |
| 保存与异步界面 | NEURAL_UI_CPU=1 node tests/ui-check.mjs 使用独立 Chromium、真实 RPC/SQLite 与 Docker。分别扣住代码、笔记的 A 请求，随后输入 B、C。SQLite 修订增加 2，刷新后读到 C。单独的 node tests/ui-check.mjs 还在扣住真实保存回执时验证刷新、切课、恢复历史。两个浏览器页面形成修订冲突，本地文本可在重开后明确提交。延迟导师响应期间可换页签并保留下一问题。运行完成时档案未保存输入保留，记录页显示终态。1366/1920/900/640 四尺寸滚动和锚点通过。 |
| 数值与参数 | runner-real.ts 验证 24 份参考、18 个未完成/错误 starter，MLP 与 LM 做同种子重跑。runner-parameters.ts 验证 33 次参数运行。runner-adversarial.ts 验证 17 个反例/攻击及超时与取消，含固定 Softmax、忽略 heads、子进程脱离进程组并占用输出管道。三个脚本均使用 node --experimental-transform-types 与真实 Docker，详情在 tests/results。 |
| 容器身份与清理 | node --experimental-transform-types tests/runner-lifecycle.ts 对真实 Docker 命令注入取消时点。在环境检查、写快照阶段及创建操作中取消，并卸载已启动长任务，按 runId 查询均无残留。改变临时镜像标签后检查实际 create 参数仍为原镜像 ID，参考解通过。 |
| 导师与证据 | host.test.mjs 以 stub 捕获实际序列化的导师 payload，核对旧运行 A、当前 B、SHA256、matchesCurrentDraft、前轮消息、失败/取消/busy、unknown 和 answer。真实浏览器验证无模型降级。实验运行生成可回查的 observation，迁移题解释关联 answerId。store.test.ts 校验同一旧格式冷开、原记录与导出无虚构来源。 |
| 官方交付 | npm pack --ignore-scripts --cache .build/npm-cache 后，node tests/install-check.mjs 在临时空 store 离线安装并验证发布文件身份。NEURAL_UI_CPU=1 NEURAL_WITH_LEARN=1 node tests/ui-official-session.mjs 验证官方认证 RPC、四尺寸、Learn 0.5.2 共存、安装包真实 Attention 运行与官方 CLI remove。两个临时 profile 均清理。 |

最终 tgz 77777 字节，SHA256 `263eebc654f4baecc3cec8d56e661fd5af736b80370d5916577655618798fbef`。官方验收证据位于插件 .build/install-result.json 和 .build/ui/official-validation.json。实际用户 DSH_HOME 未参与验收。安装与停用回退见插件 README。

**覆盖边界。** 真实模型成功回答与原生 Electron GUI 为 UNVERIFIED。模型成功、失败与追问取自受控 stub；官方 Web 无模型路径单独实测。旧记录兼容使用构造的 v1 数据与冷开检查。受控取消覆盖正常工作的 Docker daemon；daemon 或整机永久失联时只能记录待确认。0.1.3 采用可跳转的导师区，继续使用各活动现有双语文案；L01 排错题保留与线性层相同的数学契约。0.2.0 可编辑训练协议交付设计，运行实现留待下一阶段。

# Neural Lab 0.1.2 验证记录（历史）

用户报告 0.1.1 本地安装通过。本轮修复课程切换不回顶部、导航与内容共用滚动的问题，发布包版本 0.1.2；课程内容仍为 0.1.1/testVersion2，数据库和运行器未更改。

- 工作台外层固定在宿主提供的高度内，列表和内容分别滚动，包含滚动边界隔离；窄屏上下排列也各自滚动。
- 课程、活动或页签变化时在布局阶段将内容区归零，不改变导航列表位置；普通保存、运行轮询不触发归零。讲义锚点保持局部滚动及宿主 URL hash。
- `node scripts/build.mjs` strict 与构建通过；`npm test` 11 项通过。
- `node tests/ui-check.mjs` 17 项、0 pageerror。新增共享行为回归通过真实 mouse wheel 验证 1366/1920/900/640 四种宽度：两侧独立滚动、边界不串联、换课保留列表位置且内容归零、页签和异步活动切换归零、讲义锚点不改变列表或 hash、无横向溢出。证据 `.build/ui/validation-ui.json` 和 `scroll-*.png`。
- `NEURAL_WITH_LEARN=1 node tests/ui-official-session.mjs`：最终安装包在官方 rc.5 模块加载器与真实认证 RPC 下通过相同四尺寸滚动测试、草稿刷新恢复、提示与无模型降级、Learn0.5.2 共存。发布文件哈希匹配，0 pageerror，测试服务已停止、临时 profile 已删除。证据 `.build/ui/official-validation.json` 与 `official-scroll-*.png`；已人工检查宽屏及窄屏截图。
- `node tests/install-check.mjs`：官方空缓存离线安装、Cordis 生命周期与课程加载、源码构建身份和已安装字节校验通过，临时安装 profile 已删除。

最终包 `packages/neural-lab/dsh-plugin-neural-lab-0.1.2.tgz`，71909 字节，SHA256 `11b440949aba37d849a0363b59d0ff5d3bd5a558af23638a8fae21e8e5233596`。本轮为 UI 修复，没有重复运行未修改的 CPU 数值/沙箱测试；下列 0.1.1 结果保留为历史证据，不冒充本轮重测。原生 Electron GUI 和真实模型成功回答本轮未亲测，未修改实际 DSH_HOME。

# Neural Lab 0.1.1 验证记录（历史）

目标：DSH 0.2.1-rc.5，官方源码 `b830ec950faba0a46dda564be3e2d854afed94f1`。环境：Windows、Node24.16、Docker29.9.2 Linux amd64。CPU镜像沿用已验证的Python3.12.10 / NumPy2.2.6 / PyTorch2.7.1+cpu，身份见包 `scripts/cpu-image/validated-environment.json`。

用户报告0.1.0实际安装通过（user-reported）。本轮自动化验证不能据此冒称新做了原生Electron GUI测试；本轮官方Web结果单独记录。

## 第三方 review 落实与实际验证

| 问题 | 修复与验证 |
| --- | --- |
| configure被默认控件覆盖 | UI只传seed；Host拒绝旧steps/learningRate覆盖；controller不再合并UI参数。真实浏览器MLP从8步/.01改为12步/.02，effectiveConfig和指标实际改变，原记录保持原快照。 |
| 4个实验参数无效 | grad eps、softmax offset/temperature、attention dim/scale、causal perturbation均实际参与计算；MLP/LM steps/lr保留。33次真实CPU参数门禁：22接受、11拒绝，包含默认补齐、类型/有限性/范围、未知键及分别改变lr和steps的同seed数值比较。 |
| 模板化提示/错误 | 36活动按实际任务细化，包括所有advanced/check/debug/实验；结构门禁检查特异文案和配置契约。课包0.1.1、testVersion2，旧历史不改写。 |
| code12宽泛else | code12显式分支；code99实际运行明确失败，不再落入下一token移位题。 |
| code/answer双state | 工作台只维护一份草稿；文字/数值作答、代码历史和答案前未运行快照恢复统一。真实切课/刷新/恢复测试通过；保存挂起期间禁止编辑、重置、重复提交和切活动，Tab/Enter不能绕过只读。 |
| 单点空图/常数曲线 | 单点用含原始值和step的stat卡片；常数多点置于Y轴中心。单独标记的图表fixture验证刻度、坐标与精确值，不冒充用户运行。真实Attention单指标也验证stat显示。 |
| 对比曲线分散 | 同一次运行的loss多系列共享坐标与图例。真实MLP训练/验证、两学习率共4条序列在同图显示。 |
| profile与课标题混淆 | 学习档案为第5页签，选中态明确，不显示局部课程标题；真实浏览器验证。 |
| resize冲突 | 移除aside原生resize；阅读/编辑分栏统一可拖分隔器，支持键盘，窄屏堆叠。鼠标拖动和键盘调整实际验证。 |
| 锚点修改host hash | 改button局部滚动，浏览器断言点击前后URL hash一致。 |
| 编辑器无行号 | 复用MIT Learn textarea/高亮/补全，保留行号、自动缩进、原生撤销；浏览器验证。合成composition事件验证Enter/Tab保护，不声称实测了操作系统输入法。 |
| 压缩源码 | src/runtime/tests恢复标准多行；工作台拆独立组件，导师上下文独立模块。Prettier3.6.2全TS/TSX/CSS/MJS检查通过；Black26.3.1 Python检查通过。CSS单一源，经共享生成器确定性内联。 |
| 临时目录残留 | 数值/参数/反例/UI/安装测试均只清理本次mkdtemp目录，finally中验证realpath边界；保留JSON/截图证据。旧0.1.0审计目录不做无差别清扫。安装测试temporaryProfileRemoved=true，独立Test-Path确认不存在。 |

## 本轮运行的门禁

- `node scripts/build.mjs`：插件全部 TypeScript 对固定rc5源码的 strict 检查通过，真实Host/Client构建完成。build-identity覆盖发布输入，包含CSS、课包、运行器和说明。
- `npm test`：11项通过，包含DAG缺失/循环/重复、参数覆盖拒绝、SQLite CAS/原稿快照/跨进程owner/慢body卸载/外部DB不重置。旧0.1.0运行无effectiveConfig冷打开仍保留原版本和快照。
- `node --experimental-transform-types tests/runner-real.ts`：24参考真实passed，18 starter正确failed；MLP/LM同种子复现。证据 `packages/neural-lab/tests/results/reference-runs.json`。
- `node --experimental-transform-types tests/runner-parameters.ts`：33次参数门禁；证据 `tests/results/parameter-runs.json`。
- `node --experimental-transform-types tests/runner-adversarial.ts`：14反例/攻击正确failed，timeout/cancel状态正确；含4项容器内临时入口与提交的写入/替换/重命名攻击，验证UID65534、root拥有0555目录/0444文件和PermissionError。证据 `tests/results/adversarial-results.json`，全部本轮contentVersion0.1.1/testVersion2。
- `NEURAL_UI_CPU=1 node tests/ui-check.mjs`：14项、0pageerror，真实Engine/HTTP/SQLite/Docker，1366/1920与900/640布局；证据 `.build/ui/validation-cpu.json`。随后编辑/保存并发保护的最终非CPU浏览器回归13项通过，含图表fixture，另存 `validation-ui.json`。
- `node tests/install-check.mjs`：官方rc5空缓存offline/ignore-scripts安装、已安装Cordis启停、12课读取、当前source与installed发布文件哈希全通过；本轮临时profile已删除，证据 `.build/install-result.json`。
- `NEURAL_UI_DEEP=1 NEURAL_UI_CPU=1 NEURAL_WITH_LEARN=1 node tests/ui-official-session.mjs`：最终包在原208字符深安装路径下通过固定rc5官方CLI安装、实际模块加载、认证RPC保存/刷新、预置提示及无模型降级、Host→Docker CPU Attention completed/passed、Learn0.5.2双面板共存；0pageerror，四发布文件哈希匹配。证据 `.build/ui/deep-official-validation.json` 与 `deep-official-cpu-run.json`。临时profile已删除，server已停止。

## Windows 深路径回归

官方联合测试发现208字符安装路径下，容器root可读取Windows只读bind中的student.py，UID65534读取相同文件得到Errno5；短路径成功。诊断与修前记录保留，未通过修改宿主ACL规避。可信控制器现只复制固定启动脚本与提交的字节到容器内root拥有的0555目录、0444文件，再降权运行；不以root导入或执行学生代码。最终同一深路径直接bind诊断仍复现EIO，完整课程运行已通过，证明新加载路径避开此问题。证据 `.build/ui/deep-diagnostic-before-staging.json`、`deep-diagnostic.json`；4项篡改攻击证明普通用户不能改变该快照或跨调用替换入口。

## 产物与边界

本地包 `packages/neural-lab/dsh-plugin-neural-lab-0.1.1.tgz`，71543字节；SHA256 `a1a31220743bb208479da84bfd798d8d4e416f97a1e4238940d1bd3c5bb68e4c`。未推送或发布，未改用户实际DSH_HOME。

真实模型成功答复仍无凭据可验证；无模型/无凭据降级保持。原生Electron外壳本轮未亲测。任意大型学生产物、长任务续训与GPU仍不在本轮范围。升级保留旧草稿，四个非训练实验的旧通用steps/lr键会明确拒绝，需按新版题目修改或主动恢复新starter。
