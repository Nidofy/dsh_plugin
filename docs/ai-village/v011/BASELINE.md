# 0.11 迭代基线

本轮读取完整用户附件后于 2026-10-24 开始实施。工作目录为独立 `dsh_plugin`；分支 `codex/feature-ai-village-entrance`，起点 HEAD `fb47baa2d3a9366ceae95dfeab7c38d5bd37e939`。

起点未提交内容：`docs/ai-village/NEXT_FEATURES_2026-10-21.md`、`docs/ai-village/UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md`、`output/`，均保持原样。本轮不重置、清理、推送、发布，也不访问日常 DSH_HOME。

## 已核对

- 包 `0.10.0-preview.1`，world11/content8/frame8，12 位可选居民、同时最多 7 位。
- 书屋三幕故事、共享存档、首次参与者事实、跨区纪念物、故障恢复门与未知保存只读核对已实现。
- `content-style.ts` 已有卡片与原生控件 `accent-color`；本轮只验证实际计算样式。
- `residentAssets` 已按在场成员和区域选取；Host 字节长度与 SHA 验证；frame 已跳过存在的纹理解码；离场移除 rig、销毁纹理与 URL。
- `bundle()` 每次资源更新复制全部选中压缩字节再 transfer；区域切换新建 iframe，因此重新解码。后续测量应区分复制、下载、解码和区域重建，不重写按需选择。
- `life-content/RESULTS.md` 记录旧候选 60 个有效分钟、五次关闭重开与两区切换；这是旧包证据，不能冒充本轮结果。最小化、物理睡眠/唤醒仍缺真实验收。
- 正式书屋旧候选仅 CONCEPT_CANDIDATE；冻结几何以 `bookhouse-scene.ts` 为准。新分层素材在视觉签收前不进入正式运行资源，不修改批准字段。

## 本轮重新运行

`node node_modules/vitest/vitest.mjs run --config scripts/ai-village-official.vitest.mjs --maxWorkers=2`

结果：57 个测试文件、287 个测试全部通过，48.66 秒。该结果对应改动前基线；新增实现需单独复验。

## 所有权

- story_core：剧情目录、执行/状态迁移和对应行为测试。
- memory_ui：只读关系事实投影、独立回忆册组件和测试。
- bookhouse_art：独立 v02 分层候选、提示词、预览及美术记录。
- 主线程：架构集成、共享 UI/运行桥、frame、验收、包与最终记录。

美术批准与物理设备未测条件保持独立门禁；工程测试通过不能代替签收。
