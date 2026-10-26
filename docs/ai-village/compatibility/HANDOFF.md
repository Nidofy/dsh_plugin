# AI Village rc.3 A6 完成检查点

2026-10-26，用户最新要求为“完成剩余的A6及其之前的工作，暂时不要进入B阶段”。**A1–A6已通过，当前安全暂停；B未启动，不自动继续，不创建定时恢复任务。**

## 固定交付

- 插件仓库：D:\Documents\FeiyangChen\devApps\dsh_plugin。
- 分支：codex/feature-ai-village-entrance；HEAD：ead9a0fb97631bf651421ebac9e1e6ab78012950。本轮工作树未提交/推送，未发布npm。
- AI Village：0.13.0-preview.5，官方DSH 0.2.1-rc.3；world14/content10/region2/frame11不变，游戏src与初始HEAD无差异。
- 包：dist/nidofy-dsh-ai-village-0.13.0-preview.5.tgz，53,670,374 B、398文件。
- SHA256：c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760。
- 新冻结目录：.build/ai-village-rc3-pre5-a6-complete-20261026；[机器可读检查点](0.13.0-preview.5/checkpoint-a6.json)绑定工作树、源码/证据、包及依赖身份。HEAD不是全部未提交适配的身份。
- 原用户未跟踪的NEXT_FEATURES_2026-10-21.md、UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md及output/保留，不混入本轮文件清单。

## 验收结果

完整矩阵见 [DSH_0.2.1_RC3_RESULTS.md](DSH_0.2.1_RC3_RESULTS.md)。已通过415测试、严格Host/Client构建、两独立源码解压的同SHA可复现包、空缓存官方离线安装/Koffi、真实旧rc.2包存档→rc.3继续CAS、双DPR三场景完整玩法，以及官方Desktop安装/升级/冷恢复/More/草稿/Sidebar/IME事件/Escape/三次启停/卸载保留存档。

恢复后新增：

1. 从源码独立重建Git与Live2D本地rc.3 QA候选，四组严格类型与构建通过；14测试文件36通过，2项Hg因未安装跳过。正式rc.2源码、manifest、lib及tgz逐hash不变。见 [QA报告](coexistence-qa/RESULTS.md)。
2. 官方管理器正常安装三包；三个有序唯一入口、More和会话草稿、临时Git实际status/diff、Git+Village/Live2D上下布局、Live2D animated、双向显式互斥、Sidebar释放恢复、空间不足暂停及收起后真实首帧恢复均通过。各包启停、三包冷恢复和卸载保留世界均通过。
3. 有效拖放证据为drag-pre5-06：DPR1.75、1279×821 CSS视口，鼠标移动210.39 CSS px且生产gesture为actor/moved，角色实际移动222.76世界像素；r144同operationId确认新坐标。非法落点真实拖拽后返回原位。七人、长期事实、草稿、单owner和存档身份保持。最终r147冷恢复及卸载原样保留。

**drag-pre5-05原runner虽然输出PASS，但审计确认鼠标仅移动2.14 CSS px、角色未动，是假阳性，明确不采纳。** 01–05原始结果保留；新的原生汇总标注排除，不能按原始PASS字段计入门禁。见 [恢复审计](RC3_A6_RESUME_AUDIT.md) 和 [原生汇总](0.13.0-preview.5/native/coexistence-summary.json)。

Git 0.1.3-rc3-coexistence.qa.1、Live2D 0.1.2-rc3-coexistence.qa.1仅用于本地组合QA，不是它们的正式rc.3发行，也不宣称Hg完整验收。包位置和hash见QA manifest。Village包内README保留冻结时的候选措辞，A6签收绑定当前固定SHA及外部证据，不重打旧包。

## 安全收束及保留边界

本轮三个插件已通过官方管理器卸载，Host路由与Client注册撤销，游戏存档保留。专用Desktop进程树及18783端口清理见 [cleanup-resume.json](0.13.0-preview.5/native/cleanup-resume.json)；旧双DPR浏览器清理仍有效。Git hook测试残留仅按已核实PID/创建时间/父子链清理，见QA报告。无后台测试、模型调用、自动继续任务。

日常DSH_HOME未访问；测试profile仍在.build/ai-village-rc3-desktop/home。此前rc.2隔离QA源游戏文件hash保持不变；不删除profile、重置世界或覆盖旧失败来复验。实体IME候选框、物理睡眠/最小化、长期硬件性能未覆盖；原生未完整重玩全部剧情，完整玩法由同包浏览器套件验证；不要混称证据层次。

历史暂停目录.build/ai-village-rc3-pre5-paused-20261026及[旧checkpoint.json](0.13.0-preview.5/checkpoint.json)不改写。旧官方rc.3拒绝rc.2 Source Control包的记录仍有效，本轮通过另建真实QA候选闭环，没有绕过engine。

## 来源及以后复验

公开tag dsh-v0.2.1-rc.3 / commit 1f81c047fc48fa190a683e469daa699857e9afe8，归档SHA fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60。有效归档为.build/ai-village-rc3-source/official-complete.tar.gz；official.tar.gz是旧超时残件，不使用。实际prepared源码从baseline.json读取；每次prepare新建目录。

官方Desktop内嵌commit be72761ee1a6736ebcdf4f3739363b083ae53c98，与公开tag不同；安装器及app.asar hash见native/distribution.json。运行原字节解包副本，未系统安装、未修改ACL或禁用sandbox。carrier位于Temp专用QA目录，由rc3 launcher严格核验路径/hash/PID/命令行。

原runtime锁SHA cb921ac43ecb67ddf6a9aea667b362848a7b8d5795a1bc2d7686db1eee7c6ba9不变。rc.3 source-ui与共存UI-primitives各有独立锁；根compatibility、旧runtime和其他正式包继续rc.2。当前已通过项目在包和源码身份不变时无需无理由重跑。

用户以后明确要求复验时，先读相应脚本副作用，使用新label保留历史。Village准备/构建入口为prepare-runtime-rc3、prepare-source-ui-rc3、prepare-ai-village-rc3、ai-village-release；相关包与存档检查输出使用不覆盖写入。共存QA入口为rc3-coexistence-prepare和rc3-coexistence-build。原生只使用ai-village-rc3-desktop-launch.ps1和ai-village-rc3-native.mjs，不复用旧tea launcher或日常profile。

**当前结束于A6。进入B需要用户另行明确指示。**
