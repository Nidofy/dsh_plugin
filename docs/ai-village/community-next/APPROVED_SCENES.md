# 获批书屋与茶会场景：验证矩阵

记录日期：2026-10-25。当前状态：**美术已获批准并接入0.13.0-preview.3；410测试、双DPR真实浏览器、最终包身份、离线安装与独立软件性能已通过**。原生可见窗口补测结果和历史超时独立记录于[原生报告](tea-square/native/APPROVED_PRE3_RESULTS.md)。本文件保留实现阶段记录，最终结果以本页验收矩阵及[CURRENT_STAGE](CURRENT_STAGE.md)为准。

## 用户批准及范围

当前对话用户明确回复：

- 茶会：“批准茶会场景候选，继续集成”。范围为背景、茶桌、茶柜、留言树四图及已审阅的等比运行派生，不把美术批准解释为玩法、迁移或包验证通过。批准及源图、派生图 SHA 记录于 [茶会正式 manifest](../../../packages/ai-village/assets/tea-square/manifest.json)。
- 书屋：“批准书屋候选，验证通过后启用”。该批准问题明确覆盖整间书屋及十二居民各自身份的握书、坐姿候选，包括部分角色自然悬腿、Mistral 盘腿遮脚；默认启用须先完成运行和性能验证。方向动画不在该次批准范围。正式资源见 [书屋 manifest](../../../packages/ai-village/assets/bookhouse/manifest.json)，候选身份和接触处理见 [全十二角色精修记录](art/BOOKHOUSE_ALL12_REFINEMENT.md)。

两者均为独立批准，不改变地图此前的批准范围。生产资源不引用 candidates 路径。书屋窗口脚点、家具、碰撞和路径保持冻结值；茶会也未从图像像素推导新碰撞。

## 资源与预算

下表为正式 PNG manifest 中的文件尺寸合计，不是进程峰值内存或显存测量。

| 场景 | 新增图像源 | 压缩字节 | 基础 RGBA 字节 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 书屋 | 2 | 2,468,228 | 6,586,368 | 场景 atlas 1024×968；十二居民握书及两套坐姿 atlas 1024×640。独立层使用共享源的 Texture frame views，其余坐姿复用各角色原 rest 纹理。 |
| 茶会 | 4 | 2,281,183 | 4,487,424 | 背景 720×960；茶桌 672×280；茶柜 288×352；留言树 280×504。家具保留透明背景及独立前景深度。 |

茶会契约目标为新增场景纹理不超过 12 张、RGBA 不超过 12 MiB、压缩文件不超过 5 MiB，当前四图满足静态预算。书屋独立图集夹具已证明十场景层共享一源、握书/专用座姿部件共享另一源；这一结果不替代生产反复旅行时的实际资源释放检查。

独立只读穷举全部 12 选 7 居民集合，调用生产 `residentAssets` 得到的最大资源键数量：小院 128、书屋 123、茶会 125；均低于 iframe 的 160 图限制。对应最大压缩资源合计分别为 31,752,384、30,160,448、29,973,403 字节。该统计包含角色资源，地图六图仍由独立展示层加载，不计入 iframe；Texture views 不产生额外 TextureSource。双DPR实际七人往返后的纹理/source/Blob库存恒定为小院128、书屋123、茶区125；解码量及软件进程内存趋势见[性能报告](performance/RESULTS.md)。这些结果不表示已测得驱动总显存或长期硬件性能。

## 实现阶段记录（最终实际验证见后文）

