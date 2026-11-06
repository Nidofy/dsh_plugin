# Neural Lab 0.6.0 验收记录

六模块实现与验收已完成。最终代码提交 `b991b2d62906a05611220472371da22e4cbdd3ed`；包160008字节，SHA256 `054f135447f1dd0366f5b86a3581d6274d48e1ccb95d51ef8e6601281aa0665e`。57项回归、真实CPU、官方Web/原生Electron及有限两轮默认导师专项已通过；模型语义结论仅为根代理对该样本的内容复核。各候选hash与差异在文末表格列明，未发布或修改真实profile。

2026-11-06；固定官方DSH 0.2.1-rc.5源码 b830ec950faba0a46dda564be3e2d854afed94f1，Node24.16.0，Docker29.9.2，CPU镜像 sha256:83565079cb5893c1677fa68d04b564e2eade7b56d1314fda0e106bac10d0e0f7。仅隔离profile；未push/发布，未修改真实profile。原规划docs/neural-lab-1106保留未跟踪。

## 已实际通过

- `npm.cmd test`：strict Host/Client构建，57/57行为回归；包含实验组身份冻结、关闭等待、取消、重启中断、镜像变化拒绝、标量shape、有界网格与真实1秒总预算控制；历史解释不消除repair提醒；显式ack仅保留自述复盘。
- `node --experimental-transform-types tests/numeric-060-real.ts`：17个真实CPU场景。多输出参考及错B分母/无backward/无step；四组合法B/T/H；两层参考；观察最大B4/T8/H6/24步（485事件）及最小B1/T2/H1/8步；固定头数、跳层2、层2detach、无遮罩、loss detach、无更新均被指定检查拒绝。
- `node --experimental-transform-types tests/runner-real.ts`：35/35可执行活动参考解通过；所有代码活动starter按断言失败；MLP/LM固定种子复跑一致。包含六个新增活动。完整事件保留 tests/results/reference-runs.json。
- `node --experimental-transform-types tests/runner-adversarial.ts`：20项真实Docker攻击/错解（18拒绝、timeout、cancel）通过；`tests/runner-lifecycle.ts`：unload、inspect、snapshot、create取消和retag五场景通过。
- 旧官方Web学习流程（候选bc31a75e…）：实际加载/认证RPC、自由导师无模型路径、两次CPU训练/对照/解释、来源为delayed-recall的未来复习与显式确认完整通过。
- `node tests/upgrade-020.mjs`：包级0.1.2→0.1.3→0.2.0→0.2.1→0.2.2→0.5.0→0.5.1→0.6.0；drafts/runs/history保留，新增活动独立版本，同一SQLite1。
- `node tests/install-check.mjs`：官方rc.5插件管理器离线空store安装、包身份、shipped Host生命周期与课程加载；临时profile清理通过。

## 首轮真实导师语义失败与修复

首次完整新版Web流程实际通过（包bc31a75e…，两轮模型传输completed），但根代理内容复核拒绝将导师标为正确：注入仅移除causal mask、实际shape仍[1,2,6]，两轮错误地把module attention综合比较失败描述为shape不满足，第二轮重复了该误读。

首轮完整回复保留ignored本地v060-live-tutor-first-semantic-failure.json，Web结果归档v060-first-transport-pass.json，不提交模型原文。真实shape事件seq9来自student且无layer；seq70/88分别有实际layer0/1采样；seq4的全局失败早于focus中的seq10，均不能混为一条原因链。

修复为有界focus真实事件（最多64项，标明省略数量），保留seq/run/source/component/layer/step；全局最早失败单独提供。diagnostics不再丢组件/层归属。提示区分名称恰为module <component>的形状+数值综合比较，与module <component> execution shape执行形状检查；expected shape不是实测，缺layer不能补0，第二轮应纠正先前错误并补充证据。新反例回归及后续有限真实复验已通过，详见下方实际范围。暂停期间本机默认模型变为zai-coding-cn/glm-5.3/max；按用户授权复用当前默认，隔离helper仅复制该provider的一个credential ref，不复制其他provider。前后模型不同，不能据此作同模型A/B因果比较。

## 最终集成门禁

