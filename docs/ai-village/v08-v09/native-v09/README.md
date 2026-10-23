# 0.9 原生验收专用流程

2026-10-23已完成固定候选包的原生验收，见[实际结果与限制](RESULTS.md)。下面是流程说明；通过项以result.json、明确SHA及RESULTS为准。

- Launcher：`scripts/ai-village-v09-desktop-launch.ps1`。新根`.build/ai-village-v09-desktop`、CDP仅`127.0.0.1:18767`、官方既有0.2.1-rc.2载体。隐藏启动，正常sandbox，停止前校验EXE和本根user-data。
- Driver：`scripts/ai-village-v09-desktop.mjs`。固定`AI_VILLAGE_EXPECTED_SHA`与`0.9.0-preview.1`，新证据目录拒绝覆盖；官方Plugins安装，后续只通过产品UI写入，state/album/photo接口仅读取取证。
- `install`后完整停止载体。若验迁移，只从已停止的0.8专用测试根复制`nidofy-ai-village`目录和预期checkpoint；保存原hash清单，保留新生成目录，不复制凭据、会话、依赖、Electron数据或日常profile。
- `check`先记录暂停庭院旧事实和脚点，真实旅行CAS后检查schema10、原ticks/RNG及共享事实不变；新frame须满足实际`region=bookhouse`及`frames>0`。依次恢复模拟，点击三家具操作，等待真实到位再暂停截图。共享journal保持，实际renderer生成720×960书屋照片并保存；输出完整bookhouse checkpoint。
- 完整终止和启动后，`restored`逐字段核对bookhouse world、album及PNG哈希，再通过真实返回按钮回庭院，核对保存的脚点/朝向/共享事实及暂停时钟不变。

每次运行使用新label。所有失败原样保留，不通过reset或写造世界掩盖；与浏览器性能采样串行，收尾终止本次全部载体。代码图形仅开发样板，不表示批准新背景/家具原画或改变入口资源门禁。
