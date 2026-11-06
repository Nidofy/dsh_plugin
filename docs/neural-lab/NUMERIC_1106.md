# 2026-11-06 独立数值与运行故障回归

本轮以 0.5.0 源码为基线，先阅读既有 projects-real、training-real、runner-adversarial 和 runner-lifecycle。未修改运行器、可信 Python 控制器或公共类型。

## 已验证：受控运行故障

命令（仓库根目录）：

```powershell
node --experimental-transform-types --test packages/neural-lab/tests/runner-faults-1106.test.ts
```

Node 24.16.0，5/5 通过：create 返回期间取消；清理失败保留待恢复标记；create 回执丢失后按精确 owner/name 找回容器；多 ID 与非法 ID 拒绝删除。测试断言取消状态与 cleanupPending 落盘。此为注入 Docker 命令响应的受控测试，不是真实 Docker 生命周期证据。

## 待集成者运行：真实数值增量

```powershell
node --experimental-transform-types packages/neural-lab/tests/numeric-1106-real.ts
```

脚本要求真实 Docker，执行 L12-assembly、L12-signal 两个参考解和九个增量错解；每个错解必须 completed/failed 并出现指定失败检查，而不是仅以进程失败算成功。

| 变异 | 要求失败的检查 |
| --- | --- |
| detach loss，阻断 backward | decoder contract |
| 数值 forward 相同、gradient 加倍 | all parameter gradients |
| loss 内标签错位 | module loss_fn |
| 归一化前混入其他 batch | batch isolation |
| 下三角改为上三角 mask | causal prefix unchanged |
| 验证窗口向训练边界越界一位 | split and normalization |
| 漏掉最后一个合法训练窗口 | split and normalization |
| 卷积核 detach、forward 不变 | causal_cnn |
| local attention 跨 batch 混合 | local_attention |

首次执行因 Docker pipe 不存在失败，同时沙箱拒绝读取 Docker 配置；随后提权请求挂起并被中断，因此本线程没有真实数值 PASS 记录。主控后来已确认 Docker 启动，将接手执行。不得将本节写成通过，也未使用宿主 Python 代替沙箱。两套测试只使用 guarded temporaryRunner 临时根，不写用户 profile。

既有覆盖已包含 MLP 漏 backward/zero_grad/step、固定 heads、unshifted targets、未来泄漏、训练/验证数据复用等，本轮不复制那些案例。尚无由本轮真实运行确认的生产数值缺陷。build/typecheck/打包由集成者统一执行。

## A 集成后的真实复测

2026-11-06：A在主工作树执行 `node --experimental-transform-types tests/numeric-1106-real.ts`，exit 0。Docker 29.9.2，镜像 `sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7`。两参考通过；九反例全部 completed/failed，并命中各自指定可信检查。无成功sample。此前待验证是子线程权限挂起记录，本段为随后实际结果。
