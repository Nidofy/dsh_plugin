# 游戏桌预览 QA 运行记录

所有运行均为独立官方鉴权夹具、真实生产组件、真实Canvas鼠标输入、新临时profile。未使用日常DSH_HOME、未注入完成状态、未发送模型请求。每轮目录保留失败、视频、构建哈希；不能把失败轮写成整体通过。

| 运行 | 当时结果 | 原因与处理 |
| --- | --- | --- |
| integration-01 | FAIL：第一次Canvas点击未落子 | 两位居民已到原餐桌席位并ready。QA关闭抽屉后立即点击，未等退场和frame视图更新；本轮没有记录elementFromPoint，不能进一步断言具体是哪层遮挡。02增加240ms等待，同一坐标真实落子成功，命中iframe；定位为QA点击时序问题，未证明生产协议故障。 |
| integration-02 | FAIL：重复格额外保存计数 | 首回合Canvas玩家0与居民4同一次POST通过。非法重复格不改board/choices，但断言窗口跨tick600周期checkpoint，保存数9与预期8不同。QA增加脱敏保存摘要，避开checkpoint窗口并等待INVALID_TABLE_MOVE。 |
| integration-03 | FAIL：暂停后整份世界严格相等 | 合法落子同一次保存、ready阶段非法重复格不保存均通过。暂停时点击棋格也命中居民，合法的选择居民把actor/companions顺序交换；ticks、人物按id状态、棋局未变。QA改为比较按id归一的模拟状态，同时保留居民选择功能。此轮复制旧候选，在收到重建通知前已开始；不能作为新预约保护候选的最终证明。 |
| integration-04 | FAIL：居民浮层期间寻找底部tab | 新构建包含非参与者eat席位预约保护。正常启用桌面、Canvas合法回合、重复格拒绝通过；暂停点击打开正常居民浮层，QA未关闭浮层便寻找隐藏的“心愿”tab而超时。05补正常关闭面板再导航，未改业务状态。 |
| integration-05 | FAIL：只读恢复计数少算立即核对 | 强制确认source/bundle哈希一致后，将04停机专用profile复制到05的独立.build目录；认证数据不进入证据目录。起点是04留下的一次未完成棋局。暂停/取消、替代锚点、终局确认与照片冷恢复通过。未知ACK只有一笔保存、世界冻结通过，但QA把三次延迟恢复当成总读取上限，漏算SaveTransaction的一次立即核对，故断言失败。 |
| integration-06 | PASS，复制05停机测试profile续跑 | 同hash复制05专用profile，先正常取消上一轮服务端已保存的未完成第三局，再重新经UI开始一局专测ACK丢失。真实核对1即时+3延迟=4次读取；再等待1.5秒没有更多读取或写入，明确重连增加第5次读取，只有一份玩家/居民双步。随后24图矩阵、50次启停全部通过。 |
| perf-01 | PASS，全新profile | 正常UI启用棋盘和七人，可见/隐藏各20秒；门槛不降，结果见RESULTS。与其他浏览器、Desktop启动、重构建串行。 |
| surface-01 | FAIL：QA相册初始null读取 | 最终de862de新包。真实茶会预约/交谈隐藏棋盘和PNG导出已成功；新加照片计数代码直接访问尚未加载的album.world，抛TypeError。改为初始null按0计数，不修改产品。 |
| surface-02 | PASS，全新profile | 最终de862de新包。正常热茶邀请，预约/交谈期间棋盘隐藏，茶杯照片正常，茶会自然完成后棋盘复显；随后真实Canvas0/4双步与棋盘照片/相册保存成功。 |
| perf-02 | PASS，全新profile | 最终版本7 rendered residents + active table game可见/隐藏各20秒采样。life确认专用Desktop进程树完全退出后才启动；棋局期间其余5人普通日程冻结，不能称全员自主活动。 |
| perf-03 | PASS，复制perf-02停机测试profile | 同89source/3bundle哈希，正常取消棋局，七人自然生活/hidden各20秒。原生Desktop冷恢复流程完成并关闭全部专用进程后才开始；所有七人位置均变化，visible22.4835FPS/128纹理，hidden0绘制且世界冻结。 |

最终状态以后续 `RESULTS.md` 和对应 `validation.json` 为准。软件后端性能、原生硬件性能与美术批准是独立门禁。
