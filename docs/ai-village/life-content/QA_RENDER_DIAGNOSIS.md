# 书屋软件渲染诊断

已完成固定preview.2的可见原生SwiftShader无Profiler测量。CPU主要位于软件GPU进程；仍不据此猜测具体shader或道具是根因，没有修改renderer。

## 已知证据与不能推导的结论

历史0.9.0-preview.1 headless/SwiftShader书屋20.890FPS、父页面TaskDuration74.279%只代表其当时采样进程；当前固定preview.2原生Intel GPU书屋26.076FPS、父TaskDuration2.221%使用不同Chromium进程拓扑。两者不能用于声称修复CPU或计算优化百分比。当前原生CDP进程列表缺独立Host，新的全后代采样明确补足该进程。

基线HEAD `6a254cd`静态检查：

- `BookhouseArt.drawRoom`和`drawFurniture`在构造时生成Graphics；没有每帧重建整个房间或家具的调用，不能仅看矢量场景就归因为重复构建背景。
- `BookhouseArt.paint`每帧检查三个活动位，清理相应props，并为实际使用该席位的居民更新小道具图形；这是待profiler验证的候选成本，当前没有证据表明它是主要瓶颈。
- runtime唯一rAF循环以约30Hz发出视图，墙钟步进上限0.1秒；Pixi自动ticker关闭，实际paint在收到视图时提交。书屋没有新增永久并行ticker。
- `renderResolution`最低按2倍分辨率绘制，上限3倍且受4,000,000像素预算限制。软件光栅化可能受像素量影响，但须结合真实canvas尺寸与GPU进程CPU后再下结论。
- 先前指标的p95只包含JavaScript绘制提交；不能把低p95当成软件GPU线程也低CPU。

## 同包、同载体对比方法

使用固定preview.2 SHA `929d5be8cb72a2ad0c1e9a32b30fc90181c3ceab2d4a6755fd6e884ff19d5638`、官方Desktop0.2.1-rc.2、新独立profile。软件实例只增加 `--use-angle=swiftshader --enable-unsafe-swiftshader`，不禁用后台节流；用户明确要求的原生交互窗口以 `-VisibleInteractive`启动，逐次核对实际GPU renderer、窗口可见性、DPI及七居民。

1. 独占窗口先运行无Profiler两区各20秒可见/20秒关闭采样，保留原20–35FPS、128纹理及600样本边界；若失败保留FAIL，不放宽门槛。
2. 分开运行诊断区间，启用父页面与场景V8 CPU profiler，标明采样开销；记录原门槛结果但不把Profiler运行当常规性能通过。
3. CDP分别列browser/renderer/GPU/network；Windows进程快照从经路径/user-data身份核验的根PID遍历全部后代，包括Host。只有区间前后进程集合不变时才将累计CPU差之和写成完整子树CPU，进程增减必须单独列出。
4. CPU统一以单核时间百分比报告；父TaskDuration与全进程CPU分开。资源像素数仅是解码/背板估算，GPU物理显存和GPU完成帧时未测。
5. 原始`.cpuprofile`保留，URL查询串移除；报告前20个自采样函数。若样本只支持CPU集中在GPU进程而不能区分具体shader/绘制批次，将明确该定位边界，不猜测书屋背景或道具为根因。

准备脚本：`scripts/ai-village-life-qa-native.mjs`的`performance`/`diagnose`，`ai-village-life-qa-diagnostics.mjs`与`ai-village-life-qa-process-snapshot.ps1`。只有设置 `AI_VILLAGE_FULL_CPU=1`才读取完整进程树；该调用需要正常工具提权读取Win32进程，不改系统设置或进程优先级。

## 2026-10-23 无 Profiler 实测

[software-performance-02](QA-native/software-performance-02/result.json) PASS，实际窗口HWND19467972/前台/DPI168。庭院25.614 FPS，书屋25.473 FPS，均600绘制样本；庭院128、书屋121纹理与URL。原门槛20–35FPS及最多600不变。

完整子树的两个可见区间进程成员均稳定。庭院635.384%单核CPU中，GPU进程累计131.797秒；书屋812.601%单核CPU（约8.13个逻辑核的CPU时间，不是整机百分比）中，GPU进程累计172.438秒，占书屋所有进程CPU增量约98.33%。书屋两个renderer合计2.391秒，Host0.266秒，父页面TaskDuration1.976%。这支持本次高CPU集中在SwiftShader软件GPU工作，而不支持父页面JS忙循环为主要成本。具体光栅化/着色/混合批次尚不能区分。

可见书屋JS提交p95约0.8ms不能代表软件GPU完成时间。关闭后帧数0、世界精确不变，GPU增量仅0/0.016秒；关闭区间有renderer退出，因此不把幸存进程之和称完整全树CPU。旧headless拓扑20.890FPS/parent74.279%仍不能与此直接算优化率。

## 独立 V8 Profiler 区间

[software-profile-01](QA-native/software-profile-01/result.json)为DIAGNOSTIC，原始父页面/场景`.cpuprofile`与Top20自采样函数已保存，URL查询串已移除。书屋父页面12535采样中按时间99.060%为idle；场景13120采样中95.596%为idle。场景最高具名应用/引擎函数自采样也约0.1%量级。与无Profiler的GPU进程占比共同支持高CPU主要位于软件GPU进程，不支持场景JavaScript占满CPU；V8 profiler不观测SwiftShader内部线程，无法定位具体shader/混合/填充成本。Profiler样本自带开销，不用于替代无Profiler门槛结果。
