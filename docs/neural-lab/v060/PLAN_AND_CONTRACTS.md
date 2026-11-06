# Neural Lab 0.6 契约与全范围验收

基线 bf344797d1a45eb5827c027dd192a52b96239c19 / 0.5.1。用户已授权完整0.6，并明确可在隔离profile有限两轮调用本机默认模型。保留旧协议/旧数据，不push、不发布、不修改真实profile。最终版本0.6.0。

## 分工

A唯一TypeScript共享类型、Host RPC、runner/engine/store、活动索引、版本和集成写者。B只新DebugWorkbench/debug-model及专用回归。D独占Python runtime（可新模块，旧协议冻结）及新数值fixture；CLI/事件接口由A在此冻结。C下一波独立活动/教学素材与迁移质量；E下一波导师服务及真实模型测试入口。每线独立worktree codex/neural-lab-060-*；子线程禁止重复升级审批，A统一真机门禁。根只读安全/数学审查。

## v060 契约

- 旧 RunRecord / ProjectFile1 / SQLite1保留。RunEvent可选component:string、layer:number明确采集归属，缺值显示未采集。新增运行mode='check'|'observe'、groupId及expectedImageId（可信组内部赋值），观察不授实现掌握。
- 新runtimeKey：train-mlp-multi-v1（3输出）；project-char-flex-v1（width6，B1..4/T2..8/H1,2,3,6）；project-char-two-v1（两层快判）；project-char-observe-v1（两层8..24步观察）。旧argv4学习率不变，新协议argv5有界JSON配置。层数协议固定，不能任意kernel/文件/资源输入。
- 新活动独立ID/content/testVersion，既有旧run不能满足新活动完成。旧协议数值不可悄然改变。错误修复活动复用新协议与损坏starter，必须修代码再解释。
- ExperimentGroup使用同一SQLite KV/history，冻结exercise/content/test/protocol、代码hash/组件、attempt/help、镜像ID、seed/lr组合、假设与总预算。最多6项顺序执行、最多10分钟含等待，取消要等待当前run清理；每个计划项预分配runId。镜像标签变化则拒绝后续项，不悄然换环境。重新打开active组标interrupted，不自动恢复/重放未知写入。统计只从该组实际run归集，包含失败/取消/缺指标，样本标准差明确n；不推断因果。
- 导师请求可选runId/component/check，校验活动与真实快照；requested help与delivered help分开，未知实际输出保守unknown或显式学习者反馈，不伪装自动精确分类。两轮真实默认模型验收独立临时profile，密钥不输出、不提交。

## 必须完成的验收清单

- [x] 调试台：真实关系图，组件联动shape/check/梯度/源码，最早失败/后续观察区分，分级诊断，换run/改稿隔离，键盘。
- [x] 可执行迁移：MLP多输出MSE解析梯度、合法B/T/head；泄漏/断梯度修复starter，解释；实现/解释/迁移/帮助维度证据与来源规则复习，旧版不算新完成。
- [x] 导师：具体组件/检查两轮、单变量建议、提示约束、真实默认模型成功；取消/无模型不算帮助。
- [x] 实验组：顺序多seed/lr、冻结身份、均值/样本标准差/失败统计、假设/结论/限制、总预算/取消/重启中断与隔离。
- [x] 两层与观察：学生模块实际参与两层梯度、快判与8..24步观察分离、每层真实有限attention/梯度/参数诊断；错layer2/detach/backward/mask拒绝。
- [x] 工程交付：首次环境诊断，亮暗主题与键盘实际浏览器，统一门禁，旧库升级、空缓存离线、官方Web/Electron、包SHA256。

检查点恢复仅列后续；GPU、多文件IDE、任意kernel、自动课程本轮明确暂缓。任何环境阻塞独立报告，不能以stub冒充真实模型或CPU。


最终验收已完成，详见 [实际结果与失败历史](VALIDATION.md)。六项勾选依据包含真实CPU、官方Web/原生Electron、有限两轮默认模型与代理内容复核；不代表模型所有未来输出必然正确。最终包身份见 ../artifact.json。UI/native与最终导师专项测试的候选hash不同，范围与最后guard重包差异在验收记录中逐项注明。