`npm.cmd run check`最终完整通过：57项行为测试与strict build、pack、空store离线安装及全旧包升级链。最终包160008字节，SHA256 `054f135447f1dd0366f5b86a3581d6274d48e1ccb95d51ef8e6601281aa0665e`，对应代码提交 `b991b2d62906a05611220472371da22e4cbdd3ed`。未发布、未push。

原生Electron实际通过：rc.5独立profile安装、CPU运行、切换课程、冷重启恢复、两层训练、layer1/head1矩阵、组件梯度与键盘。最终采用与验收page绑定的BrowserWindow.capturePage，并从该webContents确认runId；根代理查看PNG确为Neural Lab。该原生测试已对59b41dbc…包再次完整通过。后续候选只调整导师可执行约束及共享Host参数范围定义（合法域不变）；每份报告保留其实际包hash，未重跑无变化Python。

最终导师专项 `NEURAL_060_MODE=1 NEURAL_LIVE_TUTOR=1 NEURAL_TUTOR_ONLY=1 node tests/ui-official-session.mjs` 完整通过。以真实去mask错误run为依据，两轮当前默认zai-coding-cn/glm-5.3/max均completed，实际帮助仍unknown。根代理逐条内容复核通过这个受限样本：实测shape与缺layer正确、全局seq4与focus seq10分开、执行形状与综合比较分开；首轮只建议合法heads2→1，二轮改为一处学生head_weights掩码调用，不要求修改Host探针，不宣称未执行修复已通过，并说明第二层综合检查尚未知。没有把代理审核写成人类用户审核。

专项报告为ignored `.build/ui/v060-tutor-only-official-validation.json`，原回复仅本地ignored存档。此专项包为2d3c6b815705e4b95a7e72450e34685c9548585ff4d8dab1aab9242901fcba4c；之后仅共享参数白名单补Object.hasOwn guard，最终完整check重包验证，未再次调用模型。完整Web与native包为59b41dbc…；旧学习Web为bc31a75e…；不将它们冒称同一hash。最终产物身份由artifact.json单独记录。


## 可执行建议复核

提高预算后的两轮GLM回复传输通过，已正确区别实测shape、综合比较、全局seq4与局部seq10，但仍有可执行性错误：首轮建议T=1越过合法context范围，第二轮建议改变Host固定探针。该轮不计导师语义通过，原文归档ignored v060-live-tutor-inexecutable-advice.json；完整UI通过报告另存v060-ui-pass-advice-failure.json。

最终修复将allowedTrainingConfig作为Host校验和导师allowedRunConfig同一来源，禁止修改固定grader/fixture，要求建议只能涉及一个合法UI参数或一处学生源码。第二轮明确审查可执行性、撤回越界建议。增加域内/域外、固定steps及继承属性白名单回归。可选tutor-only门禁仅创建一个真实错误run并调用两轮，其报告范围明确，不冒充重复全部UI测试。

## 本轮失败与修复历史

- 子代理升级审批曾长时间无输出，由根中断后统一执行权限敏感门禁；普通npm缓存/ Docker named pipe拒绝访问不是产品PASS。
- 旧官方Web发现自由导师传输的可选context被JSON序列化为null，Host误拒Expected object；现仅将null/undefined视为缺省，HTTP回归同时验证array/string仍拒绝。
- 官方Web与Electron均复现切换后重复预测输入/编辑丢失；定位ActivityTab与实验组面板兄弟节点React key重复，改组key命名空间隔离。新增官方脚本记录RPC/编辑器摘要并捕获duplicate-key控制台消息，真实Web两层/梯度/键盘/主题/四项组统计已通过，完整后续路径已通过。
- 新UI脚本对label使用exact匹配失败（select的label含options），已修定位，产品未绕过断言。
- 最小凭据helper的Windows PowerShell继承pwsh模块路径导致Set-Acl加载失败，secret写入前即停止。根将PSModulePath限制为系统内置模块，空白文件ACL验证通过；真实模型调用结果单独记录。
- 保存失败运行解释最初覆盖repair规则，已改读取immutable run.check_status。曾硬拒绝显式复盘造成旧提醒无法确认，改为acknowledged-failure，自述不授掌握。

