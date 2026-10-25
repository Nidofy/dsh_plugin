# 获批双场景可玩验收

本页记录 0.13.0-preview.2 之后的正式素材与可玩验证。先前 `gate-final-*` 只证明尚未开放时的门禁，不能证明本页玩法。用户视觉批准已经取得；最终功能与安装包结果仍以本页后续实际结果为准。

## 最终浏览器结果：0.13.0-preview.3 双 DPR 通过

[DPR1](browser/approved-play-final-dpr1-03/result.json) 和 [DPR2](browser/approved-play-final-dpr2-01/result.json) 均 PASS；每轮 32 条检查记录、30 张 PNG、0 pageerror、0 外网请求。两轮各自使用全新隔离 profile；通过公开地图进入已开放生产区域，没有写入 fixture 世界。每轮归档启动时的 `runner.mjs`，相同脚本 SHA-256 为 `f50cb3255bac3e339cf2a26249135def6aa93e4fb8e5a57024e1cc1166925ef0`。

两轮的 129 个源码文件哈希、Host/client/frame 三 bundle 哈希，以及当前源文件和 lib 全部逐字节一致；[机器可读汇总](browser/approved-final-summary.json) 保存精确结果。

主线程的[可玩包身份核验](play-package-identity.json) 进一步核对所有 lib/assets 与固定 tgz，版本 `0.13.0-preview.3`、SHA-256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`；独立快照保存在 `.build/ai-village-tea-0.13.0-preview.3-play-frozen`。此身份闭环与浏览器检查共同使用，原生安装结果另列。

三 bundle SHA-256：

| bundle | SHA-256 |
| --- | --- |
| index.js | `84c802881cb4bff381cbdbbbc12f22a4306bae05e9d154022014911457e5f3ae` |
| client.js | `4182fe1253bb6c8d7212b750baeb90259fd3763feb5b70aaba9d2f8a771ced25` |
| frame.js | `7bd7bd0b1eed6e8f59c9bdc60ce659629fff4638abba36cb1ba8860b556553ed` |

实际覆盖：书屋三类普通活动的 reading/writing/seated 渲染、两人共读三个真实到齐阶段和两张相机照片；茶会七人同场、三人取消/错排/重排、部分杯垫冷恢复、最终 Host 已写但 ACK 丢失后的只读核对、不同三人重玩保留首次来源、普通挑茶全部四阶段、真实 sit 使用各角色自己的已批准 rest-pose 并位于桌层后方、取消恢复站姿、真实茶签照片、相邻路径限制与手账事实。场景均覆盖实际 320×360、340×720、580×720、浅/深、English/200% 字体/减少动态；界面偏好变化没有写世界。

每轮有 19 次真实跨区旅行，其中 12 次为额外释放趋势检查。各区域的纹理数、source 数、Blob URL 数和解码 RGBA 库存严格回到同一值，不混入非活动场景或地图纹理：

| 七人活跃场景 | 纹理 / source / Blob URL | 解码 RGBA bytes |
| --- | --- | --- |
| 白鲸小院 | 128 / 128 / 128 | 67,346,784 |
| AI 书屋 | 123 / 123 / 123 | 63,796,952 |
| 茶会广场 | 125 / 125 / 125 | 61,698,008 |

新书屋两 atlas 文件合计 2,468,228 B / 6,586,368 B RGBA；茶区四图合计 2,281,183 B / 4,487,424 B RGBA。实际 PNG 尺寸、每图 SHA 和 bytes 在各结果的 `sceneArt` 观测中。书屋等长坏字节与茶图 503 均在世界写入前拒绝，真实重新进入后可重试。RGBA 是已解码纹理源估计，不是驱动总显存或整个浏览器内存。

| 实际观测 | DPR1 | DPR2 |
| --- | --- | --- |
| 路径采样数（17/30 速度上限 / 脚点≥24） | 2,256 | 2,188 |
| 杯垫冷恢复 | 1,115 ms | 1,067 ms |
| 各次地图旅行范围 | 813–1,061 ms | 861–1,098 ms |
| SwiftShader 短样本时长 | 3.15 s | 3.17 s |
| 样本 frame 更新率 | 23.18 fps | 23.37 fps |
| paint p50 / p95 | 0.8 / 1.5 ms | 0.8 / 2.1 ms |

这两轮使用 Chromium headless + SwiftShader，不能代替原生硬件 FPS，也不作跨版本回归百分比。隐藏侧栏后 iframe 已卸载，世界一秒内不变；没有测量操作系统 CPU 占用。未覆盖物理睡眠/最小化、长期内存 soak、新方向原画资格。原生安装与真实进程冷重启由独立 native 记录负责。

## 工程诊断轮（失败证据保留）

| 轮次 | 结果与有效范围 |
| --- | --- |
| [approved-play-dpr1-01](browser/approved-play-dpr1-01/result.json) | FAIL。新书屋资源等长坏字节被 SHA 校验拒绝，世界/修订零写；真实入口重试恢复庭院，书屋实际两 atlas 与预算通过。随后七人同场蓝鲸“在书柜选书”途中遇动态居民，普通意图消失，120 秒内未到书柜。 |
| [approved-tea-dpr1-diagnostic-01](browser/approved-tea-dpr1-diagnostic-01/result.json) | FAIL。正式地图进茶区、七人、三人真实路线、暂停/隐藏、取消、错误杯垫/重排、部分板冷恢复、丢失最终 ACK 后只读核对、不同三人重玩、永久首次事实和真实 720×960 照片通过。随后 GPT 普通挑茶仅到 `counter` 阶段，路径被动态居民阻挡，约 80 秒后有界取消并反馈 `PATH_BLOCKED`，尚未完成坐下。 |
| [approved-play-final-dpr1-01](browser/approved-play-final-dpr1-01/result.json) | FAIL（QA 假设）。pre3 蓝鲸已真实到达书柜并显示 reading；下一书桌由 Kimi 真实使用，产品正确返回 `FURNITURE_OCCUPIED`。QA 改为用居民下拉选择该站当前使用者，再发显式普通活动；空站仍选蓝鲸。未清场、冻结、改世界或自动重发失败命令。 |
| [approved-play-final-dpr1-02](browser/approved-play-final-dpr1-02/result.json) | FAIL（QA 操作方法）。书屋普通三姿态、共读三阶段和两张照片通过；三个尺寸与浅深主题通过。Playwright `.check()` 误要求受控 checkbox 同步更新，产品等待 Host ACK 后才提交偏好。改为真实 `click → settled → isChecked` 并逐项核验权威偏好与实际表单。 |

书屋诊断中，tick254 蓝鲸停在 `(181.2555,365.4557)`，Grok 位于 `(198.3179,382.6265)`，间距约 24.21。下一步碰到居民间距边界时，既有 `world.step` 直接放弃普通意图；不是读书时间太短而漏采样。书柜目标 `(276,268)` 从未到达，120 秒中最近仍相距约 65.68。

茶会诊断中，最后 tick6696 GPT 位于 `(231.6904,287.7922)`；蓝鲸后来占据茶柜 `(54,266)`，Claude/Gemini 占右/中席。普通活动使用起始路径而未重新规划，也未为取茶目标保留占用。pre3 已加入书屋有界重规划、茶柜/所选席预留和动态重规划，保留原截止时间与旁观者行动。负责人用这两个真实初态作核心回归；最终真实界面结果见后续通过轮。

上述均为工程定位，不能列作最终双 DPR 通过。首轮后有源码空行规范化；诊断过程中 QA 脚本继续添加后续矩阵与失败观测，所以诊断轮末尾脚本哈希不作为执行脚本身份依据。最终轮已改为启动时记录脚本哈希，并要求全新标签、源码及三 bundle 身份。

## 原生证据分工

新版原生隔离安装、三人杯垫中途真实进程重启、完成/重玩/照片与书屋普通三姿态使用独立 native 标签及结果。此浏览器文档不代替原生进程重启，也不将全新原生 profile 写成旧档迁移。旧 world13 窄迁移由已有核心/Host 迁移回归负责。

## 七人画面的视觉边界

七名大头角色自主聚在书桌附近时，前景身体会遮挡桌子和后方同伴。[实际共读写字画面](browser/approved-play-final-dpr1-02/bookhouse-story-stage-1.png) 中两人的实际 Pixi mode 已是 writing，脚点保持合法间距，但不能称为“两位书写者同时清晰可见”。正式渲染保持真实前后深度，没有为了截图抬高故事角色 z，也没有挪动旁观者。单人/三人接触资格与七人功能验收是不同范围；本限制在最终报告中保留。
