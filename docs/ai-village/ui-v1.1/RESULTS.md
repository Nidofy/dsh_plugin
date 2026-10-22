# AI Village 0.6.3 / UI-v1.1：体验修复与场景化轻玻璃

2026-10-22。本轮已实施 M0–M5 的代码与工程验收；**硬件 GPU 和七项人工观感尚未签收**。完整逐项状态见 [ACCEPTANCE.md](ACCEPTANCE.md)，最终包、源码与截图哈希及性能数值见 [BUILD_RESULTS.md](BUILD_RESULTS.md)。一小时真实运行继续 **DEFERRED**。

## 实际实现

- M0：从 `e85ccc704f07edada1b59a574354fad859e44d79 / 0.6.2` 开始，基线 28 文件、121 测试和类型检查通过。原有两份用户未跟踪文档保留并校验 SHA256；没有切换或回退工作树。
- M1：用真实 fetch 故障注入确认“transport 仍 connected，但心跳失败后 error/disconnected 锁存”的代码缺口。增加独立同租约恢复协调器，核对 profile/epoch/owner/revision，调用既有只读 reconcile；1/2/4 秒最多三次，隐藏、卸载和代际变化取消。未知写结果不重放，其他 owner/外部修订不接管；保留 user/arrange/photo、布置草稿与 undo，frameReady 满足后才调度。显式恢复与自动协调器互斥。用户现场那一次暂停的根因仍 **NOT CONFIRMED**，不能用成功注入替代现场复现。
- M2：正式组件接入冻结 token，正文三档 13/14/15 CSS px、标题 15/16/18、辅助文字至少12；90–200%文本设置不乘DPR。新安装跟随DSH；旧host/system/light/dark语义按迁移规则保留。暖中性色玻璃、透明HUD/Dock、主题化表单、软件/减少透明实色回退、180/140/120/250ms过渡与提示。
- M3：四入口摘要/详情、小型设置分组、最多8层来源栈，返回恢复居民目标、滚动与精确按钮焦点；关闭回场景与退出插件分开。跨断点只重算尺寸，普通导航不写world、不重建iframe。子页内容按route重挂以实际触发140ms过渡。修正摘要卡打开时居民点击穿透：首次点击只关闭卡片，不同时选中/拖起人物。
- M4：布置退出脏草稿确认、pending/unknown守卫、照片固定返回栏和内容滚动、相册加载/失败/真正空态、查看/导出/删除闭环。旧活动、布局、挂饰、配饰、消息、手账与相册入口保留，见 [FEATURE_MAP.md](FEATURE_MAP.md)。没有新增玩法或重绘场景美术。
- M5：最终 29 文件、133 测试通过；严格类型检查、正式构建、pack、解包smoke和空缓存offline安装通过。源码增量、证据包、离线tgz及SHA256一并交付。

`frame.js` 因输入路由的关闭优先级修复而改变；world360×480、照片720×960、frame protocol3、5px拖动门槛、26px吸附和20步撤销不变。历史设计文本保留，明确替换条款见 [DECISION_LOG.md](DECISION_LOG.md)。

## 本轮证据

截图使用实际生产组件、官方 Host/Connection 鉴权和隔离 profile，**不是静态设计稿，也不是日常 Desktop profile 现场截图**。基础矩阵96张：6尺寸×浅深×中英文×默认/居民摘要/设置摘要/设置详情；加功能、恢复、DPR、异步相册、实色回退及仅测试用色板补图。元数据包含CSS视口、DPR、textScale、theme/解析模式、environment、materialMode、renderer、route、HEAD/dirty与client/frame/fixture SHA256。

所有自动浏览器运行采用 Chromium SwiftShader；实际触发实色回退，未强行关闭回退伪造GPU玻璃。硬件GPU浅深×窄宽的4组真实玻璃效果、实际合成背景对比度、GPU合成/交互延迟均 **NOT RUN**。

本轮回归覆盖50次侧栏、50次窄/展开、缺资源/空间不足、合成IME Escape、布置预览/撤销/保存、13种日常/邻里活动及同桌、12条确认事实、消息已读/冷启动、照片与相册。三窗口原始PNG逐字节相等。恢复注入覆盖同连接心跳失败、hidden取消、服务端已提交但ACK丢失、持续unknown和第二owner拒绝。

关键录像位于 `packages/ai-village/art/QA/ui-v11/interaction/` 与 `interaction-checks/`。截图、运行状态、软件性能原始样本位于同一 QA 目录。历史失败截图保留在 attempts，说明修正原因；不作为验收通过证据。

## 格式与回退

偏好 schema1/2 窄迁移到3，新增textScale与host，保留旧主题和已读状态；world schema6保持不变。使用实际0.6.2 decoder，在临时目录验证拒绝新schema不改字节，以及升级前备份可独立恢复；当前新偏好未覆盖。详见 [MIGRATION.md](MIGRATION.md)。

## 复验与交付边界

原始命令输出在 `logs/`。主要命令：

```powershell
node node_modules/vitest/vitest.mjs run --config scripts/ai-village-official.vitest.mjs
node scripts/typecheck.mjs
node scripts/ai-village-release.mjs
node scripts/ai-village-ui-v11-interaction.mjs
node scripts/ai-village-ui-v11-browser.mjs
node scripts/ai-village-ui-v11-recovery.mjs
node scripts/ai-village-v061-browser.mjs
node scripts/ai-village-v06-browser.mjs
node scripts/ai-village-v06-neighborhood-browser.mjs
node scripts/ai-village-ui-v11-performance.mjs
node --import tsx scripts/ai-village-ui-v11-rollback.mjs
node scripts/pack.mjs --only=ai-village
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
node scripts/ai-village-ui-v11-delivery.mjs
```

性能/回退脚本的基线准备：将 git e85ccc7 的 `packages/ai-village`、`source-control/src`、`live2d/src`、`plugin-shared/src` 导出至 `.build/ui-v11-baseline-source`；保留的0.6.2 tgz解包至 `.build/ui-v11-baseline-runtime/package`；用 `runPreview({root,pkg,out,buildOnly:true})` 构建 `.build/ui-v11-baseline-preview`。无需checkout或改用户文件。

软件性能保留原CPU相对15%与提交p95门槛，最终结果单独列于 BUILD_RESULTS.md；不能只根据进程exit0标PASS。真实Windows DPI/IME、多屏、睡眠、实际Desktop多插件现场及七项用户观感见 [MANUAL_REVIEW.md](MANUAL_REVIEW.md)。工程通过不等于产品视觉签收。

没有自动提交、推送、发布或安装到日常profile。一小时真实运行保持 **DEFERRED**。
