# 0.8 浏览器验收过程

## integration-01：真实首帧失败，保留历史证据

候选 1 读取存档成功（schema9/content6/rules4，tick0），但场景实际显示“场景显示失败”，尚未执行偶遇。20 秒首帧等待失败，pageerror 与外部请求为空。failure.png、failure-state.json、validation.json 与录屏留存。

根因由主实施确认：frame scene 的 render 分派仅接受 [7,8]，schema9 被送入低层旧 validator。主实施改为独立 decodeFrameWorld 并加当前版本及历史7/8回归，再构建候选2。此项为产品缺陷，不归因于选择器或测试时序。

## integration-02：候选2自然偶遇流程

使用独立新 profile、新输出目录，读取每次真实组件模拟 tick 和纯投影 currentEncounter；不改 tick、seed、world 或生产代码。候选2已成功首帧，正在自然窗口执行真实接受、三阶段、奖励摆放与重复计数。最终结论以本目录 validation.json 为准。

阶段观察：窗口0 leaves-gather、窗口1 paper-rescue 均实际完成三阶段、记入首次回忆并通过布置确认摆放对应奖励。窗口2不操作，真实过期后不消费、不写回忆；窗口3略过，消费保持于隐藏/用户暂停恢复后；窗口4接受后正常取消，不写回忆、不重复同窗。窗口5 paper-rescue 第二次完成，count2且首次回忆其他字段完全保留。

两件首次摆放截图中居民仍在活动结束位置，可能遮挡纪念物；这些截图只证明操作与世界摆放，不作为清晰美术验收。后续同哈希复制停机测试 profile，以真实展开和自然走开补独立全景。

最终本轮状态为 FAIL：窗口6 leaves-gather 也完成第二次，count2且首次其他字段保留；随后收藏空态选择器未限定类别，命中四个相同文案，Playwright strict mode 拒绝。属于 QA 脚本缺陷。已改为限定“小故事 · 0/3”的 details，前述九项检查全部保留；续验仅从停机 profile 复制并验证所有源文件和bundle哈希相等，不重复自然偶遇。

## integration-03：同候选2续验发现空相册事实边界

成功修正类别选择器后，实际打开相册显示“本地相册 · 0/20”和“还没有照片”，但 AlbumClient 的合法空相册响应仍令 state=null。脚本等待非null超时，暴露了产品无法区分“成功读取空相册”和“尚未读取”的事实：CollectionPanel 同样以state?.world??null投影未知，照片类别及目标不会变为已读0。

主实施确认并修复 AlbumClient 已验证读取标记、CollectionPanel 空Album派生。QA 改为等待实际空相册提示且albumError为空，再回到收藏严格断言照片·0。候选3续验需要明确白名单：仅 album-client.ts、CollectionPanel.tsx与client bundle变化，index/frame和其余所有源码必须相同，复制停机存档并记录差异。不篡改既有FAIL。

## performance-01：候选2软件采样 PASS

七居民自然生活，无active脚本活动；20.010秒可见21.889FPS，p95绘制提交1.20ms，128纹理，600样本。隐藏20.015秒，0绘制/0纹理且世界完全不变。parent CDP任务用量63.65%单核、隐藏0.045%；这不是完整进程CPU，也不是GPU硬件预算。此轮已停止后才做后续工作。

## 候选3后续

integration-04由02存档继续，严格白名单核对两文件/client变化，8类别、空相册0、7在场仅2共同回忆、3目标、精确冷恢复、4尺寸双主题均PASS。相册在冷启动后未读时重新显示未知，矩阵底部“尚未读取”为有意区分读取状态，不是修复回退。

lifecycle-01使用新隔离初始profile，50次关开PASS；10–50每10次GC后612监听器/232节点/2documents，关闭后575/134/1。decor-01由04停机profile同源同bundle复制，仅展开和自然移动，两个新物件全景无遮挡，已人工查看。

等待主进程全测与life候选3官方升级冷恢复全部停止后，才执行最后performance-02；不把并发负载下的结果算作最终性能。

performance-02实际在主线程重任务结束、life两实例全树停止通知后启动，结束再放行life后续fresh安装/复制测试存档恢复。可见20.003秒22.297FPS、p95提交1.20ms、128纹理/600样本；隐藏20.013秒0绘制、0纹理、世界不变。七居民位置端点全部改变。PASS且进程已退出；0.8浏览器证据至此冻结，不启动更多浏览器。
