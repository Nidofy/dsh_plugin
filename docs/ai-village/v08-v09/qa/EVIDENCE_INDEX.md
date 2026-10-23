# 0.8 浏览器证据索引

结论见 [RESULTS.md](RESULTS.md)，失败过程与续验来源见 [RUN_NOTES.md](RUN_NOTES.md)。各目录的 build.json、validation.json、video/ 与 PNG 不覆盖历史轮次。

- integration-01/failure.png：schema9首帧真实失败，候选1历史。
- integration-02/0-leaves-gather-stage-1.png 至 stage-3.png：第一次叶子偶遇；1-paper-rescue-stage-*：第一次留言偶遇。
- integration-02/2-leaves-gather-naturally-expired.png、3-paper-rescue-pass-offer.png、4-leaves-gather-cancel-offer.png：自然过期、略过、取消窗口；以validation检查及视频区分“按钮前截图”和操作结果。
- integration-02/5-paper-rescue-stage-*、6-leaves-gather-stage-*：两类第二次真实完成；validation保存首次记录与count2。
- integration-03/failure.png：候选2已读空相册0/20，但state为空的边界；不当作最终照片分类结果。
- integration-04/empty-album-successfully-read.png：候选3实际空相册读取成功。
- integration-04/collections-saved-facts.png、collections-seven-present-still-two-shared.png：收藏由已保存事实派生，仅在场不增共同回忆人数。
- integration-04/optional-goals-derived-from-facts.png：三项可选目标。
- integration-04/collections-cold-restored.png：精确世界冷恢复后的收藏。
- integration-04/collections-{340x720,580x720,1080x760,320x360}-{light,dark}-{top,bottom}.png：四实际卡片尺寸、双主题顶部上下文/底部分类滚动图；底部照片行在冷会话未读相册时正确显示未知。
- decor-01/both-encounter-keepsakes-expanded.png：最终候选3正常展开、自然走开后的两件清晰纪念物。
- lifecycle-01/validation.json：50次关开、世界/资源/DOM/监听器断言与关闭释放。
- performance-01/performance.json：候选2历史七人自然软件性能；最终候选3另见performance-02。
- performance-02/performance.json、validation.json：最终候选3七人自然可见22.297FPS/128纹理、隐藏0绘制和精确世界冻结。

录屏保存在各轮video/。最长integration-02包含约十分钟真实自然窗口等待，不删去中间等待来伪装即时偶遇。证据不包含测试profile、owner锁、鉴权URL或凭据。
