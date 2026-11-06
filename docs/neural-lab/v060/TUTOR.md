# 0.6 局部导师

`askActivityTutor` 保持已有参数，最后新增可选 `TutorContext { runId, component, check? }`。Host 必须转发末尾 context。实际运行必须属于请求活动；组件须存在活动契约或受支持 MLP 的 train_step/validate。check 名称必须来自该 run 的 check 事件，且每个同名事件均须有一致归属：优先真实 event.component；冻结旧 MLP 六个控制器检查名称映射；无映射则拒绝，不从文案猜测。检查整体训练合同不能伪归属到单一组件。验证在保存请求和调用模型前完成。

选中旧 run 时全部状态、检查、事件、配置、代码和版本都来自该 run；currentDraft 独立。focus 单独保留真实检查，不受末尾事件截断影响。历史保留同尝试最近八条消息。模型 system prompt 约束 concept 不给代码、steps 最多三小步、code 局部代码、answer 才允许答案，unknown 按 concept。提示围绕具体检查承接第二轮、区分 completed/passed、旧运行/当前草稿，固定 seed/数据/环境的单变量对照不作因果断言。这是提示约束，不保证模型绝不越界。

成功非空回复实际帮助保守记录 unknown，不按请求模式自动归类。message 保留 requestedMode、请求时 observedHelp、context、deliveredHelp、helpSource=mentor、helpAssessment=unclassified；失败/取消/不可用不记录 help-delivered。原 mode 字段保留兼容。共享 Workspace 类型由集成线扩展，不改变 SQLite。

## 验证

- `node --experimental-transform-types --test tests/tutor060.test.ts`：4/4 通过（2026-11-06）。涵盖两轮、具体检查、旧 run/新 draft、未知帮助、无效归属、显式 component 映射、失败/取消/无模型/空输出。
- 旧 `tutor-1106.test.ts` 5/6 通过；唯一旧断言将 concept 请求等同 concept 交付，应由集成线改为 unknown。其取消资源释放、迟到回复尝试隔离、多轮截断均通过。
- 本线 build 在官方源码 git ownership 检查处被阻断，未升级权限或修改全局 Git 配置。集成线统一类型检查/构建/打包。
- 本线未执行真实模型，不声称真实模型通过。

## 真实默认模型入口

官方 rc.5 源码核对：`packages/core/agent/src/index.ts` 的 agents.create 接受 setup/signal，返回 owned handle.dispose；signal 只约束创建，回合需显式 agent.cancel。`packages/core/agent-default-model/src/index.ts` 的 currentSelection 返回 provider/model/reasoningEffort；不需读取密钥。现有 mentor 复用这些公开服务，工具 allow=[]，独立 session/event 监听最终释放。

入口 `tests/tutor060-live.mjs` 导出 `runTutor060Live({ctx, engine, context, isolated:true, signal?})`；调用方负责隔离 profile、授权的最小默认模型配置、真实 CPU run 和清理。只执行至多两轮、不自动重试、总 120 秒取消信号。失败不冒充成功，返回正文供本地人工检查；完成两轮也仅标 requires-human-review。人工核对引用正确 run/check、无代码越界、二轮承接、单变量控制与不夸大因果。

独立 CLI：设置 `NEURAL_TUTOR060_HARNESS` 为本地模块绝对路径，该模块导出 `openTutor060Harness()` 返回上述参数及 `dispose()`；运行 `node --experimental-transform-types tests/tutor060-live.mjs`。CLI 不定位用户配置、不读密钥、不输出回复/提示/错误原文，只输出轮次状态、长度和哈希。A/根负责配置借用及真实执行。

规则复习建议：由现有 engine/store 对当前 content/testVersion、证据 provenance/result/help 生成可解释复习理由，导师不增加存储 owner。解释/观察不变成实现通过，未知帮助不能记为独立掌握。
