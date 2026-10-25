# 获批场景 pre3 隔离原生验收

最新状态：**可见条件下，本轮原生功能覆盖已补齐**：茶座真实sit/取消、两张实际照片、书屋三普通姿态、回程纹理释放及不同cast完整重玩均有通过证据。此前默认Hidden超时、受控后台NOT_RUN，以及一次原因未定位的可见书桌超时全部保留，不把它们改写为PASS；长期原生性能仍未验收。下文按执行条件分开列明。

固定包：`nidofy-dsh-ai-village-0.13.0-preview.3.tgz`，53,661,172 bytes，SHA256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`。测试中未重建或修改该包。

## 首批默认Hidden条件（历史记录）

RunTag `approved-pre3` 使用 `.build/ai-village-tea-qa-desktop-approved-pre3` 专用 home/electron-data。官方缓存 Desktop 0.2.1-rc.2，CDP 仅127.0.0.1:18774，本节各轮窗口始终Hidden；后续获授权VisibleQa单独列于文末。GPU报告 Intel Arc140T、硬件WebGL启用，没有SwiftShader flags；页面visible不能替代OS前台帧率验收。

| 证据标签 | 结果 | 范围/限制 |
| --- | --- | --- |
| native-approved-pre3-install-01 | FAIL，环境启动 | AppContainer carrier cache ACL导致进程退出、CDP ECONNREFUSED；未改ACL。经自动审批在沙箱外Hidden启动同隔离profile。 |
| native-approved-pre3-install-02 | PASS | 官方插件管理器安装启用；Host/client/frame字节匹配固定包。 |
| native-approved-pre3-checkpoint-01 | CHECKPOINT_READY | 七人真实入场；frame11接收四茶纹理，庭院纹理释放；三人实际抵达、错误杯垫顺序不晋级、reset serial及部分正确杯垫暂停存档。 |
| native-approved-pre3-restored-01 | 冷恢复PASS，后续FAIL | 根PID24688及子进程终止，重启根PID15968；暂停世界逐字段等于checkpoint。继续第三阶段180秒超时。1546样本中frame ticks1352→1886，末帧蓝鲸/Claude到位、Gemini距目标8.36px且持续移动，约3逻辑tick/s。pageerrors空，未证明路径堵塞；后续恢复入口显示OWNER_LOST。 |
| native-approved-pre3-continuation-01 | NOT_RUN，QA缺陷 | 新mode未接dispatch；仅真实恢复入口，未发送故事推进。保留结果。 |
| native-approved-pre3-continuation-02 | FAIL，QA观察缺陷 | 新page.addInitScript没有作用已有iframe，缺少被动observer，texture等待超时；只读metrics表明三人实际已到位。未重新启动故事。 |
| native-approved-pre3-continuation-03 | 首次纪念PASS，重玩FAIL | 修正QA先真实关闭/打开面板，新iframe接被动observer；继续同event并明确完成首次纪念。随后取消无奖励assert通过，换蓝鲸/GPT/Grok重玩stage0在300秒内未ready。实际ticks2405→3296，最后三人脚点全部正确，phase observing；无路径停滞证据。没有继续重试。 |

所有失败原件保留。首次完成memory的原始三人、eventId、day、completedTick正确，count=1；不同cast三人均到位，但完整重玩未完成。**本轮未执行**：普通茶座真实sit与取消、真实照片、书屋三普通站、回程纹理释放；这些不得用浏览器结果替代为原生通过。两个有效执行均pageerrors为空。旧gate RESULTS.md不覆盖。

视觉检查：冷恢复和茶会末阶段实际图像完整，无空白或占位背景；下方四位围观人物及气泡存在明显画面遮挡，合法脚点不能证明所有身体完全互不遮盖。未获得本轮原生书屋截图，不能下书屋原生视觉结论。

尚未覆盖：原生前台硬件FPS、物理睡眠/最小化、长期内存、额外物理DPI、原生故障注入UNKNOWN ACK、新方向动作完整资格。隐藏截图/paint计时不视作上述通过。

清理 **PASS**：2026-10-25T08:41:21Z，launcher核验carrier可执行文件及独立user-data参数后停止根PID15968与子进程7244、15800、28784、28116、29052。后验进程列表为空、18774监听为空。见 `native-approved-pre3-cleanup-before.json` 和 `native-approved-pre3-cleanup.json`。保留专用profile与全部证据；未改ACL、未触碰实际用户DSH_HOME，未使用软件GPU或修改系统后台节流。


## 独立普通活动补充：受控后台调度（2026-10-25）

本补充与上面的默认Hidden失败条件分开：仅专用RunTag `approved-pre3` 的新Hidden进程PID27424启用 `-UnthrottledQa`，加入 `--disable-background-timer-throttling`、`--disable-renderer-backgrounding`、`--disable-backgrounding-occluded-windows`、`--disable-features=CalculateNativeWinOcclusion`。保持相同pre3 SHA、同profile、硬件GPU；未更改产品、世界tick、OS设置或前台窗口。

`native-approved-pre3-supplement-01` 结果为 **NOT_RUN**。固定包与frame11四茶纹理校验通过，但唯一一次实际推进门槛未通过：3024.84ms内ticks3131→3137（6），frames4→9（5），前后userPaused均false。门槛预先定义为至少45ticks和20frames，失败即停止。没有取消保留的旧重玩，没有执行普通茶坐姿/取消/照片或书屋三站/照片/回程，没有继续调整参数重试。见该目录 `scheduling-preflight.json` 与 `result.json`。这不改变先前任何FAIL，也不是默认Hidden或原生前台FPS通过。

补充清理 **PASS**：2026-10-25T08:49:41Z，专用根PID27424与子PID27448、26496、3776、26668、29336全部退出，18774无监听。见 `native-approved-pre3-supplement-cleanup-before.json` 与 `native-approved-pre3-supplement-cleanup.json`。用户配置未触碰，专用profile及证据保留。


## 用户授权可见窗口补测：功能覆盖完成（2026-10-25）

用户明确授权“允许显示隔离窗口，完成补测”。仍使用原固定pre3包及同专用profile，无软件GPU、无后台禁用节流参数。launcher `-VisibleQa` 仅允许该RunTag，WindowStyle Normal。启动后最初可见的是welcome窗口；使用真实离线“Set up later”入口显示主窗口，无凭据填写。通过computer-use选中唯一专用carrier的主窗口后正常激活。

前台证据不是仅靠Normal推断：主窗口HWND8325254、根PID28568，`dsh-app://app/`可见窗口身份由UI Automation核对；read-only GetForegroundWindow/GetWindowThreadProcessId在08:59:25、09:01:07、09:08:20 UTC均匹配该主窗。准确UTC时间见 `native-visible-foreground-main-02.json`、`native-visible-foreground-during.json`、`native-visible-foreground-final.json`。首次沙箱内只读调用返回HWND0，保留 `native-visible-foreground-main.json`；沙箱外只读核验成功，未用该0值推断状态。

