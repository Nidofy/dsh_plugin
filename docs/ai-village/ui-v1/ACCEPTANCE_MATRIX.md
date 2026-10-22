# AI 小院 UI-v1 验收矩阵

**本轮结果见文末逐项执行记录。** 日期2026-10-22，0.6.2 / 2cab99a 加本轮未提交修改。未覆盖整个条件的行标NOT RUN并列出已通过子项；不把局部测试当成整项通过。当前不是全项验收通过。

## A. 设计与可达性

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| A01 | P0 | 340×720新开 | 无大标题/选择框/存档/帮助常驻行；场景fill，Dock收起 |
| A02 | P0 | 320×360、340×480 | 按钮≥40、字≥12；短高不溢出；主要操作可到达 |
| A03 | P0 | W<320或H<360 | 明确空间不足暂停；聊天输入可用；不显示可操作的假场景 |
| A04 | P0 | 340→580→1080→340 | HUD在560断点；管理层在900断点；同一runtime/world |
| A05 | P0 | 全部旧功能映射清单 | 每个旧操作有真实入口；无重复写入入口/假按钮 |
| A06 | P0 | 中英×浅深主题 | 文案无截断重叠；标点/标签可读；主题按偏好 |
| A07 | P0 | 图标、完整居民头像 | SVG统一；不使用emoji和face单层头像 |
| A08 | P1 | 减少动态/透明 | 关闭过渡/模糊后布局、信息、操作不减少 |
| A09 | P0 | Tab点击/方向键/收起 | 准确符合半开/深开/切页规则；不自动hover展开 |
| A10 | P0 | 鼠标+键盘 | 所有拖动都有按钮替代；焦点和aria名称完整 |

## B. 视口、镜头与输入

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| B01 | P0 | 原点、四角、各座位投影往返 | 世界→CSS→世界误差≤0.5逻辑单位；DPR不双乘 |
| B02 | P0 | 全景1×任意支持尺寸 | 360×480真实世界完整、等比；真实背景与家具同变换 |
| B03 | P0 | 1–1.5×缩放和平移 | 不越界；可恢复全景；无存档/坐标变化 |
| B04 | P0 | 滚轮在列表/slider/设置/场景 | 仅场景缩放；UI滚动不改变camera；Ctrl/Meta+Wheel不被截走 |
| B05 | P0 | 同一居民轻点<5px/拖动≥5px | 抬起才选择；拖动不误选或自动发活动 |
| B06 | P0 | 抓住角色后缩放/移动鼠标到外部 | 不发生镜头变换；capture与cancel正确 |
| B07 | P0 | resize、DPR改变、展开途中拖动 | 当前手势取消，不提交半完成移动；旧viewport输入拒绝 |
| B08 | P0 | 打开/关闭普通抽屉50次 | iframe身份不变，world/动画不重置，比例不跳 |
| B09 | P0 | 幕外/氛围延展点击或落点 | 不是可行走区域；不造新家具/位置 |
| B10 | P0 | IME composing下Escape | 不取消草稿/关闭界面；正常Escape只消费一层 |
| B11 | P0 | 悬浮层外点击 | 关闭本层，无穿透拖动或宿主发送 |
| B12 | P1 | 气泡与居民卡靠近边缘 | 夹在插件安全区，文字≥12，不出界、不挡关键保存按钮 |

## C. 内容与布置

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| C01 | P0 | 入住/离开/全员/仅留当前 | 至少1人，选中与列表一致；错误不假成功 |
| C02 | P0 | 八单人+六双人活动 | 原条件/结果/取消保持；按钮禁用有正确原因 |
| C03 | P0 | 3种布局×2⁴锚点＝48组合的几何验证 | 原布局约束仍成立；不修改合法集合 |
| C04 | P0 | 四组各两个锚点，按钮与拖动 | 两种输入产生同一草稿；座位/障碍/点击/绘制同步 |
| C05 | P0 | 持续pointermove100次后合法drop | 一步undo；不保存100次；同锚点不追加undo |
| C06 | P0 | 非法/被居民占用落点 | 明确拒绝；保持上次有效草稿；不瞬移居民 |
| C07 | P0 | undo20步与边界 | 超出上限有界；取消后世界完全不受影响 |
| C08 | P0 | 草稿时换环境、换目标居民配饰 | 使用同一个Home草稿；不改world.actor做选择捷径 |
| C09 | P0 | Home与不同挂饰切换 | 必须先结束当前草稿；不并存；无虚假的挂饰undo |
| C10 | P0 | 三挂饰三挂点/收起 | 锁定条件真实；放置成功以commit为准；基础家具无删除 |
| C11 | P0 | 活动进行时开始装修 | 拒绝并说明；不自动取消剧情 |
| C12 | P0 | 确认pending/rejected/unknown | 不假成功、不丢草稿、不重放未知写入；只读核对 |
| C13 | P0 | 保存成功 | 恢复观察相机，仅清arrange，不清user或其他暂停 |
| C14 | P0 | dirty草稿关闭/取消/临时隐藏 | 显式放弃有确认；隐藏保留；恢复重检；手势本身取消 |
| C15 | P0 | 同一住户重复回忆 | 首次事实不改变，count保留，装饰不重复发 |

