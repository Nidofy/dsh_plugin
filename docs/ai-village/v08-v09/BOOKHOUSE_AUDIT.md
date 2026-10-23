# AI 书屋开发样板：多区域只读审计与最小实施契约

审计日期：2026-10-23。读取时 HEAD 为 `41f512d61c39aae099190c538a555fc81cfd6466`，0.8 的 collection/encounter 与版本冻结修改正在同一工作区推进。因此本文是实施建议，不是已完成的书屋功能；**等待 0.8 数据门禁后，以其最终 schema 为迁移源，使用下一未占用版本**。若 0.8 为 schema9，书屋应使用 schema10，不能再次占用8或9。

本轮仅写本文，并用内存中的拟议几何调用已有纯寻路函数。没有改 `src`、宿主、真实 profile、资源审批或入口门禁。

## 建议先做的可执行范围

增加一个明确标记“AI 书屋 · 开发样板 / AI Bookhouse · Development preview”的独立 360×480 场景：固定书柜、阅读桌、窗边座，使用现有 read/work/sit 行为、七位批准纸娃娃和已有个性动作。室内背景与家具使用原创代码图形，具备真实足迹、活动位、遮挡和命中，不冒充批准原画。第一版全体在场居民一起换区域，只模拟当前区域；书屋不开放家具编辑、居民入退住或庭院专属故事/餐桌玩法。已有手账、好友关系、收藏解锁、配饰、设置和相册继续共享。

这能交付真正可进入、走动、阅读、坐下、拍照、返回及冷恢复的第二场景，而不需要驻留居民调度、第二个 owner、跨区同时模拟或引擎重构。进出是玩家明确选择的区域旅行；到达目标区使用已验证入口/返回落点，不声称沿一条屏幕外道路连续行走。普通自主活动与短社交在离开时结束；进行中的玩家故事/小游戏不被自动取消来强行换区。

## 已核对的现有约束

| 文件 / 入口 | 真实实现与影响 |
| --- | --- |
| `src/core/world.ts`：Scene、walkable、reachable、routeTo、validateWorld | Scene 本身可用任意字符串 id；现有寻路可用于独立矩形可走区与有限矩形障碍。World 的 `worldId='bluewhale-courtyard'` 是存档身份，不能改为区域 ID。低层 validator 核对 sceneVersion 与传入 Scene，行为支持 work/eat/rest/sit/read/tend，不必新增行为枚举。 |
| `src/core/home-state.ts`：homeScene | 不是通用区域构造器。根据固定 work/eat/bench/corner offsets 移动位置，按 obstacles 的索引0/其余移动 work/eat；强制沿庭院入口校验。把书屋 Scene 直接传入会错移障碍和家具。 |
| `src/core/neighborhood-state.ts`：neighborhoodScene | 默认插入固定 bench 和 corner 坐标；遇到 bench 就把传入结构当已经适配好的场景。不能通过人为塞一个 bench 欺骗该 shortcut 来获得第二场景。 |
| `src/core/living-state.ts` 及新冻结版本 | 校验链把当前住民投影进 homeScene，再校验故事路径、两席棋局、短社交。书屋 actor 坐标不能直接喂入庭院 living validator。新增区域必须有显式当前几何 validator 和共享字段投影，不能放宽旧格式校验。 |
| `src/core/living-controller.ts` / `living-engine.ts` | syncScene、step、story prepareStage 等均默认庭院 homeScene；公共 world step/navigation 可以复用，书屋分支不要调用庭院剧情推进器。 |
| `src/client/runtime.ts` | 当前导入唯一 scene；初始化、恢复、保存候选、故事命令、布置、tick settlement、bundle 都使用它。不能只改 bundle 的场景就认为模拟与保存已切区。 |
| `src/client/asset-selection.ts` | residentAssets 初始无条件加入7项庭院环境纹理；同时 Bluewhale 的角色活动部件也在 `scene/` 命名空间。不能粗暴删掉所有 `scene/*` 作为离开庭院时清理。 |
| `src/client/frame-bridge.ts` | init 传完整 scene；后续 assets 消息仅传 images，不会替换 scene。每个 iframe 绑定 token，首帧确认检查 attempt/asset/view revisions。重用现有 iframe 仅换图片会保留旧场景结构。 |
| `src/client/Floating.tsx`：Scene | attachFrame 在挂载时创建 token；现有组件没有按区域重新挂载。建议给 Scene 实例按已提交的 region ID/临时 frame generation 加 key，只保留一个实例。 |
| `src/frame/scene.ts` | init 固定创建庭院 background/cushion/desk/table/seatProps/NeighborhoodArt；paint 假设家具数和 prop 数不变，并调用 homeScene。书屋须显式场景分支，不能隐藏几张旧图冒充独立场景。 |
| `src/core/camera.ts`、`frame/viewport.ts`、照片投影 | 多处固定360×480；第一版书屋维持同尺寸，保留720×960照片，避免无关相机改造。 |
| `src/host/service.ts`、`host/save-store.ts` | 一套 profile owner/lease、一个世界 SaveStore、一个当前指针。store 已接受泛型 WorldCodec；只需换当前 codec。世界48 KiB、HTTP及存档 envelope64 KiB，必须保留有界状态。 |

