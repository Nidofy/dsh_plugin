# M5 游戏桌开发预览：浏览器 QA 结果

本文区分**候选B完整浏览器范围**与**最终de862de渲染器补验**。候选B后的只读审计发现旧茶会/吃饭道具与game桌面棋盘同时显示的视觉冲突，已修复renderer；最终包的surface-02、perf-02及七人自然生活perf-03均已通过。候选B证据原样保留，不把旧矩阵/50启停写成新bundle重跑。**这不是0.8正式美术验收或0.9全路线完成**。新棋盘仍是现有批准餐桌上的开发预览。

执行版本为 `0.7.0-preview.2`，world8 / rules4 / content5 / frame6。使用现有 Chromium headless / SwiftShader、官方 Host/Connection 鉴权夹具、真实 React 与生产 frame/lib；没有模型请求、网络依赖下载、日常DSH_HOME访问或世界数据注入。每次证据目录拒绝覆盖；临时profile与鉴权信息只在 `.build/ai-village-table-qa` 内，不纳入本报告目录。

## 最终de862de补验

生产提交 `de862de4dfb2c8621715ed8c3ff6682fcbfc6117`。对比候选B，89份source中仅 `client/TableGamePanel.tsx`、`core/table-geometry.ts`、`frame/scene.ts`、`frame/table-art.ts` 改变，Host入口bundle相同；源码和bundle一致性记录见 [FINAL_RELEASE_HASH_CHECK.json](FINAL_RELEASE_HASH_CHECK.json)。

| 最终bundle | SHA-256 |
| --- | --- |
| index.js | `cc5988c6a5a09fb258dca8493e2d444c9a1a63358685334624c9a8dd5051febb` |
| client.js | `86ac57431f4ec891b975458cc7901fb70a8114bf24197c71f52d3e14fa436b41` |
| frame.js | `9c498d59adb0f56c3a8fbbd39a565bebb4fba3a8ef0668e0a6390f1bb834d82f` |

[surface-02/validation.json](surface-02/validation.json) PASS：全新profile正常启用game→邀请热茶→两人真实走到餐桌→talking。预约与交谈期间metrics.tableGame=null；真实茶杯照片无棋盘。茶会自然完成后棋盘复显、tableMode仍game；随后正常开始棋局，实际Canvas格0落子得到玩家0/居民4，再拍照并保存第二张相册照片。已经目视查看茶会与棋局两张照片。surface-01保留FAIL：新增QA照片计数直接读取未加载相册null，修成初始0后新目录重跑，并非产品异常。

| 最终实际照片 | 尺寸/大小 | SHA-256 |
| --- | --- | --- |
| [tea-without-board.png](surface-02/tea-without-board.png) | 720×960 / 1,320,031 bytes | `b208db13e86945b77012efffea9ccddd09a9efe91bbd399c38f1b8a98fa76ff8` |
| [table-after-tea.png](surface-02/table-after-tea.png) | 720×960 / 1,310,076 bytes | `47f9c7f4086d4fe4f6a5a06bffd674a43f90e5687b67048cd51459953464e5c7` |

[perf-02/performance.json](perf-02/performance.json) PASS，在专用Desktop进程树完整退出后采样：

| 最终场景 | 时长 | FPS | p50/p95 JS提交 | 纹理/样本 | 父页CPU占单核 |
| --- | ---: | ---: | --- | --- | ---: |
| **7 rendered residents + active table game** | 20.001s | 21.9989 | 0.6/0.7ms | 128/600 | 46.1401% |
| hidden | 20.011s | 0 | 无绘制 | 0/0 | 0.0770% |

重要场景区别：活动棋局期间其余5位居民普通日程冻结，不能把perf-02写成七人同时自主生活。hidden世界精确保留。

[perf-03/performance.json](perf-03/performance.json) PASS：原生Desktop独立验收完全停止进程树后，复制已停机perf-02专用profile，强制同source/bundle哈希，再经正常UI取消棋局，恢复七人自然生活。没有修改世界或tick，允许正常用餐期间棋盘暂收。

