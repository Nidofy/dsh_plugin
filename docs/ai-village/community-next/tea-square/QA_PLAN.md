# 茶会广场独立验收计划

## 获批素材接入后的执行批次

用户已批准茶会四层和书屋候选。最终 0.13.0-preview.3 的实际双 DPR 通过结果、诊断失败历史、资源预算与限制见 [QA_PLAY.md](QA_PLAY.md)；以下保留执行计划，旧 gate 证据独立保留。

- 浏览器：`node scripts/ai-village-tea-square-qa.mjs <新label> <1或2> --mode=play --approved-scenes`。先经公开界面安排七人，再通过正式地图进入书屋与茶会。书屋覆盖选书、写字、窗座的实际行为与渲染截图，共读三次真实到齐、两张真实相机输出；茶会覆盖错排/重排、三人真实路线、取消、部分杯垫冷恢复、Host 已写但 ACK 丢失后的只读核对、不同三人重玩、普通挑茶与永久茶签。
- 资源：书屋两 atlas 合计 2,468,228 B / 6,586,368 B RGBA；茶会四层合计 2,281,183 B / 4,487,424 B RGBA。记录实际资源 SHA/PNG 尺寸与 frame 纹理库存。对首次书屋资源做等长坏字节、首次茶图做 503 故障，确认世界与修订未写，再经真实入口重试。最后额外十二次地图旅行，逐区域对比纹理数、source 数、Blob URL 和解码预算是否增长。
- 观测：路线相邻采样不超过 17/30 world unit/tick；脚点两两不少于 24。记录隐藏一秒时世界和 frame 的停滞、冷恢复耗时、软件渲染短样本；这些不能替代进程 CPU、硬件 FPS 或长时间内存 soak。
- 原生：`scripts/ai-village-tea-qa-desktop-launch.ps1 -RunTag <新tag>` 对应 `AI_VILLAGE_NATIVE_RUN_TAG=<同tag>`。固定官方 carrier、独立 DSH_HOME/user-data，检查 `AI_VILLAGE_EXPECTED_VERSION` 与 `AI_VILLAGE_EXPECTED_SHA`；安装、checkpoint、真实进程重启、restored 分开新 label。恢复后完成茶会和不同三人重玩，再真实前往书屋验证三种普通姿态与照片，返回茶区确认资源和永久事实。
- 原生此批次从全新 profile 开始，不能记作旧档升级测试；旧 world13 迁移另由已有核心/Host 证据支持。隐藏原生窗口的采样不能标为前台硬件 FPS。

0.12地图、world13、frame10闭环及其原生证据已单独冻结；本计划不重新运行旧版全流程，也不把旧证据记作第三地区验收。第三地区实际使用 world14 / region2 / frame11。

## 执行边界

- 只使用独立仓库、隔离鉴权Host和新临时profile；不读取或改写日常DSH_HOME。
- 浏览器仅真实点击、键盘、文件下载及只读inspect；禁止注入world、ticks、actor坐标或把production planned强行改available。
- `scripts/ai-village-tea-square-qa.mjs <label> <DPR> --mode=gate` 验证当前未开放节点不能旅行，不代表新区域可玩。
- `--mode=play` 必须同时通过真实生产目录开放、资源资格和UI前往按钮；未开放即明确NOT_RUN，不调用隐藏的旅行函数。
- 内部开发fixture只在主线程提供显式隔离入口和命名后接入，单列dev证据；不得冒充最终安装包通过地图进入。
- 失败label/profile/录像/截图保留。测试等待真实模拟时间，路径未到齐不能用更改stage/坐标绕过。

## 独立检查矩阵

