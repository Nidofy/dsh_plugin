> 2026-10-25 用户明确答复：“批准茶会场景候选，继续集成”。以下保留候选审阅证据；正式资源登记在 assets/tea-square/manifest.json，玩法/包验证另记录。

# 茶会广场独立场景候选

2026-10-25。状态 **VISUAL_REVIEW_REQUIRED**；没有注册正式资源，地图节点仍为 planned。

使用内置 image_gen 制作独立茶桌、茶柜和留言树，背景沿用本轮原生空场景候选。没有外部付费 API，也没有将家具烘焙进背景。原生 PNG 与透明通道保留；运行候选仅做等比 contain 缩放、透明填边和无损 PNG 编码。源及派生哈希、尺寸、alpha、来源和 MIT 许可见 [manifest](../../../../packages/ai-village/art/candidates/tea-square-v01/manifest.json)。

[候选预览](../../../../packages/ai-village/art/candidates/tea-square-v01/preview.html) 使用真实 `PaperDoll` / `samplePose`，冻结 `tea-square-scene.ts` 的画布、家具矩形、入口和桌边脚点，没有存档或第二套世界模拟。三人、七人和入口 × 昼夜 × 340/540 宽 × DPR1/2 共24图；浏览器无报错、无外网。四纹理 2,281,183 B，RGBA 4,487,424 B，低于契约12纹理/12MiB/5MiB预算。

茶桌完整前景位于3210，茶柜2410，树2370；角色按脚点深度排序。杯垫/茶签属于独立运行图形层，最终玩法渲染必须再次检查，不能将这份无世界静态审阅当作正式安装包截图。

主线程已向用户提出只覆盖四张场景图及等比派生的独立视觉批准请求，仍待答复。此请求不覆盖书屋或蓝鲸方向动画。批准后才能复制到 assets、注册资源闭包并开放地图，再完成真实三人故事、回执丢失、照片、冷恢复、重复旅行和最终包性能验收。

`scripts/ai-village-tea-art-review.mjs` 保留完整生成、真实渲染和测量流程。最初脚本括号与本机 Python 默认编码问题在运行前修正；最终24图为成功运行，不混入失败输出。