| 范围 | 当前结论 | 证据与边界 |
| --- | --- | --- |
| 茶会正式旅行 | 自动化通过 | 目录为 available / approved / scene1；只允许小院直达，书屋需经小院。七居民安全入场、原地返回、暂停偏好和两个非活动区域脚点经冷解码保持。湖畔/工坊继续 planned。 |
| 旧档与单存档 | 自动化通过 | world14 / content10 / region2 / frame11；旧 world13 先经过冻结 codec，再补茶会字段。实际旧 manualMove 和书屋返回脚点迁移、42 次后续保存仍保留旧快照原字节。没有第二个 owner、时钟或世界存档。 |
| 三人完整玩法 | 核心自动化通过 | 三人真实路径到齐、停留后才允许阶段动作；seed、三槽 board、serial/token 有界；错排/重排、过期 token、取消不奖、最终明确确认、首次事实及不同成员重玩均有回归。 |
| 反复换人收尾 | 核心自动化通过 | 原先连续第 4 组会因旧成员占位导致 PATH_BLOCKED，已修。七人全部 35 种三人组合依次完成；每 tick 检查实际步长、无重叠及旁观者不动；阶段冷解码，完成确认前不增加奖励。 |
| 普通挑茶 | 核心自动化通过 | 独立 counter→choosing→seat→waiting 有界状态；到位后真实 sit，与对应 tea-table seat/use intent 一致。终止清理 intent；旧 world14 的 idle waiting 仍可原样解码。动画 phase 随实际移动/坐等推进，暂停时脚点和 phase 一起冻结。 |
| 保存故障与首帧 | runtime 自动化通过 | 茶旅行 UNKNOWN ACK 不重放写入；只读核对后仍经过 retryEntrance / 新首帧门禁。三人最终完成丢 ACK 只记一份事实。资源加载失败前不提交旅行，旧世界保留。此处为隔离 mock 事务回归，真实网络故障注入另列待执行。 |
| 手账、收藏及纪念 | 核心自动化通过 | 唯一 tea memory 派生手账、收藏和实际三对关系；重玩仅累计次数，不覆盖首次参与者/日期，也不自动重新挂出已收起茶签。 |
| 书屋可选分层基础 | 自动化通过，正式运行另验 | 无 options 保留开发样板；整套缺层/非法 UV/深度拒绝，不能半套混画；Texture views 仅释放自有对象。最新分层基础与正式 contact / story 四文件共 53 项通过，由书屋实现代理实际运行并回报。 |
| 书屋正式 contact | 已接入，自动化通过 | 十二居民自己的握书/坐姿、普通热点及共读阶段已接到生产场景；[contact 回归](../../../packages/ai-village/tests/bookhouse-contact.spec.ts) 16 项通过：十二身份多 phase、普通热点、reading / puzzle 各自真实三阶段、双 writer 道具及释放。真实浏览器/原生仍待验证。 |
| 独立书屋渲染夹具 | 已完成，资格有限 | 原素材 v06 与图集 v07 各 34 状态、408 角色站位、48 张登记截图；软件 WebGL / DPR1，投影脚点/髋接触与纹理共享源有实际断言。不是生产世界动作切换、原生包或硬件 FPS 证据。 |
| 独立代码审查 | 未发现新增阻断项；两项茶问题已修 | 审查过资源选择/帧代际、旅行失败与 UNKNOWN ACK、坐下终止、书屋 contact 脚点和站位判定。书屋普通姿态必须实际 use 锚点；故事必须实际 target 且已到齐；不支持的侧方位置不强行坐下。每帧先恢复四肢可见性再应用 contact 覆盖。此结论不等于完整视觉签收或全部故障已穷尽。 |

已实际执行的相关命令记录：

- 茶开放及迁移、runtime、地图和茶面板合计 7 个测试文件 / 64 项通过；该轮完成后再加入普通 phase 和 35 组合修复。
- 两项补修后 `tea-square.spec.ts` 最新 11 项全部通过，包含上述新回归。
- 书屋代理实际运行 `node scripts/test.mjs`，四文件 `bookhouse-contact.spec.ts`、`bookhouse-raster-art.spec.ts`、`bookhouse-art.spec.ts`、`bookhouse-story.spec.ts` 合计 53 项通过；`node scripts/typecheck.mjs` 全仓类型检查通过。优化 atlas 审计脚本通过，正式复制资源与批准候选 hash 一致。
- 使用与官方 Host/Client 相同编译选项的只读严格类型检查通过；未以该命令重新生成资源或打包。
- 正式资源六项回归通过由主线程报告；最终统一全量测试、构建和包验证由主线程另行记录，不能将以上分批结果相加冒充某次全量结果。

