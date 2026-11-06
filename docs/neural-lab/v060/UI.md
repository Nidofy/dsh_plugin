# 0.6.0 组件调试工作台

`DebugWorkbench` 接收 `{ run, exercise, draft, onTutor? }`。导师回调携带 `runId/component/check?/level`，集成方负责真实请求和帮助等级记录。组件无 API 副作用，不直接更改草稿或运行。全部源码切片读取 `run.code`，显示运行 codeHash 与组件快照哈希。

组件图来自 `exercise.components` 和 `dependsOn`；数据流导览与依赖关系分开标注。节点按钮支持方向键、Home/End 和 aria-pressed，选择后同步检查、shape、梯度、源码与导师上下文。浅深主题复用 `--nl-*` 变量，窄布局自动换行，证据表可横向滚动。

仅使用 runId 等于当前运行的事件。显式 component/layer 优先；旧版只映射控制器确切命名和 `attention.layerN.headM`，全局 gradient_norm/parameter_delta 保留为未归属指标。缺失 source/step/layer 显示未知，不伪造分层采样。层选择由真实事件产生，支持 Layer 0/1 及更多层；选择单层排除层未知事件。检查失败顺序由 seq 决定，最早观察与后续观察不解释为因果关系。

切换运行时同步重置选择和提示级别，防止跨运行短暂混合。活动不匹配时阻止显示证据；排队、运行、异常终止、取消、空数据、旧记录及组件标记损坏均显示明确状态。代码提示为通用诊断指导，不包含参考答案。

验证：`node --test packages/neural-lab/tests/debug060.test.mjs` 执行真实模型与组件处理函数，React hooks/JSX 使用 mock harness，不代表浏览器或 Host 验收。覆盖跨 run 污染、两层过滤、全局梯度、失败顺序、源码切片、键盘导航、导师上下文、未采集与取消/旧记录。真实浏览器与打包由集成阶段验证。
