# 0.9 AI 书屋开发样板验收

源码 `f346b20a36b248005f47f2c3f9146fb63c93eed1`，候选1包身份见 [PACKAGE_V09.json](PACKAGE_V09.json)。继续使用 `codex/feature-ai-village-entrance`，未改宿主源码或日常 DSH_HOME，未发布远端。

## 已完成工程检查

- `node scripts/typecheck.mjs`：PASS，全仓严格类型及固定官方 Host/Client 公开声明。
- `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`：52 文件、265 项 PASS。
- `node scripts/ai-village-release.mjs`：PASS。完整测试后仅补一行区域过场焦点归还选择器；对应单 iframe 两项回归通过，并重新执行正式 release 确保最终 bundle 包含该变化。
- `node scripts/pack.mjs --only=ai-village`：PASS，276 文件、32,196,622 bytes。
- `node scripts/smoke-packed.mjs --exclude-sandbox`：PASS，解包后的 Host/browser 导出、持久化、真实 verifier worker、preload、声明消费及官方 CLI 插件组合。
- `node scripts/offline-install-check.mjs --exclude-sandbox`：PASS，空缓存8个本地包安装与 runtime；现有 pnpm peer 提示保留。
- `git diff --check`：PASS。

行为回归包含七居民往返、18,000步确定性与中途冷恢复、三处活动的真实路径/席位、非活动区不推进、隐藏暂停、成员变动后返回点清理、非法地区/坐标/路径拒绝。历史 v9 进行中棋局原样升级，后续42次保存仍保护升级前原快照与指针字节。运行时覆盖提交前资源失败、未知回执只读对账、旧frame消息/cleanup隔离、首帧门禁和唯一iframe。

## 实际界面验收状态

真实浏览器使用官方鉴权的隔离 Host 与生产 runtime/frame/UI，不注入世界或模拟时间：

- `qa-v09/integration-01`：PASS。庭院/书屋共享事实、暂停旅行、三个真实到位活动、结束活动、两区真实720×960 PNG与相册保存、书屋隐藏/冷恢复、庭院原脚点恢复、七居民往返。
- `qa-v09/matrix-02`：PASS。340×720、580×720、320×360 × DPR1/2 × light/dark共12组；深色组启用减少动态。每组真实滚动/返回/往返及照片导出取消；12张导出均720×960。
- `qa-v09/lifecycle-01`：PASS。七居民50次真实区域切换，始终唯一iframe；每10次GC后621 listeners /373 nodes /2 documents保持不变，关闭后575/147/1。庭院128纹理/URL，书屋121；暂停ticks/RNG/进度与庭院脚点一致。

官方 Desktop `0.2.1-rc.2` 在新的隔离profile执行，实际安装包SHA与 [PACKAGE_V09.json](PACKAGE_V09.json)一致：

- `native-v09/install-01`：PASS，官方插件管理器安装0.9候选1。
- `native-v09/check-02`：PASS。停止进程后仅复制旧0.8专用测试profile的插件数据，记录33个源文件哈希；首次旅行CAS完成schema9→10，保留暂停时钟/RNG、脚点、长期事实与相册，升级前指针/快照原字节受保护。三项活动真实到位，共享手账不变，保存实际书屋照片。
- `native-v09/restored-01`：PASS。完整退出并重启后bookhouse world、album与PNG哈希完全相等；实际返回庭院，恢复原脚点/事实及暂停ticks/RNG。所有本次Desktop测试进程已退出，18767监听已关闭。

这是隔离新安装读取旧插件数据的迁移验证，不冒称日常profile原地升级。主代理已目检读书、桌后纸笔、窗边活动、七居民、窄窗返回、深色展开及原生英文界面截图。截图与录像属于实际运行证据，不代表最终书屋美术已获人工批准。

## 失败记录与证据解释

- `qa-v09/matrix-01`：脚本使用 `setChecked` 假设点击后偏好立即同步，实际产品须等待CAS确认。保留FAIL，改为正常点击后等已确认偏好，`matrix-02`全量重新执行通过；没有修改产品代码或绕过UI。
- `native-v09/check-01`：刚停止的旧测试PID仍在退出，启动器按身份保护拒绝重启，CDP连接失败。确认旧PID已退出后同一隔离profile启动，`check-02`完成；保留失败记录。
- `integration-01/bookhouse-first.png`曾与截图同名，最后内容是720×960真实照片，仅按照片引用。独立全屏图由活动、冷恢复与矩阵证据提供，不将被覆盖的首入截图算作证据。

## 短时性能

`qa-v09/performance-01` PASS。全部构建/安装/原生测试停止后串行采样，每区可见20秒、隐藏20秒；不放宽原20–35 FPS、最多128纹理、600绘制样本边界。

| 指标 | 庭院 | 书屋 |
| --- | --- | --- |
| 七居民可见 FPS | 22.397 | 20.890 |
| p95 JS 绘制提交耗时 | 1.000 ms | 1.400 ms |
| 纹理 / texture sources / URLs | 128 / 128 / 128 | 121 / 121 / 121 |
| 解码 RGBA byte估算 | 67,346,784 | 57,210,584 |
| 父页面 TaskDuration / 单核时间 | 53.058% | 74.279% |
| 隐藏父页面 TaskDuration / 单核时间 | 0.068% | 0.230% |

每区可见时均推进601 ticks，7/7居民实际改变位置；隐藏20秒均0绘制、0当前frame资源、世界完全不变。书屋减少7张庭院环境纹理，资源量下降，但本次软件渲染FPS较庭院低且接近门槛，CPU采样也较高，不能宣称全面性能提升。

FPS来自当前软件渲染环境；p95仅JavaScript绘制提交耗时，不是GPU帧时间。解码RGBA是尺寸推算，不是GPU实测内存；TaskDuration仅父页面CDP计数，不代表全部进程CPU预算。详细原始数据见 [qa-v09/RESULTS.md](qa-v09/RESULTS.md)，原生记录见 [native-v09/RESULTS.md](native-v09/RESULTS.md)。

## 交付边界

AI 书屋是明确标注的原创代码绘制开发样板，独立几何、家具与活动已经实现；正式书屋场景母版仍需独立人工审定。原入口 ART_REVIEW 与生产选择器保持不变。未调用模型；未声称完成硬件 GPU 帧时、1小时耐久或真实模型流式并行测试。
