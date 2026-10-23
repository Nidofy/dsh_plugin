# 0.9 证据索引

结论见[RESULTS](RESULTS.md)，失败与续跑来源见[RUN_NOTES](RUN_NOTES.md)，脚本隔离和副作用见[PLAN](PLAN.md)。[FINAL_HASH_CHECK](FINAL_HASH_CHECK.json)绑定source/package；[EVIDENCE_HASHES](EVIDENCE_HASHES.json)逐文件记录SHA-256、大小。

| 目录 | 主要文件与用途 |
| --- | --- |
| [integration-01](integration-01/validation.json) | 实际三活动、隐藏/冷启动、相册、七居民往返 |
| [matrix-01](matrix-01/validation.json) | 受控checkbox异步保存的脚本失败，failure.png/failure-state.json完整保留 |
| [matrix-02](matrix-02/validation.json) | 同源停机integration profile续验；12完整尺寸/DPR/主题组合，37全屏图、12真实照片 |
| [lifecycle-01](lifecycle-01/validation.json) | 50区域切换的DOM/监听器/纹理/URL计数 |
| [performance-01](performance-01/performance.json) | 两区七居民自然活动与隐藏，4组20秒指标和before/after世界 |

各目录的 `build.json` 保存102份源/3bundle散列及当时HEAD、隔离夹具散列。`validation.json`保存完整检查/截图元数据/终态；`video/`是实际交互录像，按文件散列索引查找，不按随机名称推断内容。

推荐目检：

- [阅读桌实际活动](integration-01/activity-reading-desk.png)、[窗边实际活动](integration-01/activity-window-seat.png)、[书柜实际活动](integration-01/activity-bookcase.png)。
- [七居民书屋全景](integration-01/seven-bookhouse.png)、[冷启动共享相册](integration-01/bookhouse-cold-album.png)。
- [真实书屋照片](integration-01/bookhouse-first.png)、[真实庭院照片](integration-01/courtyard-first.png)。**bookhouse-first仅为720×960照片；不是首入全屏图。**
- [320×360 DPR1浅色返回](matrix-02/book-320x360-dpr1-light-return.png)、[320×360 DPR2深色顶部](matrix-02/book-320x360-dpr2-dark-top.png)、[320×360 DPR2深色返回](matrix-02/book-320x360-dpr2-dark-return.png)。
- [340×720 DPR1浅色书屋](matrix-02/book-340x720-dpr1-light-top.png)、[580×720 DPR2深色书屋](matrix-02/book-580x720-dpr2-dark-top.png)。
- [庭院性能后恢复](performance-01/performance-courtyard-restored.png)、[书屋性能后恢复](performance-01/performance-bookhouse-restored.png)。

矩阵命名 `book-<宽>x<高>-dpr<1|2>-<light|dark>-top|return.png` 为书屋面板顶部/底部返回按钮，`court-...png` 为正常返回后的庭院入口；`photo-...png`为真实固定720×960输出。浅色正常动态/深色减少动态。全屏尺寸在validation.captures中记录，DPR2图片像素随之增加。
