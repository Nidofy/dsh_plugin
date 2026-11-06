# MLP：从梯度检查到有边界的实验结论

本讲义接续 L04，使用已有 `L04-train`（`train-mlp-v1`）的 starter 和 reference。目标是诊断自己实现的训练循环，而不是增加训练器。程序判题与导师解释分开：`completed` 只说明执行完成；通过必须看 `check_status` 和具体 check。阅读、手算、运行、解释分别提供不同学习证据。

## 1. 预测：更新前后到底在比较什么

先写预测，再编辑代码：漏掉 `zero_grad()` 最早会影响哪一步？漏掉 `step()` 时 loss 是否仍可计算？validation 使用最后一个训练 batch，数值看起来合理就能算通过吗？保留预测，运行后逐项修订。

本活动使用 32 个生成样本：`x:[32,2]`，目标 `y=x0²+0.6*x1-0.15`，不是外部真实世界数据集。固定 seed 驱动随机排列，前 24 个索引用于训练，后 8 个用于 validation；每步从训练索引无放回选 6 个样本，共 8 步。不同步之间可能重复取到同一样本。这不是 8 个完整 epoch。

网络为 `H=tanh(XWᵀ+b)`、`Y=HVᵀ+c`。一批数据的 shape 为 `X:[6,2]`、`W:[4,2]`、`b:[4]`、`H:[6,4]`、`V:[1,4]`、`c:[1]`、`Y:[6,1]`。可信控制器使用 float64 对齐数值。

对本题的单输出 MSE，令批大小为 B：

$$L=\frac1B\sum_i(Y_i-y_i)^2,\quad G_Y=\frac{2}{B}(Y-y)$$
$$G_V=G_Y^TH,\quad G_c=\sum_iG_{Y,i},\quad G_Z=(G_YV)\odot(1-H^2)$$
$$G_W=G_Z^TX,\quad G_b=\sum_iG_{Z,i},\quad\theta'=\theta-\eta G_\theta.$$

这里梯度和参数都取同一步更新前的值。若迁移成 O 个输出且对所有元素求 mean，分母应为 `B*O`，不能照搬本题的 B。

手算缩小版（说明公式，不冒充本活动运行）：单样本单隐藏单元，`x=1,y=1,w=0,b=0,v=1,c=0`。此时 `h=0,pred=0,L=1`；`G_c=-2,G_v=0,G_w=-2,G_b=-2`。学习率 0.1 的一次同步 SGD 后，`w=b=c=0.2,v=1`。新预测为 `tanh(0.4)+0.2≈0.579949`，新 loss 约 0.176443。`G_v=0` 并不代表整个网络没有学习。

## 2. 实现：让每一步都有可验证的含义

在现有 starter 中完成模型前向、单步训练和 validation。按 `model.train → zero_grad → forward → MSE → backward → step` 的顺序实现训练。日志里的当前 batch loss 是更新前计算的；控制器的 `train_loss/validation_loss` 是更新后按整个对应集合重新计算的，因此两条曲线本来就不必相同。

validation 使用传入的 held-out batch，执行 `model.eval()` 并在 `torch.no_grad()` 中计算同一定义的 MSE，不更新参数。`eval()` 改变模块模式，不关闭 autograd；`no_grad()` 关闭梯度记录，不自动切换模块模式。即使这个 tanh MLP 没有 dropout，仍须满足验证接口的两项约定，为迁移做准备。

## 3. 程序反馈：先定位失败，再解释曲线

| 可信检查 | 主要定位方向 | 下一步最小检查 |
| --- | --- | --- |
| `forward + MSE` | 前向、损失定义或上报标量 | 核对 mean 的轴和转置 |
| `fresh minibatch gradients` | 残留梯度或反向实现 | 核对每步清零及当前 batch |
| `SGD parameter update` | 未更新、错学习率、更新时序 | 对一个参数手算旧值减 lr×梯度 |
| `held-out validation MSE` | 错数据或错损失 | 确认使用 validation 传入的 x/y |
| `validation uses eval and no_grad` | 验证模式错误 | 分别核对模式与梯度记录 |
| `validation preserves parameters` | 验证阶段改动参数 | 查找 step、原地赋值 |

漏 `backward` 也可能直接触发 `training contract`：无法获取梯度是执行契约失败，不一定产生一条漂亮的零梯度曲线。多项失败时，从最早的前向/梯度失败开始；后续结果可能是传播的症状。

每次只制造一个错误，记录预期失败、实际失败、修复后的结果。先用漏 `step` 与错误 validation 数据这两种已有反例思路做诊断，再恢复正确实现。不要复制伪造的 loss 来“修复”检查；学生上报指标不能覆盖独立重算。

## 4. 解释：做一次单变量比较

先做基线 A：seed=42、learningRate=0.05；同设置重复一次 A′；再仅把学习率改为 0.2 得到 B。保存每次 run 的代码、seed、内容/测试版本、环境身份、有效配置以及 manifest 的 `splitHash/initialHash/batchHash`。A 与 B 的三个 manifest hash 应一致；不一致时停止把差异归因于学习率。改变 seed 会同时改变划分、初始化和批次，不是纯学习率实验。

比较相同步数、同一来源 `program` 的 validation loss，另外描述 train loss。回答：哪条是更新前的学生 batch loss？重复运行是否在当前环境内重现？八步后的 validation 更低支持什么结论，不能支持什么结论？一次小样本比较只能支持该固定设置下的观察，不能证明某学习率普遍更好。validation 上反复选参会让它参与决策；本活动没有独立 test 集，不能宣称得到无偏测试成绩。

建议记录表字段：`run / code / seed / lr / split / initial / batch / check / program validation / 解释`。若导出的记录没有某字段，注明缺失，不从曲线猜测。导师评价不能把 failed 改成 passed。

## 5. 迁移：检验你是否理解了实现

先不运行，推导输出从 1 改为 3 时 `V,c,Y,G_Y` 的 shape 和 MSE 分母；再解释为什么不能直接在当前固定接口里提交这一变式。另一个迁移题：如果加入 dropout，为什么只有 `no_grad` 的验证仍可能随机？这些是解释题，不新增活动或运行契约。

## 6. 复习与有限预算

默认隔离预算为 1 CPU、1024 MiB、120 秒执行上限；这不是完成时间承诺。每轮保持 8 步，不增加 epoch 搜索。建议本次最多 6 次运行：基线、重复、改 lr、两个单错误、恢复验证。超时/环境不可用只记录为运行问题，不判成数学不合格，也不绕过隔离在宿主执行提交代码。

当天合上代码复述“清零—反向—更新—验证”的责任；次日从失败 check 独立定位错误；一周后重新做输出维度迁移题。每次记录预测、自己的实现、run 身份和检查结果、解释修订、迁移回答、接受过的帮助。参考解通过是系统基线证据，不自动算作你独立完成的证据。
