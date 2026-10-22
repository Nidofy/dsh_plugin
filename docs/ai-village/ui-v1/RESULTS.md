# AI Village UI-v1 本轮交付结果

日期：2026-10-22（Asia/Shanghai）。源码已在独立仓库 dsh_plugin 实施，版本 0.6.2。审阅基线与启动 HEAD 均为 2cab99ab8b78de49b3c444ee4df388bf7a246634。本轮改动未提交；原未跟踪 docs/ai-village/NEXT_FEATURES_2026-10-21.md 保留且未改动。

本轮已连续完成 M0 基线检查及 M1–M6 实现，并执行 M7 自动化、打包和证据整理；**不宣称所有验收项目通过**。逐项覆盖和未执行分支见 ACCEPTANCE_MATRIX.md，现场项目见证据目录 manual-pending.md。未重新进行产品设计，未使用标定稿演示数据、截图或业务逻辑。

## 实际改动

- 四主入口统一为窄窗抽屉/宽窗右面板；560px HUD断点、900px面板断点。HUD、设置、通知、布置和照片工具拆分，普通开关保持同一iframe。
- 360×480世界、真实背景、人物和家具共用contain投影；独立1–1.5×观察相机；frame protocol3校验镜头和布置意图，统一手势所有权。取消平移恢复原相机。
- 24px背景边缘缓存淡化与非交互氛围延展。七张完整头像与六类家具缩略来自原批准素材和正式renderer；资源生成器和Host白名单登记哈希。浅深主题、中英文字、SVG及软件渲染实色回退。
- 通知仅来自已确认首次事实，旧12条历史静默已读，限长聚合toast。偏好schema1→2窄迁移、原字节保护、单writer串行合并已读与主题意图。
- 四组家具各两个锚点；ghost移动不写草稿/世界，合法drop一步undo。Home/挂饰单草稿、20步undo、dirty关闭确认、隐藏恢复、pending/unknown保护与CAS沿用。
- 同一renderer离屏720×960照片，预览内框与输出对应；相册保存/查看/导出/确认删除。观察相机不入照片，原user暂停保留，临时RenderTexture在finally销毁。

没有改动 controller.ts、home-state.ts、floating-layout.ts；世界仍schema6，原寻路/布局合法集合/事务/相册数据层保持。完整文件清单见 CHANGES.md；技术适配理由见 DECISION_LOG.md。

## 实际验证

下列命令均在 dsh_plugin 运行，日期为2026-10-22。测试profile均为临时独立目录。

| 命令 | 实际结果 | 证据 |
|---|---|---|
| node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs | exit 0，28文件121项PASS；启动基线26文件103项PASS | tests.log、UI_V1_BASELINE.md |
| node scripts/typecheck.mjs | exit 0，小院及Git/Live2D官方严格类型PASS | typecheck.log |
| node scripts/ai-village-release.mjs | exit 0，正式0.6.2构建完成 | 包内bundle与运行构建哈希再次核对一致 |
| node scripts/pack.mjs --only=ai-village | exit 0，267文件，29,340,315字节 | package-manifest.json |
| node scripts/smoke-packed.mjs --exclude-sandbox | exit 0，实际打包Host/Client/声明/CLI组合PASS | smoke.log |
| node scripts/offline-install-check.mjs --exclude-sandbox | exit 0，空store、offline、无生命周期脚本，native checks PASS | offline-validation.json |
| node scripts/ai-village-ui-v1-browser.mjs | exit 0，23完整宿主截图、6组行为断言及短录屏 | visual/validation.json、interaction/ui-v1-runtime.webm |
| node scripts/ai-village-ui-v1-visual.mjs | exit 0，24图元数据/边界/尺寸与照片720×960 PASS | visual/visual-validation.json、visual/review.md |
| node scripts/ai-village-v061-browser.mjs | exit 0，50次sidebar、50次展开、合成IME、资源缺失恢复PASS | lifecycle.json |
| node scripts/ai-village-v06-browser.mjs | exit 0，家具预览/撤销/确认、实际拖动、环境配饰、PNG与冷恢复PASS | content.json |
| node scripts/ai-village-v06-neighborhood-browser.mjs | exit 0，13邻里动作+首次同桌、12通知及已读冷恢复、挂饰/照片PASS | neighborhood.json、visual/notifications-metadata.json |
| node scripts/ai-village-ui-v1-performance.mjs | exit 0，但门槛结果FAIL，不能将进程成功当作性能通过 | performance.json |
| node scripts/ai-village-ui-v1-performance.mjs --hidden-followup | exit 0，PASS（独立30秒×3组旧/新复核） | performance-hidden-followup.json |
| git diff --check | exit 0，无空白错误；仅本地CRLF提示 | git-diff-check.log |

