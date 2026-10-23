# 0.8 / 0.9 验证记录

## 0.8.0-preview.1 候选3

源码提交 `e192786`，最终包身份见 PACKAGE_V08.json。候选3仅修复成功读取空相册后仍显示“尚未读取”的问题；Host、frame与候选2相同。未读取与当前 profile/epoch 下已读取为空现在明确区分。

已运行：

- `node scripts/typecheck.mjs`：PASS，全仓严格类型与固定官方 Host/Client 公开声明。
- `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`：46 文件、235 项全部 PASS。
- `node scripts/ai-village-release.mjs`：PASS。
- `node scripts/pack.mjs --only=ai-village`：276 文件，32,174,312 bytes。
- `node scripts/smoke-packed.mjs --exclude-sandbox`：PASS，Host/browser 导出、持久化、真实 worker、官方 CLI 隔离 profile 组合。
- `node scripts/offline-install-check.mjs --exclude-sandbox`：PASS，空缓存、8 个本地包离线安装与 runtime；pnpm 现有 peer 提示未改变。
- `git diff --check`：PASS。

浏览器证据见 qa/RESULTS.md，原生 Desktop 证据见 native/RESULTS.md。候选2已通过真实三阶段偶遇、纪念物、实际照片与完整进程冷恢复；候选3补充最终包安装、空相册及读取既有世界/照片不变验证（官方同版本原地重装被宿主拒绝，改为隔离新安装后停机复制插件存档再冷启动，不冒称原地升级）。具体最终 gate 以两份报告的测量结果为准。

实际缺陷与失败记录保留：

1. 旧 v7 活动测试手工降级 fixture 漏掉 schema9 新字段，旧 codec 正确拒绝；修正 fixture 显式删除新字段，不放宽 validator。
2. 首轮全量 Host 测试仍加载旧 lib，schema9 保存被拒；重建官方 Host 后通过。
3. 浏览器 integration-01 首帧失败：frame 版本分派遗漏9。提取 decodeFrameWorld 作为真实 render 调用入口，补当前/旧版/future/unknown 回归。候选1不安装、不作为通过包。
4. integration-02 的收藏步骤因多个同名“空”文本导致测试定位歧义；收窄到目标 details，保留失败记录。
5. integration-03 发现真实空相册状态错误，候选3修复并由 integration-04 复验，不把旧候选记录冒称最终包证据。

入口 ART_REVIEW、生产选择器、首帧门控及用户未跟踪文档均保持。未远端发布，未改日常 DSH_HOME 或宿主代码。

## 0.9

0.8 数据/玩法/性能 gate 通过后已实施独立书屋开发样板；新区域不是已批准正式场景原画。当前0.9验收状态见 [BOOKHOUSE_RESULTS.md](BOOKHOUSE_RESULTS.md)，包身份见 [PACKAGE_V09.json](PACKAGE_V09.json)，书屋契约见 [BOOKHOUSE_IMPLEMENTATION.md](BOOKHOUSE_IMPLEMENTATION.md)。