| 最终自然生活场景 | 时长 | FPS | p50/p95 JS提交 | 纹理/样本 | 父页CPU占单核 |
| --- | ---: | ---: | --- | --- | ---: |
| 七人自然生活，无active棋局 | 20.015s | 22.4835 | 0.6/0.8ms | 128/528 | 46.3267% |
| hidden | 20.014s | 0 | 无绘制 | 0/0 | 0.2159% |

可见期间ticks1281→1882，七位居民位置各自均有变化，采样末尾3人walk、4人idle；这些状态是采样端点，不声称所有人持续同时行走。隐藏后tick1882与整个世界精确不变。棋盘在可见采样首尾可见，未连续断言每一帧桌面可见，也不排除中途按用餐规则暂收。CPU/绘制指标仍受下文软件后端限制，不能换算为原生硬件达标。

最终补验没有重跑旧24图窗口矩阵/50次启停/所有结果分支。它们仍属于下述候选B对应哈希；源码差异与新增补验证据一并交接，不能声称每项都在最终bundle重新执行。

## 候选B来源与构建

候选B覆盖组合为 **integration-04 已通过部分 + integration-05 已通过部分 + integration-06 PASS + perf-01 PASS**。04/05整轮状态仍是FAIL，不能改写成PASS；01–03使用旧候选，只保留为调试历史，不用来证明预约保护候选。

05从已停机的04专用profile复制续跑；06从已停机的05专用profile复制，正常取消残留未完成棋局后重现ACK故障。每次复制前脚本强制校验全部source/bundle哈希相同。89份生产源码与三个bundle在04、05、06、perf-01以及候选B结束时工作树完全一致，历史检查见 [FINAL_HASH_CHECK.json](FINAL_HASH_CHECK.json)。它不代表后续最终de862de仍使用旧bundle；当前对应关系以FINAL_RELEASE_HASH_CHECK为准。

| bundle | SHA-256 |
| --- | --- |
| index.js | `cc5988c6a5a09fb258dca8493e2d444c9a1a63358685334624c9a8dd5051febb` |
| client.js | `78e010a5aadb878bfabf7d9f312cdfb2af913db73c1601a82ff4003d042510cd` |
| frame.js | `4e743209caea83359a3d011fdbff6702dd6d2ff1a0c49e484a53fa53797fd60c` |

## 实际通过项

| 项目 | 直接证据与范围 |
| --- | --- |
| 正常启用棋局桌面 | 04：布置→家具→棋局桌面先仅草稿；取消不改用途；确认后game。原eat座位/几何和纹理数不因启用而增加。 |
| 真正到桌、Canvas落子 | 04：两位居民位置严格等于原餐桌两个目标；ready后由真实投影鼠标点击格0，board得到玩家0/居民4，只有一笔POST。 |
| 非法重复 | 04：等待ready并避开300tick周期checkpoint，重复格0返回INVALID_TABLE_MOVE，board/choices/保存数不变。不是用观察阶段禁用替代非法格验证。 |
| 暂停与取消 | 05：hidden不推进；user暂停不能落子或推进模拟。暂停时选择居民仍合法，按id比较人物状态不变，关闭正常居民浮层后继续导航。取消不写首次回忆。 |
| 替代餐桌锚点 | 05：正常家具草稿→餐桌替代锚点→保存。棋盘rect由x189移到135，九格center均左移54，y不变、纹理不变；第二局实际到替代席位并用新投影落子。 |
| 终局与回忆 | 05：实际玩家选择0、1、3，居民回应4、2、6，居民斜线胜。终局stage1先observing，尚无回忆；等ready后明确点击“记下这一局”，只写一次首次回忆。没有实际跑玩家获胜或平局分支。 |
| 照片与冷恢复 | 05：棋局途中真实拍摄、PNG导出、保存相册；拍照保持世界和用户暂停状态。flush后dispose客户端再reload，新runtime精确恢复世界、桌面、回忆和相册。此处不是原生Desktop进程重启。 |
| 未知ACK | 06：服务端真实完成玩家+居民同一回合保存后丢响应，并屏蔽state读取。始终1 POST；立即核对1次、延迟核对3次，总4读；再等1.5秒不增加。明确重连再读1次后恢复恰好两子，没有重发写入或重复居民回应。 |
| 窗口矩阵 | 06：实测卡片340×720、580×720、1080×760、320×360，各浅/深主题，棋局上方/九格/下方控制共24图。真实滚动及返回quick成功。矩阵取用户暂停态，格子灰色禁用是该状态；实际输入在04/05另有证明。全部面板截图opacity=1，已等待有限动画结束。 |
| 50次启停 | 06：用户暂停、世界固定，真正关闭再打开50次；每次仅一个frame、纹理等于当前资源键数、世界精确保留。每10次GC后热态均documents2/nodes252/listeners612；最终关闭为1/136/575。不能据此宣称完整零泄漏或一小时通过。 |
| 外部请求/异常 | 06与perf-01 pageerror=[]、external=[]；真实消息草稿未发送。 |

