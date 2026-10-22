# 最终构建与证据核验

HEAD e85ccc704f07edada1b59a574354fad859e44d79，dirty=true；版本0.6.3。用户原有两份未跟踪文档哈希未变。没有提交、推送、发布或安装日常profile。

离线包：dist/nidofy-dsh-ai-village-0.6.3.tgz，29349498 bytes，267 files。

SHA256：fa73f490530d195f45e0e12ddc5abaab3ede7e90743d2e7afa56e50ec0efa1ec

client.js：3d84a6f1ae3d161d20d95e9ddbdb0567dffe97f77632e400480d9d229cc1f8a5

frame.js：79c599d642052caab2a71af4fe8f80051c0be8449b796521354e3859df4c51d5

fixture.js：995507e70badd9b2adbc6ce66917d4a14ebaa6853fd3567c209d058e0894b9d9

132张逐图元数据截图；另附最终生命周期/内容/邻里回归图。所有主要截图client/frame/fixture哈希与本次构建相符，解包后的client/frame/index与正式lib逐字节相同。三个窗口的720×960原始PNG字节相等，详情见package-manifest.json。

软件性能结果：**PASS**。同机0.6.2/0.6.3、同Chromium SwiftShader，三轮每场景10秒。保留原CPU≤15%相对增幅和p95旧值+max(20%,1ms)门槛。

| 场景 | CDP CPU % 旧→新 | Pixi提交p95 ms 旧→新 | 门槛 |
|---|---|---|---|
| single | 38.5508 → 38.1944 | 0.50 → 0.50 | PASS |
| seven | 44.0744 → 43.0490 | 0.70 → 0.70 | PASS |
| activity | 45.5245 → 44.7136 | 0.90 → 0.90 | PASS |
| expanded | 91.6432 → 97.1561 | 0.90 → 0.90 | PASS |
| menu | 45.0222 → 43.4181 | 0.70 → 0.70 | PASS |
| hidden | 0.0614 → 0.0623 | 0.00 → 0.00 | PASS |

这是软件后端的调度/提交及CDP指标，不能推出硬件GPU合成或玻璃成本；后者NOT RUN。初版样本performance-initial.json保留，不作为最终包成绩。隐藏长样本如另行执行，见performance-hidden-followup.json，原失败不覆盖。

源码清单/受控diff → 正式lib → tgz解包相等 → 每图metadata中的client/frame/fixture哈希。source-delta.tgz叠加e85ccc7基线，包含普通git diff未覆盖的新增文件。source-manifest.json记录来源；SHA256SUMS.txt与delivery-manifest.json记录三个交付包。
