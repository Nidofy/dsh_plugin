# 0.6 可执行迁移教学素材

`packages/neural-lab/content/v060/activities.json` 是六个独立 Exercise 对象。`lessons.json` 是 `{lessonId, body}` 追加段落数组，由活动索引集成者注册到原 L04/L12；不替换旧活动、旧协议或历史正文。新活动各自 testVersion="1"。来源活动字段 `transferFrom` 为字符串，`diagnosis` 为文本。共享类型和注册由 A 负责。

| 活动 | 来源 | 协议 | 证据 / 模式 |
| --- | --- | --- | --- |
| L04-multi | L04-train | train-mlp-multi-v1 | transfer / check |
| L12-flex | L12-assembly | project-char-flex-v1 | transfer / check |
| L12-two | L12-flex | project-char-two-v1 | transfer / check |
| L12-observe | L12-two | project-char-observe-v1 | observation / observe，由宿主按 mode 授予 |
| L12-repair-mask | L12-two | project-char-two-v1 | debugging / check |
| L12-repair-gradient | L12-two | project-char-two-v1 | debugging / check |

观察活动故意不写 implementation/transfer evidenceKind；宿主不能将其默认授为实现。迁移来源是可核对的活动 ID，不宣称旧通过自动满足新掌握。内容版本由集成 catalog 更新。参考使用情况须体现在实际帮助记录；通过并非作者独立性证明。

## 可执行差异与参考断言

- MLP reference 与旧 L04-train 完全相同，运行模型改为三输出。starter 的 train_step 与 validate 两处 `.square().mean()` 改成平方误差 `.sum() / x.size(0)`，validate 的商加括号后 `.item()`，保证可执行。修复应同时恢复两处 mean。B×O 为正确分母；同一初始参数/批次上错误损失与梯度放大 O=3 倍，后续轨迹不保证这个倍数。检查 `forward + MSE`、`fresh minibatch gradients`、更新与验证契约。
- 字符 reference 来自数值工作线 `runtime/fixtures060.json` 的通用双层实现；flex 的 p.layers=1 跳过第二层，two/observe 的 p.layers=2 使用第二层真实 Parameter。十四组件合同逐项复用 L12-assembly。训练代码必须实际调用学生组件。
- mask starter 与 reference 唯一差异是 `causal_mask` 的返回行改为 `return scores`。所有函数可执行。预期 module causal_mask 失败并可能产生后续模块/因果失败；必须以实际 trace 为准。修复为保留对角线的下三角、未来置负无穷。
- gradient starter 唯一插入行是第二层字典包装后 `second["q"] = second["q"].detach()`。初次前向不变、原 q2 梯度缺失；预期梯度失败或 `decoder contract` 缺梯度错误。删除该行恢复引用，不手工填梯度。
- flex/two/observe 从通用十四组件 starter 开始，学习者带入自己的已验证源码；完整reference为显式帮助，不自动当作独立实现。它们不是修复活动，因此实现占位符合任务语义。

## 学习闭环与验收

每项均包含预测、实现、可信检查、解释、可执行变式与复习。L12 新配置 B1..4/T2..8/H1,2,3,6；quick固定4步，observe8..24步。教学仅引用实际协议check名称与采集范围；手算数字明确区别于run结果。观察记录真实失败/取消/缺指标、有效n和样本标准差适用条件，不推断少量样本因果、收敛或语言能力。

素材测试：在 packages/neural-lab 运行 `node --experimental-transform-types --test tests/curriculum060.test.ts`，检查活动来源/协议/模式、精确坏starter差异、参考一致性、B×O导数有限差分与教学闭环。Python AST parse 可确认所有starter/reference语法，但不代替运行。

集成者须使用真实隔离CPU执行三个坏starter（MLP、mask、gradient）确认 completed/failed 或明确契约失败，随后运行各reference验证全部可信检查通过；flex覆盖合法heads与尺寸边界，two验证两层实际梯度，observe验证8/24步有界观测且不授实现。数值工作线 `tests/numeric-060-real.ts` 提供运行入口。此文不声称Docker或UI验证已经通过；结果由 A 的门禁记录。