- GLM max reasoning第一轮被旧固定120秒取消，不能算成功；partial回复与取消报告已归档ignored。改用独立导师tutorTimeoutMs默认300秒、最大600秒，CPU预算不变，57项中覆盖配置边界与生命周期验证；整个新版Web验收最多15分钟。
- CDP截图曾超时；初版capturePage错误选到Welcome窗口，未认可为截图验收。改为绑定实际page对应BrowserWindow并验证runId后取得正确PNG。并行宿主时观察到一次面板切回新会话，原因未确定；串行完整Web未触发受控恢复。测试只允许一次显式重开并校验草稿/运行/组身份，重复切页会失败。

## 边界

新char协议受控stdout预算2MiB，旧协议64KiB不变；Host事件仍有独立总限额。观察检查只验证训练完整性，不证明泛化或实现掌握。模型回复实际帮助保守unknown，提示等级约束不等于自动精确分类。真实模型使用本机默认选择，每次验证限定两轮；历史语义失败与超时取消均保留，最终一次两轮通过。成功传输与根代理内容复核分别报告。checkpoint、GPU、多文件IDE、任意kernel、自动课程为明确后续范围。


## 最终候选身份对应

| 产物SHA256 | 本轮实际验收 |
|---|---|
| bc31a75e36c5615fbc0cc18ab818ba0d3b83e8bd152fdc79c42e7e830923d079 | 旧官方Web完整学习/保存/无模型/训练对照/复习路径 |
| 59b41dbbcff12de7bdb2cc7b89e8009935daf564f2731bff852477d4c2f899a1 | 新官方Web完整亮暗/键盘/组统计取消/观察路径，以及官方Electron完整功能与准确窗口截图；该轮导师建议未过语义复核，已另记 |
| 2d3c6b815705e4b95a7e72450e34685c9548585ff4d8dab1aab9242901fcba4c | 导师可执行约束修复后，tutor-only真实错误run与两轮传输/代理语义复核通过 |
| 054f135447f1dd0366f5b86a3581d6274d48e1ccb95d51ef8e6601281aa0665e | 最终Object.hasOwn参数白名单guard后57项/strict/build/pack/空缓存离线安装/全旧包升级链通过；合法参数域及Python/UI无变化，不重复模型或全GUI |

最终统一门禁报告 `.build/gate060.json`，包管理器安装身份 `.build/install-result.json`；历史CPU事件在 tests/results，具体UI报告在ignored .build/ui。凭据仅最小投影至调用自有临时home、先收紧ACL再写入，服务器结束后finally安全清理；报告记录cleanupCompleted/serverStopped。未改真实profile/会话，也未注销或撤销用户账号。

## 历史暂停快照（已恢复并完成，不代表当前状态）

以下引用保留当时未完成项；它们的后续解决与最终验收已在上文记录。

> ## 用户要求暂停的检查点（2026-11-06）
> 
> 任务已暂停，所有本轮工具会话均已结束，Astra 子代理已停止；不继续修改、测试或模型调用。最后一次官方 Web 会话记录 `cleanupCompleted=true`、`serverStopped=true`，隔离 profile 已清理，真实用户 profile 未修改。
> 
> - 当前候选包 0.6.0：158333 字节，SHA256 `bc31a75e36c5615fbc0cc18ab818ba0d3b83e8bd152fdc79c42e7e830923d079`。最近已提交 `fae7ccf`，其后 null 上下文兼容修复、测试及文档修改已保存但尚未提交；候选并非最终验收交付。
> - 新版官方 Web 的真实两层运行、调试证据、键盘、亮暗/窄屏、四项实验组统计、取消、观察证据及两轮真实默认模型传输均已通过。证据在包目录 `.build/ui/v060-official-validation.json`。
> - **导师语义验收未通过**：两轮把综合数值检查失败误读为形状失败，尽管实际 shape 正确。原始回复仍在 ignored `.build/ui/v060-live-tutor-replies.json`，尚未归档副本或实施语义修复。恢复时先保留该反例，再补所选组件的真实有界事件（seq/layer/step/source）、全局最早失败及形状/数值比较语义，添加回归并做有限两轮复验。
> - 原生桌面功能断言已通过，但 CDP 截图超时；脚本已改用真实 `BrowserWindow.capturePage()`，尚待复跑。旧 Web 已通过自由提问与训练，延迟复习定位已按新规则更新，尚待复跑。
> - 恢复后的其余工作：完成上述验证、最终候选打包/身份检查、更新验收清单与文档，最后提交。不要将原始模型回复、凭据或生成包加入 Git；保留用户原有未跟踪 `docs/neural-lab-1106/`。
