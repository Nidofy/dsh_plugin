# Neural Lab 0.2.1

面向有 Python 和基础数学经验的神经网络与 Transformer 学习工作台。目标宿主为 **DSH 0.2.1-rc.5**，Node 24+；CPU 优先。左侧课程路线、讲义/练习/实验/记录页签与可折叠导师使用同一内容和 SQLite 数据库。

## L12 组装微型 Transformer

进入 **L12 → 练习 → 组装微型 Transformer**。先固定种子，预测移除因果 mask 会怎样影响前缀 logits。按顺序完成 `shifted`、`embed`、`attention`、`block`、`logits`，每完成一个函数即可运行，检查表会分别显示五个接口的结果。L07 的查表和 L10 的拆头从 NumPy 改用 PyTorch 张量，保持计算图，所有参数均通过传入的 ParameterDict 参与更新。

五字符词表、四维隐藏层、两头、四字符上下文、一层 Pre-LN 和四步 CPU SGD。训练器先划分字符位置，再取窗口；独立控制器验证目标移位、模块输出、未来扰动与 batch 隔离、嵌入输出及参数梯度、每步更新，重算训练和留出集交叉熵。通过后使用本次训练权重逐字符生成 16 个新字符。可改变学习率再次运行，对照四条曲线、两份代码和实际 runId，记录解释并复习。课程共 38 项活动；本版继续使用原 SQLite v1 数据根。

## L04 可编辑 MLP 训练

在 L04 的「练习」页签选择「亲手训练 MLP」。先写预测，设置 seed 与学习率，然后在一个 Python 文件中实现 train_step(model, optimizer, batch) 和 validate(model, batch)。每批清梯度、前向、计算 MSE、反传、更新；验证使用 eval 与 no_grad。程序会连续运行八批，并逐步比较梯度和参数更新。学习者报告的指标带 student 前缀，控制器从返回的参数独立计算训练集与验证集误差。

保持 seed，再改变学习率或代码运行第二次。在「同种子运行对照」里选择 A、B，查看运行 ID、代码差异、实际配置与共享坐标的四条曲线。按自评标准提交该次运行的解释，从复习入口回到预测与结果，完成复习。历史运行、版本、帮助等级、解释及复习事件可导出。原 L04 configure 引导实验仍在「实验」页签。

课包 0.2.0 包含 37 项活动。新协议 train-mlp-v1 的检查版本为 1，原题沿用版本 3。升级使用原数据根和 SQLite v1。回退前停用并冷备份；0.1.3 没有新活动的界面，需重新启用 0.2.0 才能查看其完整学习路径。

## 0.1.3 保存与学习记录

编辑中的代码和笔记有各自的确认修订。当前浏览器标签页在 sessionStorage 暂存未确认文本，按学习数据库和活动分隔；冲突面板可查看远端、下载本地副本并在编辑后重试。导师按模式记录实际交付的帮助，自由问答标为 unknown。运行与当前草稿有独立快照，导师可引用本活动最近八条消息。参数实验计为观察；L09 迁移题另收集解释并提供自评标准。记录页可从新证据跳回运行或文字作答。

SQLite 结构版本仍为 1，课程 0.1.3、检查版本 3。旧记录按原版本展示，历史证据缺失的关联显示为 legacy。回退时先停用插件并备份整个数据根，再安装旧 tgz；需要精确恢复升级前的学习状态时使用升级前冷备份。旧界面对 unknown 帮助及新增证据类型没有专门显示。

## 安装与环境

将构建生成的 `dsh-plugin-neural-lab-0.2.1.tgz` 通过 DSH 插件管理器安装到选定 profile，启用插件，在侧栏打开 Neural Lab。与 `dsh-plugin-learn` 使用不同包名、注册标识和数据根；不包含 LeetCode 搜题、邮件或 Hot100 worker。开发与验收只使用临时 profile，不修改用户实际 DSH_HOME。

CPU 环境单独准备，课程运行不会安装依赖或下载数据：

```powershell
pwsh -File scripts/prepare-image.ps1
```

该脚本构建 `dsh-neural-lab-cpu:0.1`，Python 3.12、NumPy 2.2.6、PyTorch 2.7.1+cpu。基础镜像与全部传递依赖锁定位于 `scripts/cpu-image`。首次准备需要 Docker 和网络；离线机可先 `docker save`，再 `docker load` 导入同一镜像。具体镜像身份和实测环境记录于验证文档。Docker 不可用时界面显示真实错误，讲义、数值题、笔记和预置提示仍可使用；不会自动在宿主执行学生代码。

## 学习路线

L01 张量与广播 → L02 链式法则 → L03 自动微分/梯度累积 → L04 MLP → L05 稳定 Softmax/交叉熵 → L06 优化/泛化 → L07 Embedding/位置 → L08 单头 Attention → L09 因果 mask/批处理 → L10 多头拆合与投影 → L11 完整 Pre-LN block → L12 CPU 微型字符语言模型。

课包包含代码、数值和预测解释题，以及数值梯度、MLP 学习率、Softmax 稳定性、Attention 缩放、因果未来扰动、微型语言模型六个实验。精确活动清单由 `content/catalog.json` 提供，参考解只能通过“完整答案”请求显示并记录帮助。未完成 starter 不应被判通过。