## D. 通知与偏好

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| D01 | P0 | 新事实未commit/ACK丢失 | 没有“已保存/已解锁”消息；只读确认后只出现一次 |
| D02 | P0 | 重复活动、漫步、吃饭、预览 | 不产生永久新通知；队列有界 |
| D03 | P0 | 旧偏好1→2 | 主题/语言/气泡/动态保持；旧字节保护；世界schema不变 |
| D04 | P0 | 首次升级已有12回忆 | 作为已读历史，无逐条补弹；初始化失败不假成功 |
| D05 | P0 | 点击入口/点击消息/全部已读 | 打开不标读；定位后标读；重启已读保持 |
| D06 | P0 | mark read与主题修改并发 | 单偏好writer；不静默丢已接受操作；不写world |
| D07 | P0 | 0未读/多条消息/面板滚动 | 入口常驻，3–4条首屏可滚动，角标真实 |
| D08 | P1 | 3秒内多个事实、5秒toast | 合并且最多1条；hover/focus停计时；不因消失标读 |
| D09 | P0 | 拖动/编辑/拍照/错误期间新消息 | 延后合并；事实保留；不覆盖关键操作 |
| D10 | P0 | 坏/未来/超长偏好与未知回执 | 拒绝、保护原件、可读错误；不默认清空 |

## E. 照片

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| E01 | P0 | user暂停→进入/退出拍照 | 原user暂停仍在；只增减photo原因 |
| E02 | P0 | 同冻结fixture在340/580/1080尺寸拍照 | 720×960内容构图一致，不受观察camera影响 |
| E03 | P0 | 日期/边框/1–1.5×取景 | 预览与输出一致；原裁剪限幅保持 |
| E04 | P0 | 相片内容 | 实际位置/环境/配饰入图；HUD/气泡/ghost/氛围填充不入图 |
| E05 | P0 | 连续20次拍摄/取消 | 无额外常驻Application/ticker；临时纹理/URL释放 |
| E06 | P0 | 相册20张/40MiB/单张4MiB、删除确认 | 原限制有效；删除不删回忆/解锁 |
| E07 | P0 | 相册保存超时/重连/冷恢复 | 原CAS与只读核对保持，不重复照片条目 |

## F. 宿主、存档、安全与性能

| ID | 优先级 | 操作/条件 | 必须观察到 |
|---|---|---|---|
| F01 | P0 | 同进程切会话、sidebar50次 | 同一世界；有效草稿保留；无额外模拟/writer |
| F02 | P0 | 宿主内展开/收起50次 | 非真正隐藏时同一iframe；不覆盖完整composer |
| F03 | P0 | 输入未发送文字+附件增加composer高度 | 草稿/附件不丢；自动避让；不发送模型请求 |
| F04 | P0 | Git/Hg共存、Live2D互斥 | 既有协调与留白恢复；不抢回已让出的区域 |
| F05 | P0 | 隐藏/closed/断连/资源缺失 | tick与绘制停；返回不补离线收益；错误不清用户暂停 |
| F06 | P0 | 世界schema1–6测试、当前存档 | 历史迁移与原件保护保持；当前仍schema6 |
| F07 | P0 | 所有权冲突/双Host/多窗口 | 无第二writer或并行模拟；当前只读/暂停处理保持 |
| F08 | P0 | 协议source/origin/token/序列/viewport/version攻击 | 所有旧拒绝项保持，新增camera/arrange同等严格 |
| F09 | P0 | 网络被阻断的安装与运行 | 无CDN/模型/补图请求；仅原认证Host通道 |
| F10 | P0 | 隐藏/重开/卸载反复循环 | 监听器、iframe、纹理、URL无持续增长；退出均可清理 |
| F11 | P1 | 同条件旧/新：1人、7人、活动、展开、隐藏 | 记录renderer p50/p95、父页面CPU/堆；不伪称GPU完成耗时 |
| F12 | P1 | 短时性能门 | 相同设备/视口/人数/renderer下三次采样；p95超过baseline的max(20%,1ms)增量或CPU中位数增幅>15%时阻止性能通过并分析；不得比较不同viewport数字 |
| F13 | P0 | build/pack/smoke/offline-install | 测试的是本次产物；版本/哈希/文件清单明确 |

