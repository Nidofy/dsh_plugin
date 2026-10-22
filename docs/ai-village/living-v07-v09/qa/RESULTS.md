# 0.7.0-preview.1 独立浏览器与恢复 QA

2026-10-23（Asia/Shanghai）。新玩法、真实组件交互、软件性能与恢复检查已按以下证据完成。**这是隔离官方 Host/Connection 夹具的验收，不是日常 Desktop、硬件 GPU 或人工美术签收。** 未访问日常 DSH_HOME、未发送聊天、未调用模型、未修改入口批准状态。

## 被测身份

起始/测试 HEAD `963a501947b74498d0924a1c6892aecd3ef116bc`，分支 `codex/feature-ai-village-entrance`。测试时生产变更尚未提交；不能单用该 HEAD 标识最终代码，各运行的 `build.json` 保存源文件 SHA 与最终 bundle SHA。

版本 `0.7.0-preview.1`；world schema 7 / scene 3 / rules 4 / content 4 / preferences 3 / frame protocol 5。新增 play-find 协议与坐标/token 校验不改变入口首帧门禁。

| 正式 bundle | SHA-256 |
| --- | --- |
| `index.js` | `fe87c7f3b380018cc1c17da913794917ada7bc82c0d475fc214aa66a9105ef0b` |
| `client.js` | `27e28065911c8bd4eee03c2ffe08143e07cbac871b9ec82324f02bd40dbf1879` |
| `frame.js` | `06192d1f9d8cfcf62134580df1c619978f27433babcb7ee12ed3baf15d875e1e` |

integration-02、integration-03、matrix-04 的三个正式 bundle、83 个生产源码 SHA 完全相同；续跑脚本实际断言相同后才打开原专用 profile。recovery-01 的 client/frame SHA 也相同。最终磁盘包 `dist/nidofy-dsh-ai-village-0.7.0-preview.1.tgz` 为 32,154,137 bytes，SHA-256 `c58e61c2d7aa8a2854be0dc0158ce0521d88bff3f2bc09e2cc2ff31275b73445`。打包/离线安装由主代理执行，独立 QA 本文件不冒称重复执行。

## 实际运行与两次失败

| 运行 | 命令与结果 | 判定 |
| --- | --- | --- |
| integration-01 | `node scripts/ai-village-living-qa.mjs integration-01`，exit 1 | 早期生产构建。最低四项玩法/冷读/软件性能已执行，但跨尺寸仍要求同一 iframe 的断言失败。且旧导航辅助只检查 aria-selected，关闭后同标签不重开，导致部分“矩阵”截图是关闭画面，不作为新 UI 证据。原失败全部保留。 |
| integration-02 | `node scripts/ai-village-living-qa.mjs integration-02 --extended`，exit 1 | 最终生产构建。三故事、三小游戏均完整完成；随后 Playwright `.check()` 要求受控 checkbox 当场切换，但实际处于 CAS `commit-pending`，因此 QA 过早失败。没有业务错误；不能把整个02写成PASS。 |
| integration-03 | `node scripts/ai-village-living-qa.mjs integration-03 --extended --resume=integration-02`，exit 0 | 先核验源码/bundle相同，重开已释放的02专用测试 profile，核验六条首次事实和摆放收藏。改为点击后等待既有 CAS 确认，完成第三居民加入、三人活动、90秒自然生活、七人性能、生命周期与矩阵。 |
| recovery-01 | 设置 `VILLAGE_QA_DIR` 为本目录 `recovery-01` 后运行原 `node scripts/ai-village-ui-v11-recovery.mjs`，exit 0 | 未改原断言，4项真实故障/所有权回归通过。 |
| matrix-04 | `node scripts/ai-village-living-qa.mjs matrix-04 --matrix-only --resume=integration-02`，exit 0 | 相同生产源码与bundle，专门补最终静止画面，不重跑已完成玩法。24张四尺寸双主题内容/滚动图，全图 surface/panel opacity=1。 |

03的 `matrix-lifecycle.json` 已确认跨尺寸时出现 `user + insufficient-space`，iframe 1 暂时移除后恢复为2；世界保持暂停。普通主题/导航保持同 iframe。修正的是 QA 对合法空间不足生命周期的错误假设，未删游戏断言、未改生产暂停规则。

03矩阵曾截在正常180/140ms淡入中段；04记录同一页面截图前 surface/panel opacity（例如0.828/0.659，居民0.287/0），等待有限动画完成后均为1。已直接查看04的340浅色、320深色底部，文字清楚、返回按钮及末尾三人活动可达。03中间帧保留但不作为最终阅读效果。

## 七项可玩内容的实际完成

