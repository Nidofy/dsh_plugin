# Neural Lab v0.1 验证记录

2026-11-02；Windows / Node24.16 / Docker Desktop29.9.2 (Linux amd64)。目标DSH **0.2.1-rc.5**, revision `b830ec950faba0a46dda564be3e2d854afed94f1`。LeetCode参考HEAD `d397c96a`，用户工作树0.5.2；StudyMate `d8114f38363272852b339d6788b2f8f007243b43`。

## 已验证

| 范围 | 实际执行与结果 |
|---|---|
| 构建 | `node scripts/build.mjs`：校验官方Git身份，全部owned TS strict通过；生成真实Host和DSH客户端模块工厂。build-identity覆盖src、课包、runtime、CPU依赖锁、manifest、安装补丁和说明。 |
| 行为 | `npm test`：10项通过。课程缺引用/循环/重复ID；运行预算/路径/预取消；SQLite草稿与笔记CAS、冷恢复interrupted、真实子进程崩溃owner恢复、外部DB不重置；真实rc5 Cordis启停和HTTP RPC（隐藏答案、原稿快照、导出、跨域/过大请求拒绝、慢body卸载）。 |
| 数值参考 | `node --experimental-transform-types tests/runner-real.ts`：24可执行参考均真实Docker completed+passed；18 starter实际failed；MLP/LM固定种子重复执行逐指标一致。证据 `packages/neural-lab/tests/results/reference-runs.json`。 |
| 反例及隔离 | `node --experimental-transform-types tests/runner-adversarial.ts`：10种错误/攻击均completed+failed，包括错轴、缺缩放、mask泄漏、错转置、batch混合、detach、伪造完成、父FD访问、输出洪水；timeout/cancel分别timed_out/cancelled。证据 `tests/results/adversarial-results.json`。最后独立docker ps观察无遗留neural-lab容器。 |
| 内容 | 12单元、36活动（18代码、12数值/解释、6实验）；全部正文/具体例子、逐课提示、先修检查。官方KaTeX0.16.47严格渲染12个讲义公式通过。 |
| 真实UI与CPU | `NEURAL_UI_CPU=1 node tests/ui-check.mjs`：真实Engine+HTTP+SQLite+Docker，1366/1920尺寸、0pageerror、无横向溢出；立即切课/刷新草稿、笔记/档案、答案前未运行原稿恢复、模型不可用、Attention热图与指标、MLP多步曲线、取消与旧快照提示。证据包内 `.build/ui/validation.json` 及截图。 |
| 官方Web | 固定rc5官方CLI、web模板及隔离neural-web profile：真实模块加载/侧栏工作台/认证RPC，保存草稿刷新恢复、提示、模型凭据缺失时真实failed降级，1366/1920截图与0pageerror。官方Host→Docker Attention completed+passed、与Learn0.5.2今日面板切换共存均通过；最后导师上下文补丁包重新安装后重验官方草稿/刷新/提示/实际无key降级/双面板，安装四项关键文件哈希与当前产物一致。包 `.build/ui/official-validation.json` 记录最终包身份，`official-cpu-coexist-validation.json` 保留未受导师补丁影响的CPU证据；0pageerror，测试server均停止。 |
| 离线安装 | `node tests/install-check.mjs`：官方rc5 runProfilePnpm空store、offline、ignore-scripts安装成功；已安装包真实Cordis启停+12完整讲义读取；源码identity及课包/runtime/CPU锁实际安装字节匹配。证据包 `.build/install-result.json`。 |

最终本地交付包：`packages/neural-lab/dsh-plugin-neural-lab-0.1.0.tgz`，17文件，约55.5KB；SHA-256 `3473de3e0fdb7a7e2d66f6a2ea0ba90c7fbcb4f572eedb21364668a23a7cf5db`。

## CPU环境与执行预算

镜像 `dsh-neural-lab-cpu:0.1` ID `sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7`。真实版本Python3.12.10 / NumPy2.2.6 / torch2.7.1+cpu，CUDA=None，pip check通过，11依赖版本与锁一致。详情 `scripts/cpu-image/validated-environment.json`。

Docker Hub认证端点曾超时，官方public ECR基础镜像成功；torch175.8MB下载约935秒。初始构建固定NumPy/Torch后冻结传递依赖，未宣称完整锁版脚本另重跑所得层hash相同。离线机器可save/load镜像。

本机24活动实测2.456–7.945秒，六实验2.456–3.642秒（含Docker启动）。默认1CPU/1GB/120秒/256KB输出；不是跨机器时延承诺。MLP与LM仅检查真实梯度、参数更新、有限指标与相同环境复现，不以任意loss阈值代替掌握。

实际门禁发现并修复：可信controller原先无CAP_KILL，无法清理不同UID的洪水学生进程；现只保留SETUID/SETGID/KILL用于降权与清理，学生降权后不保留这些能力。清理共享同一Promise，避免重复删除竞争。父进程FD伪造仍实际Permission denied。

## 明确边界

- 未使用用户真实DSH_HOME或模型凭据；真实模型成功回答未验证。官方默认模型无凭据会真实failed，独立无模型profile为unavailable，讲义/提示/评测继续可用。
- 官方Web已验证；Electron原生Desktop外壳未单独GUI验收。
- 实验编辑受控配置，可信课包执行训练模板。固定events.jsonl/result.json有受控产物索引，不提供任意大型学生文件导出或训练进程恢复。
- 数值域为声明的有限、非空输入；不承诺NaN/Inf、空尺寸、全mask行、非方阵带偏移因果语义。
- 解答/导师前原稿保留；独立重试为自述，不能验证外部帮助。阅读与代码通过不自动等于知识掌握。

提交前 `git diff --cached --check` 通过。仅本任务源码、文档、合成验证结果纳入本地分支，不含node_modules/lib/tgz/.build/.test-runs；未推送或发布。