## G. 必须单独标记的人工现场项目

G01：Windows真实100/125/150/200%缩放和多屏；G02：真实中文IME与宿主审批；G03：正常前台GPU及主工作任务并行；G04：系统睡眠/唤醒；G05：七人拥挤/遮挡、画风、文字语气人工观感。不得把浏览器DPR仿真、合成isComposing或headless帧率记作这些项目PASS。

G06：一小时真实运行验收，仓库已有用户暂缓指令；本轮保持DEFERRED，不自动执行。

## 视觉证据命名和最小组合

必须有：340×720浅/深中文默认；340×720居民半开；340×720设置；340×720布置合法/非法；340×720拍照；580×720英文默认/手账；1080×760浅/深默认/右面板；320×360短高；完整DSH composer避让截图。

每张图包含实际状态名、viewport CSS尺寸、DPR与构建身份元数据。不得仅提交裁剪局部来掩盖宿主遮挡。布局稿的截图只能标为DESIGN，不可放进RUNTIME PASS证据。

## 本轮逐项执行记录

命令、时间和构建哈希见 RESULTS.md；证据根为 packages/ai-village/art/QA/ui-v1/。单位/事务测试的共同证据是 tests.log（28文件121项通过）。下表描述本次实际覆盖，原需求表保持不变。

