这些是开发/复验中曾失败的历史截图与断言，不是最终验收证据。
- visual：初期夹具尺寸或选择器适配；最终 validation.json 与 metadata.json 才是本包矩阵。
- interaction-checks：保留最后捕获的跨 iframe 点击竞态；runtime 父页守卫及新增单测修复，最终真实点击复验通过。
- 其他已解决迭代包括异步确认 checkbox 的测试等待方式、宽窄条件下设置按钮的严格定位。
- performance-pre-hud-fix.log 为源码修订后主动中止的部分采样，不能计为 PASS。
源代码已冻结后的最终结果见 docs/ai-village/ui-v1.1/BUILD_RESULTS.md。
