# UI-v1.1 验收记录

2026-10-22。工程证据与现场签收分开。混合条目中，只要指定的现场部分未执行，整体标 NOT RUN；右列单独说明已通过的工程部分。NEEDS_REVIEW 是待人工判断，不等于 FAIL 或 PASS。所有截图为实际生产组件与官方 Host/Connection 的隔离夹具，非静态设计稿，也不是日常 Desktop profile 的录屏。

相对证据路径基于 packages/ai-village/art/QA/ui-v11；日志归档见本目录 logs。最终机器汇总见 RESULTS.md。

| ID | 要求 | 状态 | 本轮证据/边界 |
|---|---|---|---|
| A01 | 记录实际HEAD/dirty/diff及bundle SHA；不覆盖用户修改 | PASS | baseline.json、source-manifest.json、changes.patch；两份原未跟踪文档哈希未变 |
| A02 | 既有小院测试与类型检查，区分基线与新增回归 | PASS | logs/baseline-tests.log 与 logs/tests.log；正式构建包含严格 Host/Client 类型检查 |
| A03 | schema1/2→3迁移、旧主题/已读/偏好完整保留，非法值拒绝 | PASS | ui-v1.spec.ts schema1/2 原字节保护；ui-v11.spec.ts 严格迁移与非法值 |
| A04 | 旧0.6.2回退路径说明与备份可用，不覆盖新偏好 | PASS | rollback.json；实际 e85ccc7 decoder + 隔离备份恢复；MIGRATION.md |
| A05 | 四主入口全部旧业务操作迁移可达 | PASS | FEATURE_MAP.md；content/neighborhood 实际业务回归 |
| B01 | 三密度档computed font-size、line-height和宿主字体符合契约 | PASS | visual/metadata.json：13/14/15px，标题15/16/18，line-height1.45，继承宿主字体 |
| B02 | DPR1/1.25/1.5/2不重复放大DOM；场景与文字缩放独立 | NOT RUN | interaction-checks 模拟 DPR1/1.25/1.5/2 通过；真实 Windows DPI 未运行 |
| B03 | 90–200%文字大小均可操作，无低于12的辅助字 | PASS | visual/text-scale-*；90–200%，中英文与末尾控件滚动可达 |
| B04 | 快速卡只给摘要；340×720最大316×158，不再.48H | PASS | visual/validation.json：340×720 摘要上限316×158 |
| B05 | 320×360不自动全高；248×128窄卡可返回且能进入全部内容 | PASS | 320×360 light/dark zh/en：248×128，返回栏保持可用 |
| B06 | 设置根页max min(224,.42H)，详情max min(320,.52H) | PASS | 矩阵脚本实测根卡224/.42H、详情320/.52H上限 |
| B07 | 已展开跨479/480/481及559/560、899/900重算，不重置页面 | PASS | 479/480/481、559/560、899/900 状态及 iframe 对照 |
| B08 | 内容区滚动，头部/按钮可达，列表滚轮不触发相机 | PASS | interaction-checks：名单滚动/焦点恢复、滚轮不修改相机 |
| B09 | 普通面板切换iframe不重建，世界/观察镜头不跳变 | PASS | visual：同 iframe；导航不写 world；interaction-checks：camera 未改变 |
| C01 | HUD/Dock按钮默认无background/border/box-shadow/blur | PASS | visual 中 HUD/Dock background/border/shadow/blur computed assertions |
| C02 | 按钮40px命中区与清楚图标共存；hover/focus/disabled可辨认 | PASS | 40px 控件契约、焦点截图、250ms 名称提示；现场视觉仍待签收 |
| C03 | 真实GPU浅/深×窄/宽玻璃确实透出并模糊iframe/Pixi画面 | NOT RUN | 无硬件GPU证据；全部自动浏览器为 Chromium SwiftShader，未强制关闭回退 |
| C04 | 实色回退与减少透明保留，原因记录准确，不覆盖HUD透明variant | PASS | interaction-checks/fallback-{light,dark}-{340,1080}；软件/减少透明原因与计算实色通过；不支持blur的真实浏览器未覆盖 |
| C05 | 没有森林深绿大底、默认蓝控件或白底原生select残留 | NEEDS_REVIEW | 已巡视代表性设置/照片/入住/布置截图；原生控件主题化，人工统一感待F08 |
| C06 | 文字≥4.5、必要图形/状态≥3，真实合成背景上可读 | NOT RUN | 真实GPU合成背景像素对比未量测，不能以色板或CSS.supports替代 |
| C07 | host/system/light/dark各自语义正确，已选偏好不静默改变 | PASS | interaction-checks：正式宿主DOM标记、系统media、显式模式独立；content冷启动偏好保留 |
| C08 | 环境不写UI明暗；UI深色不自动切夜景；未来色板夹具不新增场景 | PASS | world/prefs差分；ocean/urban仅DOM token测试夹具，不进入生产选择或存档 |
| C09 | 180/140/120ms过渡真实存在，减少动态归零，无大范围blur动画 | PASS | 180/140/120/250ms契约；route key重新触发子页；reduce-motion计算值为0；录屏 |
| C10 | 小院样式不污染Git/Live2D/宿主，重复启停不累积style/监听器 | PASS | registration卸载测试及生命周期50次；样式限定village；实际Desktop多插件现场待F05 |
| D01 | 四入口→二级→返回，恢复滚动/目标/焦点，不重放活动 | PASS | reducer + interaction-checks：Qwen目标、滚动、精确focus key；不重放业务 |
| D02 | 居民详情→设置→外观→返回×2回居民详情 | PASS | visual/validation.json：居民→设置→外观→返回×2 |
| D03 | 更多→设置→返回回更多；×则回小院 | PASS | visual：更多→设置→返回=更多；关闭=场景 |
| D04 | 切tab不不断push；栈深最大8；关闭小院仍是独立命令 | PASS | ui-v11.spec.ts：stack≤8、tab清栈；独立退出确认 |
| D05 | IME Escape不被小院截获；普通Esc只返回一级 | NOT RUN | 合成IME Escape通过；真实中文输入法尚未运行 |
| D06 | 只打开一个普通玻璃surface；设置等打开隐藏Dock，返回恢复 | PASS | PanelShell及实际页面截图；普通surface唯一；settings/notices/more/view隐藏Dock |
| D07 | 透明空白可通行；关闭浮层的点击不同时拖起人物 | PASS | input-router新增暂停/运行两种测试；interaction-checks居民首次点击仅关闭卡片 |
| D08 | 布置脏草稿返回需确认；pending/unknown不能误取消或报已保存 | PASS | runtime与recovery fault injection：dirty确认；pending/unknown不取消、不重放 |
| D09 | 非模态工具卡不造成Tab死循环；危险确认正确圈定焦点 | PASS | interaction-checks：普通Tab可离开；布置/照片删除危险确认焦点循环 |
| E01 | 人工暂停无错误卡；返回页面不自动清userPaused | PASS | runtime+visual：人工暂停只保留user，无错误卡 |
| E02 | hidden/sidebar解除后仅清自身reason，满足运行条件自动继续 | PASS | lifecycle：50侧栏循环；recovery：隐藏取消读请求，回来再核对 |
| E03 | user+hidden、arrange+hidden、photo+user组合正确 | PASS | runtime：user/hidden/arrange组合；照片保留先前user暂停 |
| E04 | 同transport connected下心跳失败再成功，核对通过后自动恢复 | PASS | recovery-validation.json：真实fetch心跳失败、transport保持connected、核对后恢复 |
| E05 | 已写入但回执丢失，仅read/reconcile一次操作，不重复奖励/写入 | PASS | recovery-validation.json：server提交后丢ACK，save POST只一次，后续读reconcile |
| E06 | 持续unknown/明确rejected不强制继续；文案真实 | PASS | 持续unknown三次后仍阻断；transaction拒绝结果测试；不清reason伪装已保存 |
| E07 | 其他owner/外部revision/profile变化不静默覆盖或接管 | PASS | 两个真实认证runtime占用测试；profile/revision冲突单测拒绝接管 |
| E08 | 自动恢复不丢arrangement草稿/undo；不能调用会清草稿的通用retry | PASS | recovery：同草稿/undo/controller/frame；不调用通用retry |
| E09 | 恢复需frameReady；旧generation晚回包不能触发schedule | PASS | runtime：frameReady门槛；旧generation延迟state返回不能发布到新连接 |
| E10 | 1/2/4秒最多3次；隐藏/卸载取消旧尝试，不留重试风暴 | PASS | fake timers 1/2/4三次；隐藏/卸载/代际abort；显式恢复排除自动协调器 |
| E11 | 普通设置/通知不暂停，不弹“内存保留”或技术Toast | PASS | 导航不增暂停原因；故障文案与普通暂停分开；无正常状态技术Toast |
| E12 | 诊断环限200条/32KiB，无密钥/lease/请求体/聊天内容 | PASS | DiagnosticTrace closed-field allowlist；200条/32KiB测试，无密钥/lease/正文 |
| E13 | 用户现场那一次暂停原因仍未复现时明确写未确认 | PASS | 现场原始暂停根因 NOT CONFIRMED；注入心跳路径确认不能替代现场复现 |
| F01 | 布局锚点/5px/26px/ghost/undo/pending保护未退化 | PASS | home/input-router/frame等单测；content实际预览/撤销/确认/锚点回归 |
| F02 | 照片720×960、同世界同参数跨窗口结果一致，UI不进入照片 | PASS | visual/capture-{340,580,1080}.png；720×960字节相等，独立于界面截图 |
| F03 | 相册缩略图加载/失败/空态、查看/导出/删除闭环 | PASS | interaction-checks：加载/503失败/重新进入/查看/导出/删除/空态；neighborhood冷启动 |
| F04 | 通知来自确认事实，重连/切页/读写不重复弹旧消息 | PASS | runtime notices确认门槛/读写序列/历史已读；neighborhood12事实冷启动 |
| F05 | composer完整避让、Git共存、Live2D互斥、会话切换世界保留 | NOT RUN | 官方Connection/Host + 真实生产组件隔离夹具通过composer/Git/Live2D/会话生命周期；日常Desktop现场未运行 |
| F06 | 同机同后端与0.6.2对照，不只量JS提交时间；保留原性能门槛 | NOT RUN | performance.json 同机0.6.2/0.6.3三轮；保留原15%CPU门槛；硬件GPU合成/交互延迟未运行 |
| F07 | 正式构建/离线包/空缓存安装验证，图与包哈希对应 | PASS | logs/build/pack/smoke/offline；package-manifest.json与逐图/源码哈希；临时profile |
| F08 | 七项用户观感逐项签收，不由几何脚本替代 | NEEDS_REVIEW | 七项人工观感均NEEDS_REVIEW，见MANUAL_REVIEW.md |
| F09 | 一小时真实运行保持原暂缓决定 | DEFERRED | 一小时真实运行 DEFERRED，短时自动化不替代 |
