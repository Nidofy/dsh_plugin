# AI Village Entrance-v1 · 0.6.4

2026-10-22。基于本地 `2fd86dafaf771060cbef2074486ad10465d0a317` / **0.6.3 UI-v1.1** 增量实施，没有回退 0.6.2。保留两份原有未跟踪用户文档；SHA256 见 `user-files-baseline.json`。源码未提交、未推送、未发布；安装检查只使用 `.build` 隔离 profile/store。

## 工程实现

**IMPLEMENTED / AUTOMATED_PASS（简版及协议）**：

- 新增跟随 VillageRuntime 的 EntranceCoordinator。首次主动打开标记与连接 generation、React 挂载解耦；隐藏、普通关闭重开、重试使用简版。展示状态不写世界。
- `entry.blocking` 独立阻止 simulation rAF 和 runtime pointer/UI input。静态首帧可以绘制；下层 iframe 和业务 UI 使用 inert，入口只占小院区域。原有 userPaused / pauseReasons、草稿、owner/CAS、只读恢复路径保持。
- 按实际必要资源清单 bytes 累计通过长度及 SHA256 校验的资源；缓存来自同一有效性路径。frame 在 Image.decode/Texture 创建后报告进度，renderer 初始化结束完成该阶段。15/60/20/5 权重，不使用计时器推进；5s/15s 计时器只改变等待提示。
- protocol **3 → 4**，父子同步升级。保留 ready → init → ready-to-render → render 握手；新增 first-frame-rendered 只在成功 paint/app.render 后发出。既有 source / opaque origin / channel / version / token / sequence 校验继续有效，额外匹配 bootAttemptId / assetRevision / viewRevision。ready 后无 paint 不揭幕，仍受20秒超时保护。WebGL context loss 进入可恢复错误。
- 七张既有完整头像复用同一 PNG 的灰度和上色层，`clamp(7*p-i,0,1)` 自下而上揭示。加载失败为中性标记，不改变世界。它们表示总体准备进度，不表示模型连接或全员骨架已加载。
- 跳过/Escape 只结束演出；IME composing Escape 不跳过；减少动态和软件渲染为静态入口。隐藏/卸载取消 WAAPI、observer、media listener 和等待提示定时器；没有额外长期 render loop。
- 原有唯一 Pixi iframe 不因揭幕重新挂载，不缩放 iframe、不改世界坐标或 game camera；退出只解除入口闸门。

## 正式视觉边界

**ART_PENDING**。没有供应经批准的同母版分层门庭：交付包使用暖调静态入口＋七头像。没有复制参考游戏截图、切现有背景门、引入几何门作为正式视觉，也没有新增 Three.js、Pixi Application、视频或动画依赖。

已接入 `assets/entrance/manifest.json` 的本地白名单、PNG/length/hash/压缩与解码像素预算验证，以及 normalized rect/pivot/safeApertureRect 接口。只有 APPROVED 且有效的完整清单启用门庭。DOM 运镜接口含共用门洞挖空、保比例母版裁切、分层视差、双扇82°旋转和按视口四角＋16px计算穿门终值；resize 更新终值而不重开阶段。

**正式门庭快慢路径、完整分镜关键帧、开门/穿门中的实际遮罩合成及美术缺图路径均 NOT RUN / ART_PENDING**。当前资源清单无门图的简版降级已实际运行。几何公式和取消行为的自动化不等于正式视觉验收。未放入调试门冒充完成效果。