布尔 mask 的统一语义为 `True=允许关注`；教程在调用其他接口时显式转换。Pre-LN 使用先归一化再子层、残差相加；dropout 关闭以便核对。输入域/容差/不支持的边界见各题。数值题采用 `atol=1e-8, rtol=1e-6`；shape/序列文本忽略空白后比较。解释题保留原文，状态为 inconclusive，导师反馈不替代程序判定。

## 工作台与实验参数

沿用 LeetCode 的阅读/编辑双栏操作：课程导航保留在左侧，活动说明在工作区左栏，带行号与高亮的编辑器和真实结果位于右栏。分隔器可拖动或用键盘调整；笔记通过记录页签管理，学习档案是独立页签。章节导航只滚动讲义，不改宿主 URL hash。

课程列表与课程内容独立滚动，滚动到边缘也不会带动另一区域或宿主页面。切换课程、活动或页签后内容回到顶部，课程列表保留当前位置；保存草稿与更新运行结果不会重置阅读位置。窄窗口将导航与内容上下排列，各自保留滚动区域。

`configure()` 是实验参数的唯一来源。省略的键采用对应实验默认值；未知键、非有限数和超范围值会明确失败。运行记录中的“实际采用参数”来自可信控制器，不从编辑器文字猜测。seed 独立于 `configure()`，控制本次运行随机性。

| 实验 | 可配置参数 | 默认值 |
| --- | --- | --- |
| 数值梯度 | `eps`：1–12个差分步长，范围1e-7到0.2 | `[0.1, 0.01, 0.001, 0.0001, 0.00001]` |
| Softmax | `offset`：-10000到10000；`temperature`：0.1到10 | `1000`、`1` |
| Attention | `dim`：2–64整数；`scale`：布尔值 | `8`、`True` |
| 因果扰动 | `perturbation`：0到100 | `10` |
| MLP / 微型语言模型 | `steps`：1–200整数；`lr`：0.0001到1 | `60`、`0.03` |

从0.1.0升级会保留草稿、笔记和运行历史。旧版四个非训练实验的草稿可能仍返回通用 `steps/lr`；新版本会明确拒绝这些无效键，请按上表修改，或主动恢复该活动的新版起始代码，不会自动覆盖旧草稿。

单采样指标显示统计卡片并保留原始数值；同一次运行的多条loss曲线共享坐标轴与图例，便于直接比较学习率和训练/验证误差。旧0.1.0结果没有effectiveConfig时继续显示原始快照，不推断或补造当时参数。

## 运行与记录

每次运行保存内容版本、测试版本、代码/配置快照、环境镜像身份和种子。运行状态与检查状态分别显示；正常退出不等于答案通过。图表从带 runId 的本次指标/张量事件生成。运行在 Host 管理，关闭面板不取消；用户可显式取消。退出插件取消并等待任务，重新启动把未确认结束的任务标记 interrupted。

容器禁用网络、只读根文件系统，学生进程降权运行；可信控制器保留降权所需能力，并限制CPU/内存/PID/时间/输出。独立运行目录只读挂载学生快照；控制器只复制启动脚本与提交字节到容器内受保护的临时目录，再由普通用户加载，避免 Windows 挂载路径在降权后不可读。受控结果由 Host 写回，首版不开放任意学生文件产物。Host配置可设置 timeoutMs（默认120000）、memoryMb（默认1024）、cpus（默认1）、outputBytes（默认262144），种子由运行控件独立指定；实验参数只从编辑器的 `configure()` 返回值读取，UI 不会再覆盖其中的参数。模型仅复用 DSH 默认配置；没有模型时明确显示 unavailable，预置提示继续可用。

数据位于配置 `dataRoot`（安装补丁默认 `dshHomePath('neural-lab')`）：`neural-lab.sqlite` 保存草稿修订、笔记、学习位置、作答、帮助、导师记录、知识点证据和复习；`runs/<runId>` 保存快照与结果；`owner.sqlite` 防止同时启动两个数据 owner。禁止手动复制正在运行的 SQLite 文件作为可靠备份，应先退出插件或使用工作台导出。

导出按钮下载含 schema 版本、所有存储记录与运行索引的 JSON。阅读、程序正确性、实验完成与掌握证据各自独立；查看答案后的独立重试需主动开始新的帮助周期，该声明无法证明没有外部帮助。复习可以稍后处理。

## 开发与验证

```powershell
# DSH_SOURCE 指向固定 rc.5 Git checkout，开发依赖由仓库提供
node scripts/build.mjs
npm test
node --experimental-transform-types tests/runner-lifecycle.ts
node --experimental-transform-types tests/runner-real.ts
node --experimental-transform-types tests/runner-adversarial.ts
node --experimental-transform-types tests/runner-parameters.ts
node tests/ui-check.mjs
npm pack --ignore-scripts --cache .build/npm-cache
node tests/install-check.mjs
node tests/ui-official-session.mjs
```

严格类型检查使用官方 rc.5 源码；构建校验 Git revision，并记录源码/内容/运行器输入哈希于 `lib/build-identity.json`。实际测试范围、未验证项目和环境阻塞见仓库 `docs/neural-lab/VALIDATION.md`，不能把单元测试或隔离HTTP页面等同于真实DSH Desktop验收。

后续范围：多文件IDE、长任务恢复训练、GPU、任意文件产物、自动生成课程。首版不承诺自动恢复训练或生成大模型质量文本。
