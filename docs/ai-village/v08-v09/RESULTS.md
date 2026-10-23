# 0.8 / 0.9 验证记录

## 0.8.0-preview.1 候选2

源码提交 `b7c4db6613300ce3d85511c20c033755a0f490e0`，包身份见 PACKAGE_V08.json。

已运行：

- `node scripts/typecheck.mjs`：PASS，全仓严格类型与固定官方Host/Client公开声明。
- `node scripts/ai-village-release.mjs`：PASS。
- `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`：46文件233项PASS；之后仅新增一项v8在途棋局迁移回归，encounter.spec共6项PASS（总测试234，未把新总数冒称全量重跑）。
- `node scripts/pack.mjs --only=ai-village`：276文件，32,174,210 bytes。
- `node scripts/smoke-packed.mjs --exclude-sandbox`：PASS，Host/browser导出、持久化、真实worker、官方CLI隔离profile组合。
- `node scripts/offline-install-check.mjs --exclude-sandbox`：PASS，空缓存、8个本地包离线安装与runtime；pnpm现有peer提示未改变。
- `git diff --check`：PASS。

实际缺陷/失败记录：

1. 旧v7活动测试手工降级fixture漏掉schema9新字段，旧codec正确拒绝；修正fixture显式删除新字段，不放宽validator。
2. 首轮全量Host测试仍加载旧lib，schema9保存被拒；重建官方Host后通过。
3. 浏览器integration-01首帧失败：frame版本分派遗漏9。提取decodeFrameWorld作为真实render调用入口，补当前/旧版/future/unknown回归，候选2重建验证。候选1不安装、不作为通过包。

浏览器与原生Desktop正在分别使用全新隔离profile验收；当下只确认候选2已真实显示首帧、首类偶遇真实步行三阶段完成与纪念物保存。完整回归、双主题尺寸、资源性能、原生冷恢复结论由随后qa/native报告补齐。

入口ART_REVIEW、生产选择器、首帧门控及两个用户未跟踪文档均保持。未远端发布，未改日常DSH_HOME或宿主代码。

## 0.9

书屋契约审计完成，见BOOKHOUSE_AUDIT.md。尚未合并区域实现、尚无正式新场景原画批准；不能将审计路线通过当作产品验收。