主要源码/回归：[茶会核心](../../../packages/ai-village/src/core/tea-square-engine.ts)、[状态校验](../../../packages/ai-village/src/core/tea-square-state.ts)、[茶会测试](../../../packages/ai-village/tests/tea-square.spec.ts)、[runtime 测试](../../../packages/ai-village/tests/runtime.client.spec.ts)、[契约 v3](TEA_SQUARE_CONTRACT.md)。

### 首轮真实运行反馈后的导航补修（pre3双DPR已复验）

真实浏览器 `approved-play-dpr1-01` 暴露书屋显式选书在遇到动态居民后被历史 `world.step` 静默放弃：确认 RNG `2387716937`、七人入场、tick 3 发起，旧逻辑在 tick 254 / `(181.255522,365.455710)` 清空意图。当前书屋 wrapper 保留席位及原绝对 `intent.expires`，每 30 tick 最多一次重规划，同一世界时钟下继续所有旁观者；冻结历史 `world.step` 不改。相同初态核心回归在 tick 510 到书柜，包含每步间距/步长、冷恢复、过期 PATH_BLOCKED 反馈和取消检查。

茶会 `approved-tea-dpr1-diagnostic-01` 完成两轮故事后又暴露普通 GPT 取茶堵路：旧路线不重规划，且未预留柜台/座位，后来居民可抢柜。复制隔离 profile 已确认 revision 57 / tick 4292 的 world 到测试 fixture，源证据保留不改。当前普通活动开始时检查现有座位 intent，期间只从其他居民自主候选中暂时排除柜台和预定座位；其他行动继续。动态阻挡按原 `expires` 的 2400 tick 总预算等待/重规划，不瞬移、不扩期限。同一已确认存档核心回放在 tick 5132 走完 counter / choosing / seat / waiting，不增加故事奖励；后续pre3双DPR真实浏览器已完成普通取茶和坐下；首轮失败证据保留。

相关 [书屋导航回归](../../../packages/ai-village/tests/bookhouse-navigation.spec.ts)、[茶会导航回归](../../../packages/ai-village/tests/tea-square-navigation.spec.ts) 已加入。首轮失败标签不能被后续核心 PASS 覆盖，也不能由此宣称正式 fullplay 全部通过。

## 收尾脚点兼容规则

固定候选从旧五点扩为十三点，旧五点原坐标、原顺序保留，旧 world14 的已存 targets/routes 不需重排：

`(54,348), (304,258), (262,380), (306,348), (98,380), (142,380), (186,380), (218,420), (54,420), (98,420), (142,420), (262,420), (306,420)`。

全部可走且逐对间距至少 24。仍然只持久化本次三人的三个目标；每人路线最多九段，接近最多 2400 tick。选择候选时避开其余参与者及全部旁观者，不搬人、不瞬移、不跳过到齐检查，也不在杯垫刚排对时提前发奖。增加候选不是改变家具碰撞或给居民增加后台跨区模拟。

## 最终真实验收矩阵

