# 0.6 数值协议

四个新增协议仅由 controller.py 分派，旧协议与 CLI 不变。argv[4] 为有限 learning rate [0.001,0.3]；argv[5] 为 JSON 对象。提交始终是单文件，学生函数只在 UID/GID 65534 子进程执行。新增可信模块不加载学生源码，无新增学生依赖，root staging 仍只复制 student.py 和 submission.py。

- train-mlp-multi-v1：配置必须 {}；2–4–3 tanh MLP，8 个六样本批次。quadratic-2d-multi-v1 三个目标分别为 x0²+0.6x1−0.15、x1²−0.4x0+0.2、x0x1+0.3x0。NumPy oracle 独立计算 MSE 与解析梯度，输出导数分母 B×3；学生仍实现 train_step(model,optimizer,batch)、validate(model,batch)。24/8 固定种子划分，held-out/eval/no_grad/不变参数检查沿用原协议。
- project-char-flex-v1：单层，宽度6；配置仅 batchSize（1..4）、context（2..8）、heads（1/2/3/6）、steps（必须4）。默认 B2/T4/H2。
- project-char-two-v1：独立双层快判，配置同上，必须4步。
- project-char-observe-v1：独立双层观察，steps 8..24，默认12；其他配置同上。控制器仍真实验证梯度、更新、因果性等，宿主只赋 observation 证据。

字符数据集 tiny-char-v2，原五字符语料，位置0..71训练，72..99留出，窗口不跨分界。manifest 哈希含实际初始化、训练调度、窗口索引。effectiveConfig 含真实 layers，用户不能传 layers。参数为 token/position/q/k/v/out/up/down/lm，第二层额外 q2/k2/v2/out2/up2/down2。p.heads 与 p.layers 为只读调用约定。fixtures060.json 提供新三种字符协议通用 reference/starter；注册活动必须使用这个 reference，旧单层 reference 不支持第二层。

十四个组件继续来自学生单文件。logits 参考解逐层调用学生 block，第二层字典重用真实第二层 Parameter；每层 attention/FFN/normalization/mask/merge 及所有参数参与实际前反向。独立可信参考使用 PyTorch SDPA 和原生 layer_norm/autograd，不调用学生函数。逐步比较 logits、输入梯度、所有参数梯度和 SGD 更新。第一步通过改变未来 token 验证前缀不变；B=1 时不访问不存在的 batch 1，B>1 只改变其他 batch，并另外做 B1/T2 的拆头检查。

观测：所有组件独立 probe 形状/数值检查；实际训练调用的组件形状带 component/layer；梯度 hook 仅记录实际收到的梯度。首末步逐参数 gradient_norm/parameter_delta（detail 指定参数）和组件梯度范数；aggregate norm 与 loss 每步输出。整数索引、更新函数等无可微输出不捏造梯度值。第一步各层各头 attention 来自学生真实调用，独立核验后仅输出 batch0，最大8×8。parameter_delta 按实际参数采集并标对应组件，多个同组件参数通过 detail 区分。

安全与输出：新三个字符协议 stdout 上限2MiB，仅用于有界24步、最多B4/T8/H6的数值trace；旧stdout与所有stderr维持64KiB。子进程15秒和现有容器资源限制不变。组件/参数详情仅首末步，事件输出仍按宿主256KiB/1024事件限制。所有学生打印仍重定向stderr，不能发可信事件。数值观测不是来源/作者真实性证明。

验证：Python py_compile 已通过；宿主无 torch，不以宿主执行学生代码代替Docker。集成后执行 node --experimental-transform-types tests/numeric-060-real.ts（工作目录 packages/neural-lab）。覆盖三输出错分母/无反向/无更新，全部合法heads与尺寸边界、双层、24步最大配置、第二层跳过/detach、固定heads、未来泄漏及无更新。真实Docker结果由集成者记录，不能将脚本存在记为通过。