| 范围 | 关键检查 | 实施层 |
| --- | --- | --- |
| 契约 | scene1 360×480，v2脚点/障碍/热点，七入口和三席互不重叠，所有阶段可达 | 核心几何测试＋只读复核 |
| 门禁 | planned UI可预览但不能前往；核心操作同样拒绝；湖畔/工坊继续关闭 | gate浏览器＋核心测试 |
| 入场 | 庭院→广场，一次CAS；最多7人同场；书屋到广场不允许跨非相邻路线 | 开放后真实地图 |
| 三人 | 显式选3个不同在场角色；真实走到三席，未到齐按钮不可推进；在途暂停/隐藏 | 开放后真实UI＋位置采样 |
| 杯垫 | seed派生正确顺序；图案和槽位有限；错排可见不发奖，重排清空并更新serial/token | 真实UI＋核心token测试 |
| 取消 | 任意在途阶段明确取消，active清空，首次memory/keepsake不改变 | 真实UI＋核心测试 |
| 收尾 | 完成杯垫后3人走到不同收尾脚点，未到齐不能“记住这个下午” | 真实UI＋位置采样 |
| 首次/重玩 | 首次保存三人、事件ID、tick/day和count=1；第二次只增count，不改首次来源，不重复纪念物 | 两次真实短故事 |
| 普通生活 | 挑茶先到茶点柜再去空桌位、有界停留后释放；与三人故事互斥且可取消 | 真实UI＋引擎测试 |
| 未知回执 | 对最终完成save执行真实Host写入后丢弃ACK并阻断state读取；不自动重放同operationId；恢复只读核对后仅一份奖励 | 隔离网络故障注入 |
| 旧档 | 只复制已记录身份的0.12独立QA profile（如`.build/ai-village-community/map-art-final-dpr1-01/profile`）；冻结源码目录本身没有profile；读旧world13后窄迁移为14；首次写入保留旧快照原字节 | SaveStore迁移测试＋独立profile冷启 |
| 恢复 | 杯垫中途保存/暂停，关闭owner并重开；种子/board/serial/路径/脚点与已确认状态一致 | 真实冷恢复 |
| 纪念物 | 三叶茶签仅由真实完成解锁；挂点message-tree/null走CAS，跨区手账同一事实 | 真实UI |
| 相机/相册 | 广场真实画面输出720×960PNG，照片/预览/退出不更改世界；纪念物位置与场景一致 | 真正捕获下载 |
| 七人 | 在3人故事和普通活动中逐对采样脚点≥24，另4人不被瞬移；有限等待/取消不会卡死 | 实际模拟＋核心边界 |
| 资源 | 正式分层、只加载活跃场景、地图6图仍独立；两区/三区循环不增iframe或监听器 | 资源专项＋真实浏览器 |

## 预定状态接口

核心代理计划提供 `world.teaSquare = {version:1, active, activity, memory, lastEventId, keepsake}`。active包含三阶段、seed、三槽board、serial和有限三人路径；操作token为 `id:stage:serial`，每次place/reset/continue都需校验。永久memory保留首次id/participants/completedTick/day；重玩只累加count。以最终类型字段为准，QA不得为了匹配草案修改产品。

运行入口计划为startTeaSquareStory、actTeaSquareStory(continue/place/reset/remember)、cancelTeaSquareStory、start/cancelTeaSquareActivity、placeTeaSquareKeepsake。浏览器不直接调用这些方法；通过主线程最终TeaSquarePanel触发。重复token/非法choice等应优先纯核心测试，避免虚构用户能正常发送的UI输入。

## 当前审查注意事项

- v2已修正茶点柜与左席、留言树与右席脚点及热区冲突。普通取茶、三人故事和纪念物挂点共享位置时仍需统一占用判断。
- 收尾若要求三人同时走到单一留言树点，会造成24单位间距冲突；必须有三个不同合法终点，按稳定角色顺序规划并验证全组目标。
- 旧region1没有tea-square returns键，必须先由旧codec验证再补键；历史worldId不改、非活动区不推进。
- 普通挑茶的“先柜后席”不能用单个家具intent伪装两阶段，否则冷恢复、取消和占用可能不一致；按新的有界activity状态验证。
- 未知ACK网络测试只对隔离Host生效；不得主动调用生产真实服务或重放world写入。

## 浏览器脚本准备情况

已根据真实 `TeaSquarePanel.tsx` 接入公开 UI 选择器：三位伙伴、阶段按钮、杯垫图案和槽位、可见顺序提示、普通选茶和茶签摆放。`--mode=play` 先验证正式地图按钮可用，再走七人入场、取消、完整首次故事、重玩、冷恢复、未知回执、选茶、地图往返和照片流程。`--mode=gate` 仅检查未开放与无写入。

脚本的只读位置采样逐对检查脚点距离≥24；ready必须已到实际target。未知ACK测试先由真实隔离Host提交，再丢响应并阻断state读取，记录operationId次数；恢复后通过真实重新入场按钮触发只读核对。不会直接向引擎提交token或修改世界。

脚本目前通过 `node --check scripts/ai-village-tea-square-qa.mjs`。**尚未运行任何第三地区可玩验收**，不得将脚本存在、语法通过或核心fixture结果写成浏览器通过。旧档迁移、伪造token、非法choice等列为核心及SaveStore证据，尚未在新浏览器脚本中复制旧profile执行；多主题、多语言、尺寸矩阵及长时间资源稳定性仍需开放后专项补充。生产开放前只运行明确gate或dev级验证。

只读审查已反馈两点：重玩应保留用户已收起的茶签，不能自动重新挂出；旧档测试若声称覆盖manual intent，必须实际构造旧手动路径，不能仅用初始空闲world13。修复及测试结论以核心代理最终记录为准。