| 范围 | 实际结果与证据 |
| --- | --- |
| 正式入口和资源 | 双DPR通过公开地图进入书屋/茶会，使用实际获批纹理；没有注入world、ticks或坐标。每轮32检查/30PNG，见[浏览器报告](tea-square/QA_PLAY.md)。 |
| 书屋真实活动 | 书柜reading、书桌writing、窗座seated、共读三阶段和照片在双DPR通过；十二身份接触/部件由独立图集与核心回归覆盖，不把七人运行写成十二人同时运行。可见原生三普通站与窗座照片另有记录。 |
| 茶会完整玩法 | 七人、错排/重排、取消不奖、首次完成、不同三人重玩、普通取茶四阶段及真实坐姿/取消在双DPR通过；首次事实和纪念保持。 |
| 资源与保存故障 | 书屋等长坏字节、茶图503失败前零世界写入，实际重新入场恢复；Host写入后丢ACK并阻断state，恢复后只读核对且不重放。此为鉴权浏览器harness故障注入，未称原生故障注入。 |
| 暂停、隐藏与冷恢复 | 杯垫部分板双DPR冷恢复通过；原生检查点经完整进程关闭/重启后逐字段一致。真实侧栏隐藏5秒世界逐字段不变、iframe卸载；物理睡眠/最小化未覆盖。 |
| 相机与相册 | 浏览器及可见原生输出真实720×960茶签/书屋照片，保持世界；遮挡按实际深度保留。 |
| 生命周期与预算 | 双DPR每轮19次旅行；独立性能轮另12次，纹理/source/Blob库存恒定。软件七人三区约5秒样本及进程内存趋势见[性能报告](performance/RESULTS.md)；短期增长未被解释为无泄漏。 |
| 原生固定包 | 官方0.2.1-rc.2独立profile安装、三个bundle和资源身份、七人检查点、全进程冷恢复及首次纪念通过；VisibleQa补测与旧Hidden超时分别记录于[原生报告](tea-square/native/APPROVED_PRE3_RESULTS.md)。 |
| 隔离清理 | 每个原生批次只停止核验PID/可执行文件/独立user-data的进程树；CDP18774后验见原生报告的cleanup记录。 |

隐藏原生数据、获授权的可见窗口数据及SwiftShader软件数据分别记录。前台短探针不能替代长期硬件性能；物理睡眠、最小化及长期soak未补写为通过。

## 既有冻结包与证据边界

0.12 地图/自由行走基线独立冻结。0.13 gate 包身份为 `nidofy-dsh-ai-village-0.13.0-preview.1.tgz`，SHA-256 `fed59a28566bb09bd2a1f82c0096b7fb09a859e49102475b429b93085e4e845d`，48,911,384 字节；其原生安装、庭院七人 checkpoint 和完整进程重启恢复已有实际证据，但该包茶会仍 planned，未包含本次获批场景的最终正式开放及后续修复。

[原生 gate 结果](tea-square/native/RESULTS.md) 保留成功、失败、超时与清理记录。它不能作为新包茶会 fullplay、书屋正式动作接入或旧 profile 升级通过的依据。当前pre3已领先该冻结门禁包；最终包版本/SHA、统一测试与新QA证据见下文。

## pre3 最终包与浏览器闭环

0.13.0-preview.3 固定包为 dist/nidofy-dsh-ai-village-0.13.0-preview.3.tgz（53,661,172 B / 397文件），SHA256 `50ef2a077fd8df30f89f773ded04bab61a478c1ed4ee4a6b67bd6b9260ef08c2`。74文件/410测试、官方严格类型及构建、smoke、空缓存离线安装全部通过。

[DPR1与DPR2真实运行报告](tea-square/QA_PLAY.md)各32项检查/30张PNG、零页面错误/外网请求；每轮19次旅行的纹理/source/Blob库存严格有界。两轮同一runner，129份源码、三bundle及所有包内lib/assets逐字节吻合；[包身份](tea-square/play-package-identity.json)与`.build/ai-village-tea-0.13.0-preview.3-play-frozen`已冻结。

这些浏览器截图来自同源码的官方鉴权harness；实际官方Desktop安装截图与其背景调度限制见[独立原生结果](tea-square/native/APPROVED_PRE3_RESULTS.md)。书屋七人挤在桌前时会按合法深度遮挡桌面及写字伙伴，不能因mode断言通过就宣称两人始终清晰可见；没有抬高z、移动旁观者或修改碰撞来美化截图。