| ID | 结果 | 实际证据与覆盖边界 |
|---|---|---|
| A01 | PASS | UI运行图：340x720-light-zh-default；单一场景与收起Dock |
| A02 | PASS | 320x360-short、short-arrange-options、340x480-default；短高滚动区与保存按钮可达 |
| A03 | PASS | lifecycle.json：不足空间暂停、控件与composer仍可用 |
| A04 | PASS | UI运行与lifecycle：340/580/1080切换、50次展开同iframe |
| A05 | PASS | UI_V1_BASELINE.md旧功能映射；content/neighborhood真实动作回归 |
| A06 | PASS | 23张运行图中的zh/en、light/dark；人工文案观感仍见G05 |
| A07 | PASS | SVG源、七张完整PaperDoll头像及资产manifest；截图检查 |
| A08 | PASS | 偏好验证、减少动态CSS、软件渲染实色回退；正常GPU见G03 |
| A09 | PASS | ui-v1.spec presentation reducer；50次抽屉开关；方向键实现代码审阅 |
| A10 | NOT RUN | 按钮替代与aria实现已审阅、Escape焦点回归PASS；所有控件逐项纯键盘巡检未执行 |
| B01 | PASS | viewport.spec、ui-v1.spec：五尺寸含DPR和世界投影往返 |
| B02 | PASS | 五尺寸投影测试与窄宽运行图；真实背景和worldContent同一stage |
| B03 | PASS | camera纯函数及input-router：1–1.5缩放、夹紧、取消平移恢复；camera不写World |
| B04 | NOT RUN | actor capture和Ctrl/Meta+Wheel单测PASS；列表/slider/设置全部实机滚轮路径未逐一执行 |
| B05 | PASS | input-router.client：抬起选择、5px阈值和手势所有权；原拖动回归 |
| B06 | PASS | input-router.client：actor capture期间wheel锁定、blur/cancel |
| B07 | NOT RUN | 协议viewport过期拒绝和resize取消自动化PASS；物理DPR变化途中拖动未执行（G01） |
| B08 | PASS | visual/validation.json：50次抽屉开关同frame、world、投影 |
| B09 | PASS | camera/viewport边界、布置非法drop与输入路由纯测试；非世界延展不可交互 |
| B10 | PASS | lifecycle.json：合成isComposing保护、普通Escape只取消一层；真实IME另记G02 |
| B11 | NOT RUN | frame遮罩点击消费单测PASS；所有悬浮层外点击与宿主发送组合未逐项执行 |
| B12 | NOT RUN | 安全区夹紧已实现；全部居民/气泡边缘位置和保存按钮遮挡组合未穷举 |
| C01 | PASS | roster/runtime单测及全员/单人浏览器路径 |
| C02 | PASS | neighborhood.json：13种邻里动作＋首次同桌；原条件/取消单测 |
| C03 | PASS | ui-v1.spec和原home-state测试：三布局×16锚点组合 |
| C04 | NOT RUN | 四组两锚点纯几何和按钮路径PASS；实际pointer拖动只覆盖代表家具，未穷举四组 |
| C05 | PASS | visual/validation.json：100次move不改草稿，合法drop只加一步undo |
| C06 | NOT RUN | 非法实际drop和原占用几何单测PASS；居民占用落点的完整UI手势未单独执行 |
| C07 | PASS | runtime.client：20步上限、取消世界不变；UI一次undo |
| C08 | PASS | content.json及runtime草稿测试：环境/目标配饰在同一Home草稿 |
| C09 | PASS | runtime单草稿锁与lifecycle排他模式回归 |
| C10 | NOT RUN | 两种额外挂饰真实保存/取消、原风铃和锁定单测PASS；三挂饰×三挂点UI组合未穷举 |
| C11 | PASS | 原runtime/controller活动锁与拒绝测试，模式入口沿用原命令 |
| C12 | PASS | runtime.client：pending/rejected/unknown与丢ACK只读核对；无自动重放 |
| C13 | PASS | UI实际CAS后相机恢复、arrange清除、user暂停保留 |
| C14 | PASS | runtime脏草稿关闭确认；10次UI隐藏及50次sidebar恢复，取消不改世界 |
| C15 | PASS | neighborhood重复活动、first-fact稳定ID与原count测试 |
| D01 | PASS | runtime.client：durable confirmation gating、丢ACK核对后唯一通知 |
| D02 | PASS | deriveNotices稳定首次事实、repeat count不改变ID、toastIds上限16 |
| D03 | PASS | 旧偏好迁移单测与SaveStore原字节保护；世界仍schema6 |
| D04 | PASS | runtime.client：12条历史事实迁移静默已读、无历史toast；错误保护沿原事务 |
| D05 | PASS | neighborhood.json：打开不读、点击定位后读、全部已读、冷启动保持12条 |
| D06 | PASS | runtime.client：已读/主题并发串行合并，world不变 |
| D07 | PASS | 空消息与12条消息运行图、首屏滚动和已读数真实 |
| D08 | NOT RUN | 3秒合并/5秒和hover/focus暂停已实现；真实计时组合未自动化执行 |
| D09 | NOT RUN | 关键模式blocked延后逻辑已实现；拖动/编辑/照片/错误期间逐种注入新事实未执行 |
| D10 | PASS | preferences/ui-v1/host测试：严格白名单、限长、未来schema拒绝和原件保护 |
| E01 | PASS | UI与neighborhood：进入、20次拍摄、退出后user暂停保持 |
| E02 | PASS | photo-narrow/medium/wide.png：720×960且三个文件字节完全一致 |
| E03 | NOT RUN | 1.25×真实PNG与默认边框/日期构图PASS；全部日期/边框/缩放组合未穷举 |
| E04 | PASS | 实际PNG与运行场景目视核对；仅真实world stage进图，无HUD/ghost/延展 |
| E05 | PASS | visual/validation.json：20次实际拍摄同frame/asset纹理数/停止ticker；finally清理代码审阅 |
| E06 | PASS | 原photo-store/album限额测试及真实保存/查看/导出/确认删除；世界未变 |
| E07 | PASS | 原album/runtime CAS与unknown只读核对单测、neighborhood照片冷恢复 |
| F01 | PASS | lifecycle.json：50次sidebar隐藏/恢复草稿和世界；runtime按profile持有 |
| F02 | PASS | lifecycle.json：50次展开/收起同iframe且完整composer避让 |
| F03 | NOT RUN | 夹具未发送文字与composer几何自动化PASS；真实Desktop附件/审批组合未执行 |
| F04 | PASS | 既有协调/浮层几何回归、Host smoke共存；实际用户Desktop现场仍NOT RUN |
| F05 | PASS | lifecycle缺资源/不足空间、runtime隐藏断连暂停与无离线补算；错误不清user |
| F06 | PASS | 全部专项内历史schema/迁移/SaveStore保护测试；controller/home-state无diff |
| F07 | PASS | host双实例lease、runtime冲突/epoch/只读核对测试 |
| F08 | PASS | frame-bridge.client：source/origin/token/sequence/viewport/version与新UI配对手势 |
| F09 | PASS | offline-validation.json空store离线无lifecycle scripts；浏览器阻断外网且external=[] |
| F10 | PASS | 50次隐藏和展开、20次照片、Host unload等待在途写入；资源数量有界 |
| F11 | PASS | performance.json：同设备同视口三次×五场景×旧/新，p50/p95/父CPU/heap/纹理均记录 |
| F12 | PASS | performance.json四活动场景通过，隐藏初测FAIL保留；performance-hidden-followup.json同条件30秒×3独立复核PASS（CPU +8.98%，门槛未改）。仅软件渲染短时范围 |
| F13 | PASS | 0.6.2 build/pack/smoke/offline-install；package-manifest.json及SHA256SUMS.txt |

G01–G05：NOT RUN。G06：DEFERRED。冻结HTML浏览器标定：NOT RUN（file:安全拒绝）；文字规范与contract已读取并接入。详情见证据根 manual-pending.md。
