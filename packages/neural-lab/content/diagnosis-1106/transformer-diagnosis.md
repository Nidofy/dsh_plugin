# Micro Transformer：三头迁移、未来泄漏与断开的梯度

接续 L12，复用已有 `L12-assembly` 与 `L12-variant` 的十四组件项目、starter、reference 和运行器。先完成已有组件，再用本讲义诊断“形状正确但语义错误”“前向正确但梯度断开”。不新增平行组装任务。

## 1. 预测：通过前向是否足够

运行前写下三个预测：把头数写死为 2 会在哪个输入失败？去掉 causal mask 为什么可能降低训练 loss？对 query 权重做 `detach()` 是否改变本次前向数值？预测必须指向可观察的 check，而非只写“模型不好”。

基础组装为 `B=2,T=4,D=4,H=2,d_head=2`，训练 4 步。三头变式为 `B=3,T=3,D=6,H=3,d_head=2`，训练 2 步；两者词表大小均为 5、FFN 中间宽度为 6。变式同时改变多个量，用来检查实现的通用性，不能把两条训练曲线差异单独归因于头数。

| 张量/操作 | 通用 shape | 三头变式 |
| --- | --- | --- |
| 输入与目标 token | `[B,T]` | `[3,3]` |
| token + position embedding | `[B,T,D]` | `[3,3,6]` |
| Q/K/V 拆头并换轴 | `[B,H,T,D/H]` | `[3,3,3,2]` |
| attention scores/weights | `[B,H,T,T]` | `[3,3,3,3]` |
| 合头后投影 | `[B,T,D]` | `[3,3,6]` |
| FFN 内部 | `[B,T,6]` | `[3,3,6]` |
| logits | `[B,T,5]` | `[3,3,5]` |

$$Q=NW_Q,\quad K=NW_K,\quad V=NW_V,\quad A=\mathrm{softmax}_{key}(QK^T/\sqrt{D/H}+M)$$

每头计算 `AV`，拼接后乘输出投影。`M[i,j]=0` 当 `j≤i`，否则为负无穷；softmax 沿最后的 key 轴。Pre-LN 块为 `h=x+Attention(LN(x))`、`out=h+ReLU(LN(h)W_up)W_down`。本活动 LN 没有额外可训练仿射参数，FFN 用 ReLU，不能把其他架构惯例直接当作本题参考。

手算注意力：单头 T=2，缩放后的 score 全为 0，两个 value 分别为 2 和 6。正确下三角 mask 得到权重 `[[1,0],[1/2,1/2]]`，输出 `[2,4]`。仅把未来 value 改为 10 后输出 `[2,6]`，第一位置不变。若无 mask，第一位置也变成 6。这是手算教学例，不是实际 run 的热图。

## 2. 实现：把轴、时间和计算图都连起来

使用已有十四组件接口：shifted、embed、position、causal_mask、head_weights、merge_heads、attention、pre_norm、ffn、block、lm_head、logits、loss_fn、update。遵守 starter 中的实际函数签名，不新增运行入口。

从输入的 B/T/D 和传入 heads 推导 shape，先验证 D 可整除 H。拆头用 reshape 后 transpose；合头先将 `[B,H,T,d_head]` 换回 `[B,T,H,d_head]` 再 reshape。直接 reshape 不能表达交换时间轴和头轴。可信程序还会用 `B=1,T=2,H=1` 检查另一合法规格。

窗口 `[a,b,c,d]` 在 T=3 时形成 inputs=`[a,b,c]`、targets=`[b,c,d]`。交叉熵是所有 B×T 个 next-token 位置损失的平均：

$$L=-\frac1{BT}\sum_{b,t}\log\mathrm{softmax}(logits_{b,t})_{targets_{b,t}}.$$

五类均匀预测时每个位置的交叉熵为 `ln(5)≈1.609438`。这只是计算基准，不是规定训练必然达到的 loss。不要把 targets 复制成 inputs；因果模型在位置 t 的任务是预测 t+1。

`detach()` 保留数值但切断梯度路径。导出日志时可以读取已计算张量的值；训练前向内不应以 detach 修复 autograd 报错。沿 `loss → logits → block → embedding` 检查路径，沿 Q/K/V 各投影分别检查参数梯度。

## 3. 程序反馈：三类失败需要三种证据