视觉检查器有 Fontconfig 缓存目录不可写警告，但PNG/contact sheet实际生成并检查完成；未为清除警告改动用户系统缓存。

## 性能结论与限制

同设备Chromium SwiftShader、DPR1、同实际iframe CSS尺寸，旧/新各三次。记录的是JS renderer提交耗时与父页面CDP CPU/堆，**不是GPU完成耗时、整机CPU或原生Desktop性能**。

| 场景 | p95旧→新(ms) | 父CPU旧→新(单核%) | 初测门槛 |
|---|---|---|---|
| single | 0.400 → 0.400 | 34.73538 → 37.84262 | PASS |
| seven | 0.700 → 0.700 | 40.36238 → 44.33576 | PASS |
| activity | 0.900 → 0.900 | 41.08720 → 44.91106 | PASS |
| expanded | 0.700 → 0.800 | 94.48928 → 93.63272 | PASS |
| hidden | 0.000 → 0.000 | 0.05346 → 0.06611 | FAIL |

初测隐藏CPU由0.05346%到0.06611%，相对增加23.7%（绝对约0.01265个百分点），按冻结15%门槛记FAIL，原始JSON保留。隐藏两版都没有iframe绘制、世界保持不变。独立长采样结果PASS，旧/新CPU中位数0.05126% / 0.05586%；复核前两版均执行GC及相同预热，不改门槛。 初测失败原样保留；长采样没有复现超过15%的增幅，F12以同门槛独立复核标PASS，仅限该软件渲染短时范围，不替代正常GPU现场验收。

主性能采样构建见performance-build.json；最终frame仅增加“取消平移恢复原相机”的输入处理，renderer和调度未变。复核使用最终包对应构建。旧 ai-village-v061-performance.mjs 的独立绝对20FPS门限脚本本轮NOT RUN；保留断言未削弱，UI-v1采用冻结方案要求的同视口历史对照。正常前台GPU和主工作任务并行仍NOT RUN。

## 运行证据与安装包

运行图使用正式源码组件、正式Host及官方Connection鉴权的集成夹具，包含完整宿主composer；不是标定稿截图，也不是实际安装的日常Desktop profile。23状态图另加真实12消息图（1080×722）。每图有CSS尺寸、DPR、状态及构建哈希。短录屏在 interaction/ui-v1-runtime.webm；三种宽度照片在 visual/photo-*.png，字节一致。

- 版本：0.6.2；兼容宿主官方DSH 0.2.1-rc.2、Windows x64。
- 包：nidofy-dsh-ai-village-0.6.2.tgz，29,340,315字节。
- SHA256：faee4674e38976bf94e99d89f9663f882917598f7c0991f538d7f28e5a49c4a7
- client SHA256：23ff7e237485f7472d811b07cd0cd4b3392f153fe47bea421097f6b02af0ab1a
- frame SHA256：31388336f713b1cdad5d845ee0ba2b47603d3ea0aed0e6f0560d74320add4403

交付目录的package/中提供tgz及sha256。手动安装入口为DSH Plugins → Add plugin → 本地tgz，安装启用后完整重启DSH；本轮没有安装到日常profile。第三方运行依赖/许可证已内嵌，不需联网补图或模型调用。

## 未覆盖与回退

冻结HTML浏览器标定NOT RUN：内置浏览器拒绝file:，没有通过服务器或另一浏览器绕过；文字规范与contract已读取。真实Windows DPI/多屏、IME/审批、正常GPU、睡眠唤醒及用户观感G01–G05均NOT RUN；矩阵中未穷举的键盘/滚轮/家具拖动/占用/挂点/toast/照片组合逐项标明。

G06一小时真实运行验收保持DEFERRED，遵守既有暂缓要求。无推送、发布、付费模型调用。没有自动Git提交。

世界仍schema6；偏好schema2不能由0.6.1识别。原SaveStore保护升级前原件，原0.6.1离线包留在仓库dist。回退前备份新偏好，使用升级前原件与原安装包，不让旧版覆盖新偏好。
