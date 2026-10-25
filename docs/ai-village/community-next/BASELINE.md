# 社区地图与自由行动：启动基线

2026-10-25，工作目录 `D:\Documents\FeiyangChen\devApps\dsh_plugin`，分支 `codex/feature-ai-village-entrance`，起点 HEAD `e8fd896ec3713c6023ec17b81e6328055d59cc1c`。

当前提交的包版本是 `0.11.0-preview.1`。README 首段与源码一致为 world12 / content9 / bookhouse2 / frame9；scene3 / rules4 / region1 / preferences3 保持。README 下方的旧版本段落是历史记录，不能据此覆盖现行源码。书页谜题、五位新人初见、固定配对与共同回忆册已有真实实现和验收。

启动时保留的用户未跟踪文件：`docs/ai-village/NEXT_FEATURES_2026-10-21.md`、`docs/ai-village/UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md` 与 `output/`。未执行 reset、clean、分支切换、提交、推送或日常 profile 安装。

启动工作树检查：

| 检查 | 结果 |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --config scripts/ai-village-official.vitest.mjs --maxWorkers=2` | 62 文件、305 测试通过，62.27 秒 |
| `node scripts/typecheck.mjs` | exit 0，全仓类型检查通过 |

日志为 [测试](baseline-tests.log) 与 [类型](baseline-types.log)。这些检查在并行开发开始后运行，读取的是当时工作树，不能宣称严格冻结的 HEAD 字节验证；最终构建和验收须记录新的源文件哈希。

已核对的保护边界：地图展示不应发世界命令；旅行沿用 `switchRegion` → `commitWorld` → SaveTransaction 和真实首帧门控。未知回执由只读核对处理，不重放。规划中节点需在核心旅行操作与 codec 中都拒绝。离开区域只存有限脚点，目标区恢复必须经当前几何校验。用户主动暂停保留，不能将加载动画视为成功。新手动移动字段必须升级 schema 并冻结旧 decoder。

浏览器验证应暂停后比较 revision 与完整 world，避免把自主 ticks 引发的自然保存误判为地图写入；也应在运行世界中确认地图浏览没有额外命令。渲染/输入使用实际 iframe 的 projection，而非以屏幕坐标猜逻辑脚点。隔离 Chromium 软件 GPU 数据与原生 GPU/物理休眠验证分开记录。
