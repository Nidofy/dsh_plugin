# Neural Lab 0.1

面向有 Python 和基础数学经验的神经网络与 Transformer 学习工作台。目标宿主为 **DSH 0.2.1-rc.5**，Node 24+；CPU 优先。左侧课程路线、讲义/练习/实验/记录页签与可折叠导师使用同一内容和 SQLite 数据库。

## 安装与环境

将构建生成的 `dsh-plugin-neural-lab-0.1.0.tgz` 通过 DSH 插件管理器安装到选定 profile，启用插件，在侧栏打开 Neural Lab。与 `dsh-plugin-learn` 使用不同包名、注册标识和数据根；不包含 LeetCode 搜题、邮件或 Hot100 worker。开发与验收只使用临时 profile，不修改用户实际 DSH_HOME。

CPU 环境单独准备，课程运行不会安装依赖或下载数据：

```powershell
pwsh -File scripts/prepare-image.ps1
```

该脚本构建 `dsh-neural-lab-cpu:0.1`，Python 3.12、NumPy 2.2.6、PyTorch 2.7.1+cpu。基础镜像与全部传递依赖锁定位于 `scripts/cpu-image`。首次准备需要 Docker 和网络；离线机可先 `docker save`，再 `docker load` 导入同一镜像。具体镜像身份和实测环境记录于验证文档。Docker 不可用时界面显示真实错误，讲义、数值题、笔记和预置提示仍可使用；不会自动在宿主执行学生代码。

## 学习路线

L01 张量与广播 → L02 链式法则 → L03 自动微分/梯度累积 → L04 MLP → L05 稳定 Softmax/交叉熵 → L06 优化/泛化 → L07 Embedding/位置 → L08 单头 Attention → L09 因果 mask/批处理 → L10 多头拆合与投影 → L11 完整 Pre-LN block → L12 CPU 微型字符语言模型。

课包包含代码、数值和预测解释题，以及数值梯度、MLP 学习率、Softmax 稳定性、Attention 缩放、因果未来扰动、微型语言模型六个实验。精确活动清单由 `content/catalog.json` 提供，参考解只能通过“完整答案”请求显示并记录帮助。未完成 starter 不应被判通过。

布尔 mask 的统一语义为 `True=允许关注`；教程在调用其他接口时显式转换。Pre-LN 使用先归一化再子层、残差相加；dropout 关闭以便核对。输入域/容差/不支持的边界见各题。数值题采用 `atol=1e-8, rtol=1e-6`；shape/序列文本忽略空白后比较。解释题保留原文，状态为 inconclusive，导师反馈不替代程序判定。

## 运行与记录

每次运行保存内容版本、测试版本、代码/配置快照、环境镜像身份和种子。运行状态与检查状态分别显示；正常退出不等于答案通过。图表从带 runId 的本次指标/张量事件生成。运行在 Host 管理，关闭面板不取消；用户可显式取消。退出插件取消并等待任务，重新启动把未确认结束的任务标记 interrupted。

容器禁用网络、只读根文件系统，学生进程降权运行；可信控制器保留降权所需能力，并限制CPU/内存/PID/时间/输出；独立运行目录只读挂载学生快照，受控结果由 Host 写回。首版不开放任意学生文件产物。Host配置可设置 timeoutMs（默认120000）、memoryMb（默认1024）、cpus（默认1）、outputBytes（默认262144），用户课内配置仅包含种子、步数和学习率。模型仅复用 DSH 默认配置；没有模型时明确显示 unavailable，预置提示继续可用。

数据位于配置 `dataRoot`（安装补丁默认 `dshHomePath('neural-lab')`）：`neural-lab.sqlite` 保存草稿修订、笔记、学习位置、作答、帮助、导师记录、知识点证据和复习；`runs/<runId>` 保存快照与结果；`owner.sqlite` 防止同时启动两个数据 owner。禁止手动复制正在运行的 SQLite 文件作为可靠备份，应先退出插件或使用工作台导出。

导出按钮下载含 schema 版本、所有存储记录与运行索引的 JSON。阅读、程序正确性、实验完成与掌握证据各自独立；查看答案后的独立重试需主动开始新的帮助周期，该声明无法证明没有外部帮助。复习可以稍后处理。

## 开发与验证

```powershell
# DSH_SOURCE 指向固定 rc.5 Git checkout，开发依赖由仓库提供
node scripts/build.mjs
npm test
node --experimental-transform-types tests/runner-real.ts
node --experimental-transform-types tests/runner-adversarial.ts
node tests/ui-check.mjs
npm pack --ignore-scripts --cache .build/npm-cache
node tests/install-check.mjs
```

严格类型检查使用官方 rc.5 源码；构建校验 Git revision，并记录源码/内容/运行器输入哈希于 `lib/build-identity.json`。实际测试范围、未验证项目和环境阻塞见仓库 `docs/neural-lab/VALIDATION.md`，不能把单元测试或隔离HTTP页面等同于真实DSH Desktop验收。

后续范围：多文件IDE、长任务恢复训练、GPU、任意文件产物、自动生成课程。首版不承诺自动恢复训练或生成大模型质量文本。