## 照片、截图与录像

实际导出 [table-in-progress.png](integration-05/table-in-progress.png)：720×960，1,308,910 bytes，SHA-256 `e87230f630f73838ac05968280bb2099e7f905cb973402cb17eb6f582d8b0b31`。已经目视检查：两位居民在替代餐桌后，棋盘圆圈与叉号可见。

所有24张候选B窗口矩阵、流程截图、候选B录像与最终de862de补验录像链接见 [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md)。重点目视检查了340×720浅色棋盘和320×360深色棋盘；它们不是淡入中间帧。其余图片由实际尺寸、可见控件和opacity断言支撑，不能替代逐像素人工美术签核。

## 软件性能

独立perf-01全新profile，经正常UI启用棋盘和七人；在其他测试/构建完成后串行运行。原20–35 FPS、采样上界600、七人纹理128门槛未降低。见 [performance.json](perf-01/performance.json)。

| 场景 | 时长 | FPS | p50/p95 JS绘制提交 | textures | 样本数 | 父页面Task CPU占单核 |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| 七人棋盘可见 | 20.009s | 22.2395 | 0.6 / 0.8ms | 128 | 600 | 45.8938% |
| hidden | 20.001s | 0 | 无绘制 | 0 | 0 | 0.2125% |

hidden期间世界完全不变且iframe不存在。可见场景是game桌面正常显示与七人自主运行，并非七人一起下棋。p95是JavaScript提交时间，不是GPU完成时间；CDP父页面CPU/heap不等于整个浏览器/Electron进程，也不是同机同场景硬件对比。无法据此确认原生CPU、显存或硬件预算。

## 失败保留与未测边界

01：关闭抽屉后立即Canvas点击，缺少退场/frame视图更新等待；02：把普通周期checkpoint误算成重复落子写入；03：把合法选择居民导致actor/companions换序误判为暂停推进；04：居民浮层尚未关闭便查找隐藏底部tab；05：漏算一次立即state核对。均保留原FAIL、截图、录像、状态与堆栈，详见 [RUN_NOTES.md](RUN_NOTES.md)。这些修复仅修改QA脚本，没有通过改生产世界或放宽玩法规则来通过。

本浏览器专项未覆盖：原生Desktop一小时、真实Windows GPU/DPI/IME、多显示器、硬件预算对比、浏览器棋盘键盘方向键路径、玩家获胜/平局完整UI分支、新家具母版批准、全部旧七项玩法重跑。非参与者已预约eat席位的拒绝保护依主实施专项测试，本次没有另造浏览器世界复现。原生Desktop由另一独立验收报告负责，不能将本报告换写成原生通过。

所有本专项浏览器会话已退出（最终surface-02/perf-02/perf-03均exit0，finally关闭context/harness/browser；旧06/perf-01也已退出），没有继续写证据的运行任务。CPU窗口已释放；源代码和本QA文件由主实施统一提交。
