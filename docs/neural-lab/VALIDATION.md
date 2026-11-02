# Neural Lab 0.1.2 验证记录

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