## 推荐数据形状与单一权威

保留现有世界中的共享进度唯一副本，增加一个有界 `region` 字段。**顶层 actor/companions 始终是当前活动区域的权威状态**；不存两份完整 LivingWorld，也不复制 memories、bonds、收藏奖励、rng 或 ticks。

建议概念结构（命名可随0.8定稿统一）：

```ts
type RegionId = 'courtyard' | 'bookhouse'
type ParkedPose = { id: CharacterId; position: Point; safe: Point; facing: 'left' | 'right' }
type RegionState = {
  active: RegionId
  returns: {
    courtyard: ParkedPose[] | null
    bookhouse: ParkedPose[] | null
  }
}
```

约束：当前 active 对应 returns 必须为 null；另一区最多7项、角色 ID 唯一且属于当前在场 roster；每个位置/safe 必须在其真实场景内并保留24px居民间距。未访问区域为 null。暂停偏好、rng、ticks、选择角色、长期进度仍只在原字段保存。region revision 若只为 frame 防旧消息，不要持久化；使用既有 iframe token/asset revision 与 runtime 临时 generation 即可。

`home` 继续保存**庭院**布局/配饰；bookhouse 第一版只有静态家具，不引入第二套可编辑 Home。庭院纪念物挂点仍属于庭院，不能把 window/door/wall 坐标照搬到书屋。书屋可显示共享手账和收藏信息，但挂点编辑应说明返回庭院操作。

离开当前区时在候选副本内结束普通 intent/短社交，仅保存稳定 pose；不会把带 expires 的旧行为放进非活动区域继续过期。返回时恢复相应 pose、idle、无 intent/destination，然后重新正常调度。不活动区域不推进，不做墙钟追赶。当前区的实际模拟推进唯一 ticks/rng；区域切换自身不消耗随机数，也不改变 userPaused。

在书屋限制入退住使第一版跨区 roster 合同保持简单：全体在场角色一起旅行，选择当前角色仍可用。未来开放书屋入退住必须同时更新非活动区的合法返回 pose，不可留下重复/缺失 ID。庭院入退住也应同步清理已记录书屋返回 pose：移除离场者，新加入者下次进入使用确定性入口位置分配。合同固定为“书屋返回 pose 允许合法子集，在正常切换命令中补齐入口位置”；validator 不填充非法存档。active=bookhouse 时，courtyard 返回 pose 必须完整覆盖在场 roster（离开庭院时刚记录，且书屋禁止入退住）；这也保证共享内容的庭院校验投影有完整合法角色来源。

### 校验与迁移的窄适配

新增 `region-state.ts` 持有当前 schema/codec：先 exact 校验 region 和当前 actor；在 courtyard 使用冻结后的0.8庭院 validator；在 bookhouse 使用独立书屋 Scene 调用低层 actor/world 校验，再用**庭院返回 pose 的合法 idle 投影**验证原共享内容字段。投影不是持久世界，不向 UI/Host 发布，也不能拿 active 书屋坐标伪装庭院坐标通过校验。

