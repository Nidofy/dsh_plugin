# 本轮改动清单

基线2cab99a；源码0.6.2。未提交。原NEXT_FEATURES_2026-10-21.md未改动且排除在本轮快照之外。

## 源码、资产、测试与工具

- `packages/ai-village/README.md`
- `packages/ai-village/assets/portraits/bluewhale.png`
- `packages/ai-village/assets/portraits/claude.png`
- `packages/ai-village/assets/portraits/gemini.png`
- `packages/ai-village/assets/portraits/gpt.png`
- `packages/ai-village/assets/portraits/grok.png`
- `packages/ai-village/assets/portraits/kimi.png`
- `packages/ai-village/assets/portraits/manifest.json`
- `packages/ai-village/assets/portraits/qwen.png`
- `packages/ai-village/assets/thumbnails/bench.png`
- `packages/ai-village/assets/thumbnails/books.png`
- `packages/ai-village/assets/thumbnails/eat.png`
- `packages/ai-village/assets/thumbnails/manifest.json`
- `packages/ai-village/assets/thumbnails/plant.png`
- `packages/ai-village/assets/thumbnails/rest.png`
- `packages/ai-village/assets/thumbnails/work.png`
- `packages/ai-village/experiments/phase4-client.tsx`
- `packages/ai-village/package-lock.json`
- `packages/ai-village/package.json`
- `packages/ai-village/src/client/ArrangementControls.tsx`
- `packages/ai-village/src/client/Floating.tsx`
- `packages/ai-village/src/client/Hud.tsx`
- `packages/ai-village/src/client/Icon.tsx`
- `packages/ai-village/src/client/ManagementPanel.tsx`
- `packages/ai-village/src/client/Notifications.tsx`
- `packages/ai-village/src/client/PhotoPanel.tsx`
- `packages/ai-village/src/client/SettingsPanel.tsx`
- `packages/ai-village/src/client/content-style.ts`
- `packages/ai-village/src/client/frame-bridge.ts`
- `packages/ai-village/src/client/runtime.ts`
- `packages/ai-village/src/client/ui-contract.ts`
- `packages/ai-village/src/client/ui-state.ts`
- `packages/ai-village/src/core/arrangement.ts`
- `packages/ai-village/src/core/camera.ts`
- `packages/ai-village/src/core/frame-protocol.ts`
- `packages/ai-village/src/core/notifications.ts`
- `packages/ai-village/src/core/preferences.ts`
- `packages/ai-village/src/definitions.ts`
- `packages/ai-village/src/frame/atmosphere.ts`
- `packages/ai-village/src/frame/input-router.ts`
- `packages/ai-village/src/frame/neighborhood-art.ts`
- `packages/ai-village/src/frame/scene.ts`
- `packages/ai-village/src/frame/viewport.ts`
- `packages/ai-village/src/host/service.ts`
- `packages/ai-village/tests/frame-bridge.client.spec.ts`
- `packages/ai-village/tests/host.spec.ts`
- `packages/ai-village/tests/input-router.client.spec.ts`
- `packages/ai-village/tests/preferences.spec.ts`
- `packages/ai-village/tests/runtime.client.spec.ts`
- `packages/ai-village/tests/ui-v1.spec.ts`
- `packages/ai-village/tests/viewport.spec.ts`
- `scripts/ai-village-resources.mjs`
- `scripts/ai-village-ui-v1-browser.mjs`
- `scripts/ai-village-ui-v1-navigation.mjs`
- `scripts/ai-village-ui-v1-performance.mjs`
- `scripts/ai-village-ui-v1-portraits.mjs`
- `scripts/ai-village-ui-v1-thumbnails.mjs`
- `scripts/ai-village-ui-v1-visual.mjs`
- `scripts/ai-village-v06-browser.mjs`
- `scripts/ai-village-v06-neighborhood-browser.mjs`
- `scripts/ai-village-v061-browser.mjs`
- `scripts/ai-village-v061-performance.mjs`

## 文档与证据

- docs/ai-village/UI_V1_BASELINE.md
- docs/ai-village/ui-v1/：冻结规范副本、实施记录、结果、完整验收矩阵和本清单。
- packages/ai-village/art/QA/ui-v1/：本轮报告、哈希、实际运行截图与短录屏。

controller.ts、home-state.ts、floating-layout.ts无diff；没有修改宿主仓库、世界schema、原始批准图片或其他插件业务。definitions.ts仅由资源生成器更新。
