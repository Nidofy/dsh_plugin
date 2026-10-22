# AI Village UI-v1.1 实施决策

工作依据：AI_Village_UI_v1_1_Workpack_20261022 全部 01–07；review 下四份 Markdown 与 opus55.pdf 全部 13 页。未采用纸质路线、森林绿底、自动镜头偏移、重绘家具/暮色建议。

- M0：HEAD e85ccc704f07edada1b59a574354fad859e44d79，基线 28 文件/121 测试及类型检查通过；用户两份未跟踪文档记录哈希，保持原样。世界 schema6、frame protocol3、360×480 与 720×960 不变。
- M1：已确认代码缺口是 heartbeat fail 锁存 disconnected/error，后续成功不清除；受控 TypeError 注入覆盖此路径。用户现场根因未确认。独立同租约协调器先续租验证所有权，再读 world/preferences 身份与修订；只调用既有 reconcile，绝不重放 save/preferences-save。恢复保留 draft/undo、user/photo/arrange；提交已确认的布置草稿保留并重新校验，若修订已变化明确要求退出重开。自动协调器不调用 retry 或 acquire。
- M1：1/2/4 秒至多三次，隐藏和代际变化中止；周期心跳失败不会重置自动恢复预算。未知来源默认不自动恢复；HTTP 502/503/504 仅 heartbeat 来源入白名单。
- M2：结构化契约保存在 ui-contract.json；core/ui-v11-contract.ts 为生成副本，单测逐项验证一致。颜色从 ui-theme 统一下发，尺寸从 uiMetrics 计算。正式 0.2.1-rc.2 ThemePresenter 的 html.style.colorScheme / body[data-ds-dark-theme] 已核对；无标记回退系统，DOM data-theme-source 记录来源。
- M2：初次截图发现 inline --panel 会压过实色回退，改为 inline --glass、样式层 --panel，并加入计算背景断言；不关闭软件回退制造 GPU 图。截图等待 180ms 动画结束。
- M3：保留原 presentation owner 和兼容字段 drawer/overlay，新增受控 page/history；half/full 现在仅分别表示摘要/详情，不再代表旧高度。返回保存路由、UI 目标、滚动、焦点，不重放业务命令。跨断点只重算 CSS tokens。
- M4：布置退出确认区分“退出布置”与“关闭插件”；pending/unknown 保持事务守卫。照片保持原 renderer 与输出，仅加缩略图加载/错误占位。技术字段移到诊断详情。

旧规范覆盖：UI-v1 §3.2–3.3 默认 .48H、短高深展开、宽窗全高；§4.1 森林绿及 HUD 底；§10 全高设置；§11 无来源浮层返回；§7.2 偏好 schema2 → 本轮 schema3。旧文件原文保留。

工程执行结果见 RESULTS.md 与 ACCEPTANCE.md。真实 GPU、Windows DPI/真实 IME/多屏/睡眠及人工观感没有自动签收；一小时运行保持 DEFERRED。

- 最终验收补修：摘要卡打开时frame input-router原先优先选择resident，可能点击穿透。仅调整dismiss优先级并新增运行/暂停两种输入测试；因此frame bundle SHA改变，protocol/投影/美术/照片不变。
- PanelShell内容按route key更新，保证140ms子页动画实际触发；居民按钮使用稳定focus key。
- 相册无保存索引时原state=null不能区分加载与空态；增加读取完成状态，验证503错误占位与重新进入恢复。
- 诊断恢复保持原有显式恢复语义；自动协调器在显式恢复时取消且不并发。系统故障/空间不足沿用持久安全提示区，共享surface材质，不随普通导航返回隐藏未解决故障。
- 连续复验捕获跨iframe消息的一帧竞态：摘要卡已打开而frame尚未收到render时，旧resident/actor输入仍可能到达父页。runtime增加父页权威守卫和整段pointer消费；同时阻止旧camera输入穿过工具卡，新增独立回归。
- 最后截图修正：模式文字退出按钮不再套用40px图标固定宽度；200%时间标签单行省略，避免挤压HUD。
- ui-contract.json 与生成常量保留工作包原始来源字段（包括 PLANNED 标记），用于冻结参数逐项一致性核验；本次实现/验收状态以 RESULTS、ACCEPTANCE 和 BUILD_RESULTS 为准。