共享字段投影须显式列出剥离 region、新旧 schema转换、social清理和 actor来源；使用深拷贝，避免此前 withLiving 一类 alias 风险。书屋强制 activeEvent/neighborhood.event/play.active 为 null；暂不在该区开启庭院剧情。0.8新增 encounter/收藏字段必须一起确认，不可因投影丢弃或自动发奖励。书屋普通 read/work/sit 与附近聊天/共同看书只做生活表现，不自动完成手账。

历史1–0.8通过各自冻结 codec读取，再补 active=courtyard、returns两项null。迁移本身不挪动现有住民，不清除已有故事/棋局，不消费RNG，不改手账/相册。第一次新格式保存仍由原 SaveStore protectUpgrade 保留原始指针/快照；未知未来 schema、未知区域、超界 pose、非法重复 ID、非当前区路径必须拒绝，不能退回空庭院。回退仍用升级前独立 profile，不在新格式上直接降级写入。

## 独立书屋几何样板

下面是可实施的**建议参数**，不是已批准场景布局；正式代码应使绘制、hit、obstacle、depth和活动位同源。

| 项 | 参数与职责 |
| --- | --- |
| 场景 | id=`bookhouse`（内部审计用 `bookhouse-preview`），独立version1，size360×480 |
| walkable | `{x:36,y:220,width:288,height:220}` |
| 入口 | spawn `(180,420)`；首次七人落点 `(48+44*i,402)`，按稳定角色 ID 分配，不用 RNG |
| 书柜 `bookcase/main` | read，anchor `(276,268)`，hit `{254,250,44,36}`，柜脚障碍 `{234,220,86,20}`；1人取阅/阅读 |
| 阅读桌 `reading-desk/main` | work（记笔记），anchor `(142,328)`，hit `{116,308,52,28}`，桌前沿障碍 `{72,337,140,22}`；1人，已有work手部姿态可复用 |
| 窗边座 `window-seat/main` | sit，anchor `(92,270)`，hit `{62,250,60,40}`，座体障碍 `{44,220,116,20}`；1人安静坐下 |

审计已在内存中用实际 `walkable`/`routeTo` 验证入口、7落点与3席位共11点全部合法，121条有向静态路线均存在，最长3个路径点；7入口落点间距≥24px。**尚未验证**7人动态避让/席位争用、家具视觉边缘、手部前后层、拖放、降低动态或照片，因此这些仍是实施后的门禁。真正分配目标落点时仍调用 residentRoute/available 等动态占用检查，静态route成功不能替代动态成功。

## 切换与恢复契约

1. 明确选择区域；runtime 先拒绝 save pending/unknown、断连/非owner、恢复、拖拽、照片、布置草稿及任何玩家活动。不能只隐藏对应按钮，命令层同样拒绝。未保存草稿由既有放弃确认流程处理，不能静默丢弃。
2. 同步暂停切换过程，冻结候选来源；等待既有保存完成后基于最新 world 建候选。校验区域 allowlist、两区几何、返回pose与目标入口落点；取消候选副本的短社交，原可见世界暂不变。
3. 按目标区域准备并校验资源。加载失败保留原区域/原世界/原纹理，释放失败尝试新增buffer，不写入场景切换。不能先 trim 当前资源再发现目标资源不可用。
4. 通过既有 commitWorld/SaveTransaction 单次 CAS保存完整候选。拒绝保留原区；结果未知不重放、不再次切区，沿既有有界只读对账确认，只有 confirmed committed 才发布新世界。
5. 发布后将 frameReady 置false、重置临时camera/gesture/dismissedPointer，按新区域重建唯一iframe。旧iframe先dispose，新iframe完整init携带正确scene与region资源；旧token/延迟首帧/旧指针消息不可影响新实例。
6. 首帧仍需匹配token/attempt/asset/view revision；期间维持暂停与输入门禁。成功后只移除切换暂停，保留userPaused及hidden/sidebar等原暂停原因。生产静态入口、ART_REVIEW选择器不变，不用“跳过过场”绕过资源或首帧确认。
7. 若CAS成功但目标渲染失败，持久active仍为目标区，显示重试/只读恢复状态。不能暗中回滚文件或发布旧区假象。冷启动按已保存active重载；需要返回时再次合法CAS，而非直接改active。

