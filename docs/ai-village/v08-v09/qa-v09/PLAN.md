# 0.9 独立浏览器验收计划

脚本：`scripts/ai-village-v09-qa.mjs`。仅显式传入 `--execute` 才构建测试夹具并启动 Chromium；默认调用只打印使用方法。此为准备阶段制定的计划，当时仅完成 Node 语法检查；其后实际运行与差异见[RESULTS](RESULTS.md)及[RUN_NOTES](RUN_NOTES.md)。

## 副作用审查与隔离

- 复用已审查的 `runPreview({buildOnly:true})`，只向本次 `.build/ai-village-v09-qa/<label>/preview` 生成官方鉴权 Host 与真实生产组件夹具；先复制已发布 `lib`/资源，不调用 release/pack，不下载浏览器或依赖。
- Host 仅使用本次 `.build/ai-village-v09-qa/<label>/profile`，不访问日常 DSH_HOME。不请求模型服务，外部网络请求被阻止并作为失败记录。
- 所有证据仅写本目录全新 label；现存 label 拒绝覆盖。续验必须显式 `--resume`，源 label 必须有终态 validation，源生产代码及三份 bundle 哈希必须一致；只复制该已停测试 profile，排除 owner.lock。认证 token 和 URL 不记入证据。
- 只使用正常按钮、选择器、照片流程及夹具所代表的宿主侧栏/断连条件；`inspect` 与 `__sceneMetrics` 仅读。禁止修改 world、actor、ticks、RNG 或游戏事件来加快测试。
- `finally` 关闭真实 runtime、context、Host 和浏览器后才写终态 validation。失败截图、状态及先前通过项保留，后续使用新 label。

## 独立运行项

1. `integration`：庭院照片；暂停时正常布置入口前往书屋；同一世界/时钟/进度；三处真实导航与活动、暂停禁止开始但允许结束；书屋照片；侧栏隐藏与冷启动；相册读取；庭院原坐标恢复；七居民往返。预估 3–5 分钟，单次导航最长 90 秒。
2. `matrix`：340×720、580×720、320×360 实际卡片尺寸，DPR 1/2，两主题；深色配减少动态，浅色配正常动态。每格实际滚动、返回、区域往返、拍照导出与取消，截图等待有限动画完成/文字 opacity=1。预估 5–8 分钟。
3. `lifecycle`：七居民暂停、50 次真实区域切换；资源上界庭院128/书屋121；同世界时钟与进度；每10次 GC后记录监听器、节点、文档及当前资源；最终关闭释放 iframe。预估 3–5 分钟。
4. `performance`：最后独占 CPU 顺序测试，七居民自然活动，庭院和书屋各可见20秒/隐藏20秒；FPS 原门槛20–35，最多600个绘制样本，资源原上界128；新增书屋121纹理与 decoded RGBA byte估算、URL数、parent CDP任务时间。约2分钟。不可与原生测试/构建并行采样。

示例（最终构建通知后）：

```powershell
node scripts/ai-village-v09-qa.mjs integration-01 --execute --scenario=integration
node scripts/ai-village-v09-qa.mjs matrix-01 --execute --scenario=matrix --resume=integration-01
node scripts/ai-village-v09-qa.mjs lifecycle-01 --execute --scenario=lifecycle
node scripts/ai-village-v09-qa.mjs performance-01 --execute --scenario=performance
```

未知 ACK、提交前资源失败、旧 frame 消息/cleanup 与单 iframe 首帧门禁由已运行的真实 runtime/bridge单元回归覆盖；浏览器结果必须与这些测试分开报告。实际 GPU 帧时、全进程原生硬件预算、1小时耐久、真实主模型流式并行和正式书屋美术批准仍未覆盖。此计划不声称整个0.7–0.9路线完成。
