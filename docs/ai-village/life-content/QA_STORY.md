# 书屋剧情真实交互与视觉核对

最终源码 `7e77aabef36033c2b37486f02102982065d76a76`、包SHA256 `2a44566285875f40dbda18371b9384e634c43a821f9e65ac5556fc401caa9d11`。两个独立profile、DPR1/2各跑完整故事；[包比对](story-package-match.json)确认每轮108个src文件hash和index/client/frame三个实际bundle与[最终包身份](package-identity.json)一致。浏览器是Windows本地headless Chromium/SwiftShader，本节不代表原生GPU或硬件DPI。

| 标签 | 结果 | 图像 | 范围 |
| --- | --- | ---: | --- |
| [final-dpr1](story-qa/final-dpr1/validation.json) | PASS，10组检查 | 41 PNG + video | DPR1 |
| [final-dpr2](story-qa/final-dpr2/validation.json) | PASS，10组检查 | 41 PNG + video | DPR2 |

两轮均通过真实UI入住Seedance、旅行书屋、邀请共读；使用真实时钟等待脚点抵达与90tick观察后，依次选择主题/写句子/收书签。在第二段暂停并完整dispose/reload，世界原样冷恢复后继续。没有写入世界、注入时钟、跳过路线或直接设置完成事实。

完成后真实点击toast和消息行，要求唯一带标题手账卡聚焦、参与者/首次说明存在，且已读状态持久化。书签从书屋带回庭院，回忆保持同一eventId与count=1；最终暂停冷重启整个world深比较一致。

每轮实测card大小320×360、340×720、580×720；各自浅色/深色、深色时减少动态。实际切换居民/心愿/布置/书屋、滚动到“再读一次”按钮，四导航仍可用；实际导出六张720×960 PNG并验证照片模式退出不改暂停世界。额外切英语检查Wishes。无页面异常、外部请求、模型调用。

目视核对代表图：DPR1三尺寸心愿/居民、浅深主题、英文、实际照片，以及DPR2小窗操作、桌边剧情和通知手账。文字没有越出面板，窄卡通过原滚动容器到达后续操作，面板不覆盖底部四入口；DPR1/2截图均在450ms动画稳定后取证。实际双人阅读处存在正常精灵遮挡，脚点间距与路线碰撞由完整自动检查和七人在场专项验证；未把原场景开发样板当作正式美术签收。

- [DPR1最小卡的故事操作](story-qa/final-dpr1/320x360-light-bookhouse-action.png)
- [DPR1最小卡的居民](story-qa/final-dpr1/320x360-dark-residents.png)
- [DPR1窄长卡](story-qa/final-dpr1/340x720-light-bookhouse.png)
- [DPR1宽卡深色](story-qa/final-dpr1/580x720-dark-bookhouse.png)
- [DPR1英文](story-qa/final-dpr1/english-wishes.png)
- [DPR2阅读桌与台词](story-qa/final-dpr2/stage-1-ready.png)
- [DPR2通知聚焦唯一手账](story-qa/final-dpr2/first-memory-toast-journal.png)

旧integration-01 FAIL、integration-02自动PASS仍保留。01失败来自QA未重新展开浮卡而触发宿主窄宽保护；02部分截图处于过渡帧，故另取final图，不覆盖旧记录。没有因此更改生产尺寸限制、布局预算或性能门槛。原生混合七人、真实GPU/DPI及持续运行另见[原生记录](QA_STABILITY.md)。