## 资源与渲染的最小改动

实际 `assets/scenes/` 当前只有 courtyard，包含14张既有PNG与 scene/manifest JSON；不存在批准 bookhouse/library 母版。`frame/neighborhood-art.ts` 书架/长椅是代码图形，可复用绘制语汇，不能称为新批准书屋原画。

- `client/asset-selection.ts` 拆出 avatar keys 与 region environment keys。书屋纯代码背景/家具不需要庭院7张环境PNG；保留当前在场角色所有实际需要的部件，尤其 Bluewhale 的 `scene/work-left` 等不能误删。第一版可继续保留每个角色现有5项活动部件，避免 rigFor 无条件构造休息/吃饭sprite时缺纹理；进一步裁剪应另改lazy rig并验收。
- `runtime.ensureAssets/trimAssets/bundle` 用已校验 region 选择集合，先准备候选、确认后trim；只加载当前区域环境与当前在场角色。角色原始buffer可在切换时复用，旧iframe GPU资源/URL须销毁；不同时保留两个Pixi Application。
- 新 `frame/bookhouse-art.ts` 只拥有代码场景背景、三件家具分层与读书/记笔记小道具；没有新PNG、manifest批准位或远程图片。现有 approved 纸娃娃保持。
- `frame/scene.ts` 在 init/paint按区域分支：庭院保持原逻辑；书屋跳过庭院cushion、饭碗、table-art、NeighborhoodArt庭院家具与homeScene。activityDepth使用书屋家具前沿，同一书屋定义驱动hit/footprint/绘制；角色手部在前沿上层，脚/下身按现有paper-doll与深度规则处理。
- `cachedAtmosphere`/`backgroundSurface` 当前要求 `scene/background.png` 已解码image。书屋代码背景必须有独立无图片路径，不能为了填参数偷用庭院背景。第一版不提取全渲染器框架，只新增bookhouse分支与小模块。
- `scripts/ai-village-resources.mjs` 与自动生成 definitions.ts 无需为纯代码样板改批准清单；新 region-catalog 导入已有庭院定义即可。以后批准书屋原画时，才加入独立manifest与区域资源keys，仍验证hash/预算/路径。

## 精确文件清单与实现顺序

| 文件 | 最小职责 |
| --- | --- |
| 新 `core/region-catalog.ts` | 两区白名单、开发样板标签、独立固定书屋 Scene/家具定义、资源集合描述、7入口落点 |
| 新 `core/region-state.ts` | 下一schema、冻结旧格式迁移、有界返回pose、当前区actor校验、共享进度窄投影、codec |
| 新 `core/region-engine.ts` | pure switch候选、确定性入场分配、返回pose维护、书屋普通step/短社交；庭院委托0.8引擎 |
| 新 `core/region-controller.ts` | 当前区syncScene/advance/snapshot和拖拽范围；复用WorldController，不复制pointer/寻路实现 |
| `core/world.ts` | 只扩SimulationWorld当前schema union及确有必要的类型/个性权重适配；旧schema规则/RNG序列保持 |
| `host/service.ts` | 切换为区域codec/types；一套原SaveStore、owner、相册与API；不新增每区域数据目录 |
| `client/runtime.ts` | region命令、当前geometry选择、共享UI世界、原始事件命令区限制、资源准备、commit/recovery/首帧时序 |
| `client/asset-selection.ts` | avatar与environment分离，显式region参数，保留资源白名单 |
| `client/Floating.tsx` / `frame-bridge.ts` | 区域key重挂单iframe、init区域契约、旧消息隔离、可恢复失败；首帧规则不放宽 |
| `core/frame-protocol.ts` | 因init/view当前schema与region含义变化，提升协议版本，显式验证region；旧帧消息拒绝，既有pointer/UIInput不需凭空扩自由命令 |
| 新 `frame/bookhouse-art.ts` + `frame/scene.ts` | 新代码绘制样板、独立几何绘制分支、真实纹理释放与照片；保留庭院old路径 |
| `client/Hud.tsx` 或既有四页内小 `RegionPanel` | 在现有更多/布置路径提供“前往书屋/返回庭院”，清晰标明开发样板、固定家具及受限操作；不增加第五个Dock入口 |
| `client/ManagementPanel.tsx` / `PlayPanel.tsx` / `PhotoPanel.tsx` | 共享进度继续可读，庭院专属命令显示区域原因；照片可加区域显示文案，但不必为了标签迁移相册索引 |
| 新 `tests/regions.spec.ts`，现有runtime/frame/store专项 | 见下列门禁；必要时更新preview fixture，不让fixture专用世界代替真实存档 |