| 现象 | 可信检查/观察 | 诊断动作 |
| --- | --- | --- |
| 基础可跑，三头或短序列失败 | `attention alternate B/T/heads`、模块 shape/value 检查 | 搜索硬编码 2、4，核对轴语义 |
| loss 看似改善，读取了未来 | `causal prefix unchanged`、`module causal_mask`、`module head_weights` | 核对 mask 方向、对角线和 softmax 轴 |
| 改第二个样本影响第一个 | `batch isolation` | 查找沿 batch 平均/归一化或错误 reshape |
| logits 正确，embedding 不学习 | `embedding input gradient` | 检查 embedding 到 block 的 detach |
| logits 正确，query 参数不学习 | `all parameter gradients` | 检查 Q 投影权重的 detach |
| 梯度正确，参数没变 | `SGD parameter updates` | 核对更新顺序、学习率、返回 state |
| 预测目标错位 | `next-token windows`、`cross entropy` | 手写一个四字符窗口重新移位 |

模块 check 让部分实现也能得到局部反馈；一个模块通过不等于项目通过。查看最早失败的 check 和 detail，然后一次只改一个位置。缺失梯度可能直接造成契约失败，不保证每个错误都返回同样的诊断名称。参考数值比较使用 float64、绝对/相对容差；不要靠更改参考或放宽容差隐藏转置错误。

保留正确代码快照后，分别试一次去 mask 和一次 query detach，再恢复。去 mask 通常同时影响模块值与因果性；detach 则可保持前向值不变却破坏参数梯度。这个对照说明“前向相同”不足以证明训练实现正确。

## 4. 解释：区分数据泄漏、未来泄漏与实验归因

实际数据为内置 100 字符合成语料、词表 `abcde`，dataset 为 `tiny-char-v1`。先按原始字符位置切分：训练 0..71，validation 72..99，然后各自生成长度 T+1 的窗口。基础 T=4：训练起点 0..67 共 68 个，validation 起点 72..95 共 24 个；变式 T=3：分别 69 和 25 个窗口。训练窗口绝不跨越边界。先生成重叠窗口再随机划分会让同一原始字符出现在两侧；mask 不能修复这种数据划分泄漏。同一分区内窗口重叠则符合本活动定义。

每步控制器对训练分区所有窗口与 validation 所有窗口重算 loss。热图只展示首步、batch=0、layer=0 的有界 attention 样本；本模型只有一个 block。shape 或单幅热图看起来正确不能替代数值、梯度和因果检查。读图时注明 run、step、head、batch、来源以及是否采样，不能把旧 run 的图解释成新草稿结果。

在同一活动内，用固定 seed=42 和相同代码，先以 lr=0.05 运行、重复，再只改 lr=0.2。核对有效配置、环境及 `splitHash/initialHash/batchHash`，比较相同步数的 program validation loss。三头变式另作迁移，不作为这组单变量实验。仅有 2/4 步训练不能证明语言能力或收敛；17 个字符的采样也不能替代 validation 和可信检查。validation 被用来选参后不再是未触碰的 test 集。

## 5. 迁移：独立推导后再看实现

不改运行协议，纸上推导 `B=1,T=2,D=6,H=1` 的 Q/K/V、weights、合头和 logits shape；再解释 D=6,H=4 为什么不满足整除契约。回答：若屏蔽未来列后又沿 query 轴 softmax，哪一项语义错了？若只 detach Q，哪些参数仍可能得到梯度，为什么这不代表整体实现正确？将自己的回答与对应程序证据联系起来。

## 6. 复习与有限预算

默认隔离预算为 1 CPU、1024 MiB、120 秒执行上限；不保证固定耗时。保持既有小尺寸与 2/4 步，不为追求漂亮曲线扩大语料。建议本次最多 7 次运行：基础、重复、改 lr、三头迁移、无 mask、query detach、恢复验证。环境/超时失败单独记录，不能静默转宿主执行提交代码。

当天画出一条前向及反向路径；次日闭卷重算两位置因果例；一周后解释三头迁移为何不是单变量实验。记录预测、代码快照、run 和 checks、错误解释、迁移答案、帮助程度。导师可追问推理，不能撤销程序 failed；复制 reference 成功也不能代替独立迁移证据。