首个实际3秒探针：3037.565ms，91 ticks、77 frames，记录的paint p95约2.3ms；Intel Arc140T硬件路径。该探针证明此时正常推进，**不等于长期原生硬件FPS或内存验证**。三个前台时间点也不宣称整个运行期间逐帧持续前台。

| 新证据标签 | 结果 | 实际覆盖 |
| --- | --- | --- |
| native-visible-supplement-01 | FAIL，QA启动断言 | 外层仍要求Hidden，未执行活动；最小修复使其接受明确visibleQa的Normal。 |
| native-visible-supplement-02 | 茶与书柜PASS，书桌FAIL | 茶左座蓝鲸active/restingVisible=true、standingVisible=false，脚点86,276，depth2760.02低于桌3210；真实取消恢复站立且脚点不变。茶照片720×960，暂停世界不变。蓝鲸书柜实际reading脚点276,268。随后书桌120秒超时，蓝鲸恢复自主行动；原证据未记录该指令的完整intent生命周期，原因未定位，不将其归因于调度或确定的争用。 |
| native-visible-bookhouse-01 | FAIL，QA假设 | 暂停时按钮由产品正确禁用，QA点击20秒超时，未发出指令。已撤回暂停下命令方案。 |
| native-visible-bookhouse-02 | PASS | 在暂停世界选择真实占用者，恢复运行后通过正常UI发指令，并记录实际intent接受。GPT书桌writing脚点142,328；蓝鲸窗座seated投影脚点92,270、髋92,225、视觉鞋底92,270。书屋照片720×960，世界保持暂停不变；书屋→庭院→茶，书屋/茶纹理按区释放与接收，首茶纪念保持。 |
| native-visible-replay-01 | PASS | 蓝鲸/GPT/Grok真实三阶段到位、正确杯垫交互、明确完成；原纪念eventId/三人/day/completedTick不变，仅count1→2，保留已收起的纪念牌选择。 |

至此，原生安装/冷恢复/首次完成与本节独立通过项共同覆盖了本轮目标。没有重新安装、改包、注入世界、改脚点或清空人群。所有原始FAIL和NOT_RUN保留；可见成功不替代默认Hidden条件的失败结果。

视觉检查：蓝鲸茶座是真正坐姿并在茶桌后方；书柜手持书清晰，窗座坐姿与椅面接触清楚。七位居民在书桌附近聚集时，人物会互相遮挡，GPT写字图中身体部分被Claude等遮住，但纸张/手部层与actual writing指标可见；这不等于全体人物轮廓永远无遮挡。当前不改变已批准几何或冻结包来清场。代表图片：

- `native-visible-supplement-02/native-ordinary-tea-seated.png`
- `native-visible-supplement-02/native-tea-keepsake-photo.png`
- `native-visible-supplement-02/native-bookhouse-bookcase.png`
- `native-visible-bookhouse-02/native-bookhouse-reading-desk.png`
- `native-visible-bookhouse-02/native-bookhouse-window-photo.png`
- `native-visible-replay-01/native-visible-replay-arrived.png`

可见补测清理 **PASS**：2026-10-25T09:08:39Z，根PID28568及子PID29388、28372、16692、27908、21024全部退出；18774无监听。证据 `native-visible-cleanup-before.json`、`native-visible-cleanup.json`。专用profile和所有证据保留，用户原配置未触碰。

结果JSON的历史统一notCovered字段仍含“window not activated”旧字样；此处可见条件以前台HWND/PID证据和scheduling-preflight为准。未覆盖的仍是**长期**硬件FPS、物理睡眠/最小化、长期内存及更多物理DPI，不否认本次已记录的前台短探针。