| 内容 | 真实输入与断言 | 证据 |
| --- | --- | --- |
| 蓝鲸丢失的白米饭 | 两人实际走动、观察、四阶段分别由玩家确认；阶段中隐藏不推进；首次记忆count=1 | [02结果](integration-02/validation.json)、[第三阶段](integration-02/lost-rice-stage-2.png) |
| 安静的一页 | 先取消一次不产生记忆，之后完整三阶段，首次记忆count=1 | [02结果](integration-02/validation.json)、[完成图](integration-02/completed-quiet-page.png) |
| 风带来的便笺 | 三地点/阶段实际移动与玩家操作，首次记忆count=1 | [完成图](integration-02/completed-wind-notes.png) |
| 找找小鲸鱼 | 请求提示，关闭抽屉后按正式投影真实点击 iframe 场景目标；不是注入完成状态或仅点地点选项 | [场景](integration-02/find-whale-scene.png)、[完成图](integration-02/completed-find-whale.png) |
| 书桌归位 | 错放书至笔筒、重置、真实HTML拖放书至书格、点击式放笔/纸；完成后记忆count=1 | [完成图](integration-02/completed-tidy-desk.png)、[02操作录像](integration-02/video/page@de31f906c6c274d36a2662453cee0481.webm) |
| 茶点轮到你 | 实际选择米饭/热茶/水果，三个选择后确认完成，记忆count=1 | [水果阶段](integration-02/snack-fruit.png)、[完成图](integration-02/completed-snack-table.png) |
| 三个人的星空 | 三名实际在场居民，逐阶段真实到达、观察与玩家确认，首次三人记忆 | [03结果](integration-03/validation.json)、[完成图](integration-03/completed-stargazing.png) |

所有完成都使用正常模拟时钟；未改tick、未写测试存档、未触发隐藏命令。真实播放器输入通过生产 runtime/CAS。

《白米饭》解锁的团圆饭碗经布置页明确确认放在窗边，场景实际可见。前四条记忆及摆放结果在全新客户端 runtime 中逐字段精确恢复；之后03再次冷读验证六条已确认首次事实。这不是原生 Desktop 全进程重启；主 Host 由隔离夹具提供，profile 只位于忽略的 `.build/ai-village-living-qa`。

## 自主生活与软件性能

90.514秒七人自然观察，记录19份处于社交期间的样本，**实际只观察到一次 Grok/Kimi 的 chat**，tick12600–12900。未强制角色位置、未伪造社交、未加速时钟。[原始样本](integration-03/autonomous-life.json)、[实际画面](integration-03/autonomous-social-chat-12600.png)、[连续录像](integration-03/video/page@0af4589efa3e96bf810b6f03327aa120.webm)。这次样本不证明所有6类自主社交都在真实浏览器发生，也不把静态图当完整动作人工签收；其余动作的逻辑/姿态单测由主代理单独列出。

| 最终样本 | 时间 | FPS | p95 JS提交 | 纹理 | 父目标CPU（单核） |
| --- | ---: | ---: | ---: | ---: | ---: |
| 单蓝鲸（02） | 20.000s | 22.15 | 0.50ms | 32 | 39.01% |
| 七人（03） | 20.008s | 22.74 | 0.70ms | 128 | 47.75% |
| 隐藏七人（03） | 20.013s | 0 | 无绘制 | 0 | 0.2322% |

原有20–35FPS、最多600帧采样和32/128纹理断言保留并通过。隐藏后iframe移除、世界逐字段不变。恢复侧栏/切换示例会话不改变暂停世界，主聊天未发送草稿保留。软件后端为 Chromium headless/SwiftShader；JS提交不是GPU完成时间，CDP父目标CPU/heap不是全进程/显存，运行机器并不独占。这是本版短时绝对样本，不能推导硬件回归比例。资源解码峰值未重新实测。

## 最终界面与恢复证据

最终静止视觉索引在 [matrix-04/validation.json](matrix-04/validation.json)：320×360、340×720、580×720、1080×760，浅/深主题，每组含新玩法顶部、末尾滚动位置、居民个性/活动页。逐图验证卡片尺寸、实际打开PlayPanel、文字/surface opacity=1；目录滚到最后的三人活动，返回恢复摘要。未把关闭画面算作内容通过。

代表图：[340浅色新内容](matrix-04/wishes-340x720-light.png)、[320深色末尾与返回](matrix-04/wishes-bottom-320x360-dark.png)、[1080居民页](matrix-04/residents-1080x760-light.png)。[矩阵录像](matrix-04/video/page@132dc983a695d33db2c459819b3e64ce.webm)记录实际滚动/返回。

[recovery-01/recovery-validation.json](recovery-01/recovery-validation.json)的4项原断言通过：

- 同transport心跳fetch故障，经租约/状态只读核对恢复，保留布置草稿、undo、用户暂停及同iframe。
- 隐藏取消自动恢复读取，回来核对后保留草稿。
- 服务端保存成功但ACK丢失，三次有界只读核对；保存POST仅一次，明确重连确认后仍保留草稿。
- 第二个实际鉴权runtime拒绝接管已有owner。

录像：[真实恢复](interaction/ui-v11-recovery.webm)。原脚本入口、断言和容差未改变；只是将证据写到新目录，未覆盖UI-v1.1历史证据。

## 未测与审批边界

真实GPU、物理Windows DPI/多屏/IME、正常原生Desktop与实际模型任务并行、设备休眠/低内存、显存/纹理解码峰值、长时泄漏归因、全部自主社交真实动作及双语新玩法全流程未覆盖。UI静止矩阵本轮为中文；文案双语完整性另由内容测试覆盖，不能当英文UI实际游玩。新预览包的原生Desktop完整进程安装/冷恢复未在本独立QA运行。

入口保持ART_REVIEW，门庭生产批准和人类美术观感仍未签收。一小时真实运行继续DEFERRED。新增正式家具/第二场景需要合格美术及后续资源门禁，本结果不声称0.8/0.9完整交付。

每轮浏览器/context/Host均在finally关闭；上述5次命令均已退出，不保留测试后台服务。没有提交源码、推送或发布，由主代理统一检查与提交。
