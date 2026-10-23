# Seedance / GLM / MiniMax / Llama / Mistral 美术交付

基线：`codex/feature-ai-village-entrance`，`6a254cd`，AI 小院 `0.9.0-preview.2`。

沿用[现有七角色资源规范](ROSTER_ASSETS.md)，完成五套正面 Q 版纸娃娃资源，每套 16 个透明部件、四表情、五段基础动作和工作／用餐／坐姿配套，共 80 张运行部件。另提供骨架、场景活动说明、透明拼装立绘、源图、提示词与哈希清单。

- [交付说明](../../packages/ai-village/art/deliverables/roster-expansion/README.md)
- [离线交互预览](../../packages/ai-village/art/deliverables/roster-expansion/preview.html)
- [五人拼装总览](../../packages/ai-village/art/QA/roster-expansion/assembled-contact.png)
- [部件总览](../../packages/ai-village/art/QA/roster-expansion/parts-contact.png)
- [动作与资源校验](../../packages/ai-village/art/QA/roster-expansion/validation.json)
- [全部生成记录](../../packages/ai-village/art/prompts/roster-expansion-generation-record.json)

制作使用内置 image_gen；裁切／拼装使用 Sharp。Seedance v02 修正重复袖子，GLM 与 Mistral 补绘完整后发和活动件；相邻格残片通过重新补绘或收紧原生矩形裁切排除。保留原生 alpha，未对部件重新上色或用矢量占位代替。

运行了可复现制作脚本及美术校验脚本：80 张 PNG 的源像素、透明边界、哈希、引用与 25 段动画结构通过；实际生产 PaperDoll / samplePose 在离线 Chromium 中完成 48 个五人时间采样，0 浏览器错误、0 外部请求。检查 96/108/128px、四表情、三种底色和八类动作／活动。大于 32 像素的额外孤立碎片为 0。

交付范围是美术。没有改变生产七人名单、世界 schema、入口加载名单和资源白名单；没有宣称完成 Cubism 或十二人游戏集成，也未执行 Desktop 安装验证或发布 npm。独立美术包位于 `output/ai-village-roster-expansion-2026-10-23/`，不会自动混入现有插件发行包。
