# 线程 A 最终内部候选交接

生产修复提交 `ea8708d458643d3360eb1e9783431ca1dd7fece7`；B 最新 QA `c9677550d6e443d1bd3af57c55ef62c0b70de609` 已完整选择性合入。所有 B 所属测试、工具和历史报告与 B 提交一致。

候选保持 **ART_REVIEW**，尚未人工批准。正式安装包仍使用静态入口；门庭动画仅在受限本地预览中启用。

## 已处理问题与验证

- **DQ-SEAM-01 已修复并由 A 复测通过**：门扇保持原门轴，横向各增加6设计像素重叠。原 PNG 字节不变；闭门双色探针从300透色像素变为0，最大RGB差0；86,991设计像素Alpha重建0漏光。开门时重叠随门扇转开，没有固定遮挡补丁。
- B 的独立评估覆盖旧候选 `123d169`；其发现及失败证据原样保留。修复后由 A 执行 B 原断言，只重定向证据路径，不改断言、容差或生产门禁。不能称为 B 已独立复测新提交。
- 33文件/159测试、严格官方类型/构建通过。
- 15项候选预览通过：四尺寸/浅深色关键帧、阶段隐藏/断连/缩放、404回退和闭门探针。
- 13项生产场景通过，含100次侧栏恢复及另外100次真实关闭/重开；热态监听器640/610保持稳定，结束时无运行中的WAAPI动画。
- Git/Live2D客户端组件共存、340/580/1080下720×960照片字节一致、相册413拒绝保留照片且不重放、显式重试、冷恢复及删除不改世界通过。
- 单独串行10次软件后端启动：中位数753ms，P95 774ms。主机CPU/内存采样已记录；其他桌面进程没有停止，不作独占机器或真实GPU结论，也不作改善比例宣称。
- 确定性导入复验、空缓存离线安装、包资源hash与隔离Host smoke通过。

## 当前离线包

`dist/nidofy-dsh-ai-village-0.6.4.tgz`，32,114,727 bytes。

SHA-256：`0837998272c44d76c0d571dde04852dbce90ad8d8ea63aea74d41115d67e4068`。

版本仍为0.6.4，请按SHA区分内部候选。空缓存安装使用不可达registry与禁用生命周期脚本；pnpm的“downloaded 1”计数为本地tgz导入。DSH/React宿主peer在离线安装后才使用本机已固定依赖提供。没有安装到实际用户profile。

## 证据与复现

- `FINAL_RESULTS.json`：当前代码与bundle hash、完整结果和未测项。
- `final-review/integrated-review.json`：最新15项候选及截图；`seam-before/`保存300像素失败复现，`final-review/art/ART_AUDIT.json`保存Alpha复验。
- `final-production/browser-full.json`：13生产场景及200次生命周期循环。
- `final-product/validation.json`：照片、相册413、冷恢复和插件组件共存。
- `final-performance/PERFORMANCE.json`：10次串行软件基线、CPU/内存、测量边界。
- `PACKAGE_CHECK.json`、`logs/final-*.txt`：最终测试、构建、打包和离线安装。
- `ART_IMPORT.json`：母版来源hash、源裁剪矩形及修复后的渲染矩形/门轴。
- `B_ACCEPTANCE.json`、`TASK_LEDGER.md`、`THEME_AUTHORING.md`：QA接收、45项状态和后续主题契约。

```powershell
node scripts/ai-village-entrance-qa-recheck.mjs build final-review --review
node scripts/ai-village-entrance-qa-recheck.mjs review final-review
node scripts/ai-village-entrance-qa-recheck.mjs art final-review --input packages/ai-village/assets/entrance
node scripts/ai-village-entrance-qa-recheck.mjs build final-production
node scripts/ai-village-entrance-qa-recheck.mjs browser final-production
node scripts/ai-village-entrance-final-product.mjs
node scripts/ai-village-entrance-serial-performance.mjs
```

旧 `preview/`、`regression/`、`ui-regression/` 与 B 的报告属于先前版本/执行记录。最新结论以上述 final-* 为准，不把历史失败删去或改成通过。

## 尚未签收

人工美术观感、真实Windows GPU/DPI/多屏仍需验收。独占硬件性能、直接纹理解码CPU、retaining-path归因、低内存与系统休眠未运行；一小时真实运行继续DEFERRED。修复后的B独立执行尚未发生，A复测已完整标明。未推送、合并main、正式发布或擅自批准美术。
