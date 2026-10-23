# 五位新居民生产接入与验收 · 2026-10-23

Seedance、GLM、MiniMax、Llama、Mistral 已接入生产资源、头像、双语居民目录、偏好、台词和独立微动作。十二位居民可选择，仍最多七位同时在场；满员时保留离场操作并禁用额外入住。入口继续使用已批准的原七人顺序填色构图。五位新角色复用各自的 16 个生产部件完成活动，不额外加载活动贴图。

本页只报告 B 角色接入与资源验收。共享存档迁移、书屋剧情、原生载体与性能结论见 [总验收记录](RESULTS.md)。

## 最终构建与包身份

实际浏览器运行目录为 [final-source-7e77aab](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/validation.json)。[build.json](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/build.json) 在运行前记录以下身份及逐文件哈希：

- HEAD：`7e77aabef36033c2b37486f02102982065d76a76`；产品源码提交 `dd85524`，之后为原画门禁记录提交。
- 分支：`codex/feature-ai-village-entrance`；版本 `0.10.0-preview.1`。
- 工作区并非 clean：README、架构文档有修改，另有未跟踪 QA 脚本、验收文档和既有资料；记录中没有未提交的产品源码修改。保留完整 dirty 原文，不把测试描述为 clean checkout。
- 记录 108 个源码文件、282 个资产文件及实际复制运行的 bundle 哈希。

最终包 [nidofy-dsh-ai-village-0.10.0-preview.1.tgz](../../../dist/nidofy-dsh-ai-village-0.10.0-preview.1.tgz) 为 47,026,400 bytes、381 个文件，SHA-256：

`2a44566285875f40dbda18371b9384e634c43a821f9e65ac5556fc401caa9d11`

| 实际运行 bundle | SHA-256 |
| --- | --- |
| index.js | `420321bd15ffb0b9d95f241c94858dfc0e0b7811fea18b6edc7ab50d03e09a42` |
| client.js | `e44ca7c568ec35d17090038f4f3c8a793eb91c61d31c85bce688487836fbd812` |
| frame.js | `b381f1d7e332c6f3429b18de772bc6b8fc7e85001ccccf04b65eebb0094e30e6` |

[严格包比对结果](../../../packages/ai-village/art/QA/roster-production/package-final-source-7e77aab/validation.json) 全部通过：包内 282 个资产与本轮浏览器 build 快照一致，236 个运行资源的大小和 SHA 与 definitions 一致，三个运行 bundle 和版本与实际浏览器运行一致。逐一核验五份生产 manifest 的批准标记、每人 16 个部件和 3 份定义；80 张生产 PNG 与既有原画交付逐字节一致。该脚本只读 tar 内容，不安装包；安装验证归总验收记录。

## 实际执行结果

角色专属七文件 20 测试通过，覆盖五角色身份、内容闭包、双语 UI、七人容量、原七人入口、资产选择、偏好、相册与微动作。早期一次检查因 dialogue 新 ID 文案未插入失败，修复后重跑通过；没有放宽断言。共享最终源码的全量 57 文件 287 测试通过由主代理执行并记录，不能把 B 专项结果等同于全仓测试。

最终浏览器使用隔离临时 profile、真实生产 Host 插件、官方 Connection 鉴权、React 客户端与 iframe 渲染，Chromium/SwiftShader。运行成功退出，finally 关闭本轮浏览器与 Host；未操作用户实际 DSH_HOME。

- 22 项自动检查通过：每位新居民实际入住、选中、独住，以及真实拖动到工作桌、饭桌、坐垫，共 20 项；另含十二名册/七人限制与混合七人跨区/冷恢复两项。
- 产出 27 张实际截图；浏览器错误 0，外部网络请求 0。
- 混合七人为 DeepSeek（内部 ID bluewhale）、Claude 与全部五位新居民。庭院转书屋后仍七人，暂停冷恢复世界精确相等。
- 单人资源释放有效，未保留无关居民纹理。所有七人预算保持原限额，未按十二名册扩容。

| 实际场景 | 纹理数 | decodedRGBABytes |
| --- | ---: | ---: |
| Seedance 单人庭院 | 23 | 13,919,920 |
| GLM 单人庭院 | 23 | 20,388,096 |
| MiniMax 单人庭院 | 23 | 14,786,780 |
| Llama 单人庭院 | 23 | 14,424,344 |
| Mistral 单人庭院 | 23 | 20,280,992 |
| 五新＋两旧庭院 | 128 | 74,079,736 |
| 五新＋两旧书屋及冷恢复 | 121 | 63,943,536 |

这里的 RGBA 为渲染器资源统计，不能代替全进程内存、显存或帧率。十二人完整目录闭包仅用于静态清单校验，不是允许十二人同场。

## 视觉复核与历史证据

恢复任务后先逐张查看原 [activities-run 的 27 张截图](../../../packages/ai-village/art/QA/roster-production/activities-run/validation.json)，并独立保存 [旧轮视觉记录](../../../packages/ai-village/art/QA/roster-production/visual-review-activities-run/review.json)。最终构建再次生成 27 张截图，亦逐张目视复核；[最终视觉记录](../../../packages/ai-village/art/QA/roster-production/visual-review-final-source-7e77aab/review.json) 包含每张图的哈希和观察结论。

五角色站立比例与脚点一致，工作双手与书本相接，饭桌下半身遮挡正常，休息时坐姿完整落在坐垫上。GLM/Mistral 饭桌下缘少量尾尖是家具遮挡后可见的角色尾部，未见额外源图碎片。混合场景未见缺图、黑底透明框、重复肢体或明显漂浮；双语名册可滚动读到全部新角色，容量提示可读。实际截图未发现需要修改原画或 rig 的缺陷，因此恢复阶段没有改产品资源或骨架。

示例：[混合庭院](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/mixed-seven-courtyard.png)、[混合书屋](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/mixed-seven-bookhouse.png)、[暂停冷恢复](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/mixed-seven-cold-restore.png)、[英文容量提示](../../../packages/ai-village/art/QA/roster-production/final-source-7e77aab/twelve-resident-admissions-en.png)。

原 first-run/activities-run、暂停状态和所有原图均保留。暂停时 activities-run 已自然 exit0，但当时未完成目视与最终包核对；其 `pause-status.json` 仍作为历史暂停事实保留。旧两轮只有 bundle SHA，缺少当时源码/dirty 快照，不补造 build.json，也不据旧图声称当前包通过。恢复阶段的 package-resume-candidate 仅比对工作区资产；只有带 `--qa` 的 package-final-source-7e77aab 严格比对才建立最终截图与包的身份关联。

## 复现与边界

从独立插件仓库执行，重跑必须使用新的 label，脚本拒绝覆盖已有证据：

```powershell
node scripts/ai-village-roster-production-check.mjs --label=<new-label> --activities
node scripts/ai-village-roster-package-check.mjs --label=<new-label> --archive=dist/nidofy-dsh-ai-village-0.10.0-preview.1.tgz --qa=packages/ai-village/art/QA/roster-production/<new-label>
```

本轮截图证明所捕获姿态与界面；不能等同于连续动画所有帧、用户最终审美批准、原生 Desktop 安装、硬件 GPU 性能或长时稳定性。书屋背景仍为明确标记的开发样板；独立正式美术候选继续受原有门禁约束，没有进入运行资源。