**保持不动**：旧冻结1–0.8 codec/目录语义、SaveStore文件协议与保留策略、PhotoStore格式、入口批准状态和生产选择器、桌面宿主源码。除非测试发现实际必要，不做通用场景编辑器、跨区居民驻留系统、无限场景插件注册或完整引擎重构。

## 实施门禁与主要风险

1. **迁移/完整性**：1–0.8各样本升级后courtyard原actor/progress/board/album保持，首次写保护原字节；超过32次保存仍能读升级点。未知区域/未来schema/重复pose/非法路线/伪造reward拒绝，不静默裁剪。
2. **幂等与中断**：切换before-write失败、after-commit lost ACK、快速往返、隐藏/关闭/断连、活动中切换、迟到旧token输入，均只出现一个确知active，最多一次写；未知时不发送第二个切区写。
3. **共享状态**：同一memory/eventId/收藏唯一；书屋阅读不自动刷完成奖励。庭院布局/装饰位置保持；往返不随机改变RNG、userPaused、角色选择；新入场只补缺失合法pose。
4. **模拟/几何**：7人动态入场、自由走动、三位占用与剩余人避让、拖拽落点、读/写/坐姿，至少长步数确定性与中途冷恢复一致；非当前区完全不step。
5. **资源/图像**：实际书屋请求不含庭院环境PNG；往返后纹理/BlobURL/监听器不累积；一帧只显示当前区；照片是书屋真实renderer输出且保持暂停偏好。所有未批准背景/家具显示为开发样板。
6. **可恢复渲染**：CAS已成功、iframe启动失败时不能谎称还在旧区；重连/完整Desktop冷恢复必须依保存active恢复，并清晰显示失败和重试。
7. **验收身份**：0.8先冻结并过迁移门禁，再实施0.9样板；新build/source哈希、原生安装/冷恢复和软件性能重新取证，不能复用preview.2的两区尚不存在时的通过结果。

最大的风险不是静态绘图，而是“书屋坐标交给庭院validator”和“CAS提交后旧frame仍在接受指针”。先完成region codec/命令和frame切换契约，再画样板，能把风险限制在少量新模块与现有连接点。

## 0.9实施补记：几何与代码样板

0.8门禁通过后已实现 `src/core/bookhouse-scene.ts`、`src/frame/bookhouse-art.ts`。上表三个活动位、障碍、spawn与七个固定入场点直接作为实际Scene定义；version1，seatProps为空，无庭院cushion。家具asset字段为明确的`code/bookhouse/*`身份，frame书屋分支不能按它们请求PNG。

BookhouseArt构造接收已有sortable worldContent，背景、每件家具的back/front及三个活动道具全部为独立siblings。`paint(readonly {actor: Actor; point: Point}[], ticks, reducedMotion)`使用实际渲染point，拖拽离开锚点即隐藏接触道具；不持有world或计时器、不改变ticks/RNG。阅读桌道具深度低于既有work手部接触层，高于桌前层；书柜打开书页和窗边座书签按角色脚点排序。背景与家具为原创Pixi代码图形，不新增批准PNG或假定用户已签收。区域标签由管理界面提供。

两份专项tests共6项通过，覆盖11点之间121条有向静态路线及逐段障碍校验、七入口脚印距离、三活动精确命中/独占席位、障碍落点拒绝、无旧餐具fallback、图层父子关系/桌面接触深度以及destroy保留无关节点。此结果不替代真实浏览器三家具动态到位、照片、原生冷恢复或性能验收；这些随0.9最终包单独取证。