## 已运行验证

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 0.6.3 基线 | 29文件 / 133测试 PASS | logs/baseline-tests.txt |
| 最终行为测试 | 30文件 / 145测试 PASS | logs/tests-final.txt |
| 严格类型、正式构建 | PASS | logs/typecheck.txt、logs/release-build-final.txt |
| 15组真实浏览器场景 | PASS（Chromium SwiftShader） | logs/browser-final.txt、QA validation.json |
| ready 后未 paint、过期 source/origin/token/sequence/attempt/assets/view 回执 | PASS | frame-bridge.client.spec.ts、entrance.spec.ts、ready-no-paint录屏 |
| 慢资源 / 慢decode / 加载中跳过 / 哈希失败 / WebGL绘制失败 | PASS | QA 中同名截图、录屏、协议轨迹 |
| 缺头像 / 无正式入口素材 | PASS，简版降级 | missing-portrait、manifest ART_PENDING |
| 加载中隐藏 / 关闭重开 / 用户暂停恢复 | PASS | hide-loading、close-loading、restore、runtime.client.spec.ts |
| 输入屏障、合成IME Escape、宿主输入保留 | PASS | slow-assets、runtime.client.spec.ts |
| 320×360 / 340×720 / 580×720 / 1080×760 × 浅深 | PASS（真实组件静态入口、软件渲染） | matrix-*-loading.png、validation.json viewport轨迹 |
| UI-v1.1 操作回归 | PASS | logs/regression-interaction-final.txt、QA/regression-interaction-final/ |
| UI-v1.1 恢复 / 未确认写只读核对 / 第二owner | PASS | logs/regression-recovery-final.txt、QA/regression-recovery-final/ |
| 离线包 smoke、空缓存离线安装 | PASS | logs/smoke-packed.txt、logs/offline-install.txt |
| 真实GPU、实际Windows IME、多屏/睡眠、正式门庭视觉 | NOT RUN | 不以软件渲染代替 |
| 卸载时 WAAPI 取消、decode中卸载 | 单元与浏览器 PASS；真实开门中卸载 NOT RUN | entrance.spec.ts |
| 真实峰值解码/显存 | NOT RUN | 仅报告估算，不冒充峰值 |
| 用户观感 | USER_VISUAL_REVIEW / 待审 | 工程通过不代替签收 |
| 一小时运行 | DEFERRED | 本轮未运行 |

测试用真实官方 Host/Connection 鉴权和隔离 profile，运行正式组件；不是日常 Desktop profile。录屏和日志中出现的 profile/owner ID 均为临时夹具身份。旧 UI-v1.1 QA 原件保留，新回归证据另放 entrance-v1。

## 性能与资源

最终原始样本和比较见 `packages/ai-village/art/QA/entrance-v1/performance.json`，交付汇总见 `BUILD_RESULTS.json`。

| 最终三组样本中位数 | 0.6.3 基线 | 0.6.4 简版 |
| --- | --- | --- |
| 成功首帧观察时间 | 564ms | 557ms |
| 可操作时间 | 564ms | 711ms（含入口淡入） |
| 暂停后父页面CPU | 1.1887% | 1.2287% |
| 暂停后3秒额外paint | 0 | 0 |
| client bundle | 391,366 bytes | 415,670 bytes |
| frame bundle | 627,466 bytes | 628,512 bytes |
| 离线tgz | 29,349,498 bytes | 29,358,474 bytes（+8,976） |

小样本软件测量不能证明硬件性能。没有设定或宣称全路径性能门槛通过。回归脚本原先写死0.6.3版本标签；最终metadata按实际0.6.4修正并保留原标签说明，client/frame/fixture SHA256均逐项匹配最终构建。

保留0.6.3安装包与HEAD源码作为无入口基线，以三组全新浏览器context测量。首帧指标是轮询观察到成功 render 的时间，不是操作系统物理显示确认。软件简版揭幕包含150ms淡入。报告父页面CDP CPU/heap，不把它当总进程或GPU数据。

单蓝鲸仍为32张实际场景纹理，未加载其他六位完整骨架。七头像冷读共 **236,260 bytes**；128×128×7的RGBA解码下限估算 **458,752 bytes**（约448KiB），不包含浏览器/GPU缓存副本，不能冒充峰值。头像本来已在0.6.3包中，所以没有新增头像包体。新增正式门庭图 **0 bytes / 0 pixels**。

## 交付与复验

- `dist/nidofy-dsh-ai-village-0.6.4.tgz` 及同名 `.sha256`。
- `dist/ai-village-entrance-v1-delivery/` 包含安装包、源码增量、证据包及SHA256 manifest。
- 世界schema6、偏好schema3不变；恢复/保存格式仍沿用0.6.3。protocol4仅在匹配的父子bundle内使用。

主要命令：

```powershell
node node_modules/vitest/vitest.mjs run --config scripts/ai-village-official.vitest.mjs
node scripts/typecheck.mjs
node scripts/ai-village-release.mjs
node scripts/ai-village-entrance-browser.mjs
node scripts/ai-village-entrance-performance.mjs
node scripts/pack.mjs --only=ai-village
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
```

性能基线准备采用只读 git archive 导出 HEAD 源码至 `.build/entrance-baseline/source`，保留0.6.3 tgz解包至 `.build/entrance-baseline/runtime`；不checkout/reset当前工作树。测试中途失败和修正记录保留于 logs；以 `*-final` 与最终 validation.json 为准。
