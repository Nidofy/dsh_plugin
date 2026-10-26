# 当前暂停点：0.13.0-preview.5 / rc.3 A6 通过

2026-10-26：用户恢复后，独立重建并验证Git/Live2D的本地rc.3 QA候选，补齐真实三插件共存和有效角色拖放；A1–A6已通过，按要求安全暂停，B未启动。此前415测试、双DPR玩法、旧档、离线安装和可复现包身份不变；正式Git/Live2D仍保留rc.2。固定包、SHA、清理及新检查点见 [rc.3实施记录](../compatibility/DSH_0.2.1_RC3_RESULTS.md)。下方pre3及旧阻塞记录保留为历史。

# 历史开发结果：0.13.0-preview.3

2026-10-25，独立仓库 dsh_plugin，分支 codex/feature-ai-village-entrance，基线 HEAD e8fd896ec3713c6023ec17b81e6328055d59cc1c。工作树未提交/推送，没有发布 npm 或修改日常 DSH_HOME。用户原规划文件和 output 均保留。远端最新 HEAD 此前未能认证读取；结果以本地基线、源文件哈希和固定包为准。

## 交付包

包：dist/nidofy-dsh-ai-village-0.13.0-preview.3.tgz，53,661,172 B，397 文件。

SHA256：`50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`。

[包身份](tea-square/play-package-identity.json)核对129份源码、Host/client/frame三个bundle及全部包内lib/assets；双DPR运行记录同源。冻结快照为 .build/ai-village-tea-0.13.0-preview.3-play-frozen。包中没有启用方向动画候选。

## 已实现与批准

- 地图已批准，支持小院、书屋、茶会三个实际场景往返；湖畔和工坊继续 planned。地图浏览不写世界，只在打开时加载六个图层。
- 点击空地真实行走、绕障、取消、暂停/隐藏及冷恢复保留；剧情不被拖放静默打断。
- 用户明确批准茶会四图，以及书屋全十二居民接触候选并要求验证后启用。书屋现使用两张正式图集、各自握书/坐姿和三类普通活动，共读/书页谜题保留。茶区四图、三人杯垫故事、普通挑茶与真实休息坐姿、首次茶签、重玩计数、手账/关系/照片已接入。
- 当前 world14/content10/region2/frame11，旧 world13 冻结。所有地区共用一个 world/owner/时钟；非活动区只存返回脚点。未知保存回执只读核对，不重放动作。
- 真实拥挤 QA 发现的书屋普通目标丢失与茶区抢位/旧路径问题已修：有限等待与重规划使用原绝对期限，旁观者继续生活，未修改历史 world.step。35组三人组合连续完成、首次来源和奖励幂等通过。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| 完整回归 | 74文件 / 410测试 PASS，94.54秒，maxWorkers1 |
| 官方严格类型与构建、打包、smoke、空缓存离线安装 | PASS；.build/ai-village-approved-pre3-{tests,build,pack,smoke,offline}.log |
| [双DPR真实浏览器](tea-square/QA_PLAY.md) | 各32检查/30PNG，零页面错误/外网；书屋普通/共读、茶故事/不同cast/未知ACK/中途冷恢复/普通坐姿/照片/中英文及尺寸矩阵通过 |
| 反复旅行 | 每轮19次真实旅行，纹理/source/Blob库存每区域恒定；所有合法12选7组合至多128纹理 |
| [独立软件性能](performance/RESULTS.md) | 七人小院/书屋/茶区约5秒样本21.76/22.47/21.93 FPS，JS paint p95 0.8/0.9/0.9ms；旅行真实首帧740.7–882.2ms；不是硬件前台或长期基准 |
| 隐藏 | 真实侧栏隐藏5秒世界逐字段不变、iframe卸载；该自有浏览器CPU单核当量0.225% |
| 内存 | 新增12次旅行资源库存恒定；RSS/private与heap短期有增长，保留原始数据，没有无泄漏或长期稳定承诺 |
| [隔离原生](tea-square/native/APPROVED_PRE3_RESULTS.md) | 官方0.2.1-rc.2安装、固定包匹配、七人检查点、完整进程冷恢复、首次纪念通过；获授权可见窗口补齐茶座/取消、书屋三站、两张照片、回程释放和不同cast完整重玩。Intel Arc140T，历史失败另列 |

## 保留的缺口与后续

1. 默认Hidden原生约3tick/s导致180/300秒阶段超时；独立后台flags探针6ticks/5frames记NOT_RUN，原件保留。用户授权VisibleQa后，实际前台主窗3.04秒推进91ticks/77frames；茶座、书屋三普通站、照片、回程及不同cast重玩均获得通过证据。一轮可见书桌120秒超时的原因仍未定位，不能因后续通过而抹去。全部专用进程树已退出，18774无监听，见[最终清理](tea-square/native/native-visible-cleanup.json)。VisibleQa只属于QA launcher，冻结产品包未变。
2. 蓝鲸方向样板仍有接触循环、滑步、右向、停步和转向重影缺口，未批准/启用。工程预览与失败源图保留，[制作工单](DIRECTION_ART_WORK_ORDER.md)列出逐项交付；没有水平镜像冒充四方向。
3. 七人近距会自然遮挡桌面和同伴，深度与世界脚点真实；不能称两位 writer 始终清晰。照片没有通过调整 z 或移动旁观者美化。
4. 物理睡眠/最小化、前台硬件长期性能、额外物理 DPI 和长期内存浸泡未覆盖。软件短样本不能替代这些项目。
5. [后续扩展评估](EXPANSION.md)已完成准备，不开放湖畔/工坊，也不新增后台世界。

## 历史证据

[0.12结果](RESULTS.md)及冻结包保持原样；0.13.0-preview.1 为已验收的 planned 门禁包；pre2 为首轮动态阻挡缺陷的未合格候选，见[首次集成记录](approved-integration-attempt.json)。后续源码和截图不冒用历史包身份。[完整实现与批准矩阵](APPROVED_SCENES.md)保留分阶段记录。
