# AI 小院 UI-v1 实施方案

基线：`Nidofy/dsh_plugin@2cab99a` / `@nidofy/dsh-ai-village 0.6.1`。本文件规定实施次序、接口边界与提交证据，不授权修改其他产品范围。设计以`01_最终设计规范.md`为准。

## 1. 启动检查：记录，不回退

在用户现有仓库工作区执行只读检查：`git status --short`、`git branch --show-current`、`git rev-parse HEAD`；完整读取根AGENTS、README、架构及小院当前规则。不得reset、clean、stash或切走有未提交修改的分支。仅在工作区干净且没有其他用户指定分支时新建`codex/ai-village-ui-v1`。

审阅基线之后有新提交时，以当前源码为准保留新增功能；产出`UI_V1_BASELINE.md`列明差异和映射。路径或符号变化可以做等价适配，不能借此推翻四入口、比例、锚点或存档约束。若一个明确设计项客观无法映射，将该项标BLOCKED并继续不依赖它的任务，不把整个任务变为重新讨论。

使用已准备的Node24+、官方依赖、Playwright与本机浏览器缓存。不要全仓升级依赖，不执行联网安装来“顺手修复”环境，不触碰真实DSH_HOME。构建端缺依赖时记录缺项和受影响验证；测试状态写NOT RUN，不写PASS。

## 2. 改动范围

### 2.1 允许修改的现有文件

| 路径（相对packages/ai-village） | 本次责任 |
|---|---|
| `src/client/Floating.tsx` | 去掉常驻表单/内容分区；保留唯一Scene挂载点；组合HUD、管理层、模式层、错误层 |
| `src/client/content-style.ts` | 替换成冻结token、响应式布局和作用域样式；不得影响宿主选择器 |
| `src/client/runtime.ts` | PresentationState、模式间呈现、受控编辑输入、已确认事实通知、偏好迁移入口；保留世界所有权和事务 |
| `src/client/frame-bridge.ts` | 协议3、camera/arrange输入、投影revision、完整清理；不放宽验证 |
| `src/client/HomePanel.tsx` | 作为Home草稿的UI接入；去掉表单重复入口，加入锚点可视化选择 |
| `src/client/NeighborhoodPanel.tsx` | 按四页重新组织已有动作、关系、回忆；去掉重复模板直写UI |
| `src/client/PhotoPanel.tsx` | 拍照工具/照片预览/相册的界面拆分；不替换album数据层 |
| `src/client/Icon.tsx`、`messages.ts` | 自制SVG和中英文文案 |
| `src/frame/viewport.ts`、`scene.ts` | 统一世界投影、非交互延展、模式输入、真实照片离屏输出 |
| `src/core/preferences.ts` | 偏好schema2及显式1→2解码；不改变世界格式 |
| `src/host/service.ts` | 只接入偏好codec和新派生资产白名单；不改变Host路由/认证契约 |
| `experiments/phase4-client.tsx` | 与正式Surface复用，不留下旧版独立UI |
| `package.json`及本包lock元数据 | 最终打包需要时只更新本包版本；不升级运行依赖 |

`src/client/floating-layout.ts`、`src/core/home-state.ts`和`src/core/controller.ts`原则上只复用。只允许为纯呈现/只读几何导出补充最小接口，不修改宿主避让算法、48布局定义、碰撞、路径、行为、奖励或暂停原因语义。必须单独列出任何这些文件的diff及必要性。

`src/definitions.ts`是生成文件，只能通过资源生成脚本更新；禁止手改其中世界尺寸/人物比例/碰撞区域。

### 2.2 计划新增模块（名称为实施约定）

| 新路径 | 职责 |
|---|---|
| `src/client/ui-contract.ts` | 冻结尺寸、断点、token、tab IDs，引用同一来源，避免散落魔数 |
| `src/client/ui-state.ts` | 纯PresentationState与reducer，按profile生命周期而非session持有 |
| `src/client/Hud.tsx` | 顶部、更多、视角和状态展示 |
| `src/client/ManagementPanel.tsx` | 单内容树的底抽屉/宽窗右面板、Dock、焦点返回 |
| `src/client/Notifications.tsx` | 消息popover与有界toast，不产生业务事实 |
| `src/client/SettingsPanel.tsx` | 单列设置、诊断、恢复入口 |
| `src/client/ArrangementControls.tsx` | 编辑工具区、对象选择、锚点按钮、保存/取消/undo |
| `src/core/camera.ts` | 纯坐标变换、夹紧、缩放锚点、模式workspace；不写World |
| `src/core/notifications.ts` | 从confirmed snapshot派生稳定消息和去重，不依赖React/Pixi |
| `src/core/frame-protocol.ts` | 唯一协议版本与discriminated unions/validator |
| `src/frame/input-router.ts` | Pointer/Wheel/keyboard路由、捕获/取消与消息发送 |

可以把纯显示的子组件放在上述模块内部，不能为每个按钮生成一个文件；不得引入Redux/Zustand/新UI框架、第二React root或新的动画依赖。

### 2.3 不在允许范围

其他插件业务、官方DSH源码、用户Electron安装、现有批准原图、历史世界解码规则、世界SaveStore算法、PhotoStore/Album持久格式、真实用户profile、仓库根依赖版本。

## 3. 状态与命令连接

### 3.1 PresentationState

```ts
// 新增设计类型；不是现有API声明。
type VillageTab = 'residents' | 'wishes' | 'decor' | 'journal';
type DrawerSnap = 'closed' | 'half' | 'full';
type Overlay = null | 'more' | 'view' | 'notifications' | 'settings' | 'resident';
type ObservationCamera = { zoom: number; panX: number; panY: number };
interface PresentationState {
  tab: VillageTab;
  drawer: DrawerSnap;
  overlay: Overlay;
  camera: ObservationCamera;
  selectedFurniture: 'work' | 'eat' | 'bench' | 'corner' | null;
  accessoryTarget: CharacterId | null;
  // 还包括明确有界的toast队列、当前手势和返回焦点描述；不存DOM节点进存档。
}
```

首次新建runtime：tab=residents，drawer=closed，overlay=null，camera={1,0,0}。用户原游戏内容和当前居民不改变。用户明确关闭后重开：drawer/overlay收起；同进程保留最后Tab/camera。临时隐藏恢复：保留草稿、Tab、模式、camera；重校几何和草稿。

宽窄切换不能换掉整个Scene React key。允许因真正generation变化、frame失败重试或现有隐藏资源回收重建frame；不允许因Tab、主题、camera、drawer或expanded状态重建。

### 3.2 连接已有命令，不复制实现

| UI操作 | 复用命令 |
|---|---|
| 看看在场居民 | `runtime.selectCharacter(id)` |
| 入住/离开、批量 | `setCharacterPresent` / `setAllCharacters` |
| 用户暂停 | `runtime.pause('user', ...)`，按既有锁处理 |
| 同桌 | `runtime.invite(participants, food)` |
| 其他活动/取消 | `runtime.interact(...)` / `cancelEvent()` |
| 家具/环境/配饰 | `beginHome` → `updateHome`/`homeTemplate` → `undoHome`/`confirmHome`/`cancelHome` |
| 风铃 | `previewDecoration` → `decorate`，成功后才结束草稿 |
| 额外挂饰 | `previewExtraDecoration` → `decorateExtra` |
| 拍照 | `enterPhoto` / `setPhotoOptions` / `capturePhoto` / `exitPhoto` |
| 相册 | 原`runtime.album`与`AlbumClient` |
| 设置 | 同一个偏好写入事务与`setPreferences`接入点 |

相机/面板开合不调用save。草稿pointermove不调用updateHome/save。只在合法drop或明确锚点选择时调用一次updateHome；最终确认才CAS。

### 3.3 新协议输入

协议3保持原channel，统一父端/frame版本。新增只允许：镜头缩放/平移/重置意图、布置选中/拖动意图、裸场景单击/居民轻点呈现意图。每项有精确type、白名单ID和模式约束。

输入经过三层判断：事件是否来自当前frame与有效token；viewport/sequence/pointerId是否当前；runtime当前模式/保存锁是否允许。UI层禁用按钮不能代替runtime校验。禁止frame传来任意method字符串并由父端动态执行。

父端传给frame的是受控PresentationSnapshot：mode、camera、workspace、合法对象/锚点、hover/ghost/selection。世界仍来自既有runtime.view。frame发送的坐标必须经当前投影逆变换；DPR只参与backing store，不二次乘在CSS坐标。

## 4. 实施阶段和完成门

### M0 — 固定基线与功能迁移表

产出`docs/ai-village/UI_V1_BASELINE.md`：实际HEAD、未提交文件、现有测试入口、全部旧操作清单、代码差异。把本交付规范复制到仓库`docs/ai-village/ui-v1/`，不覆盖旧发布记录。

先执行可用的类型与小院专项测试，记录baseline。历史证据里103/258等数量不是本轮通过条件，不照抄数值；采用实际发现/执行的测试集。

完成门：每一旧操作有新位置；宿主/世界边界记录清楚；没有改游戏逻辑。

### M1 — 展示状态与组件边界

引入ui-contract、ui-state；抽出HUD、ManagementPanel与设置容器，但先维持现有功能可用。把本地tab/settings/expanded相关责任清楚分离；mode以runtime为准。按本规范将所有已有内容映射到四入口，消除重复布局确认路径。

先补reducer/React测试：互斥浮层、Tab行为、Escape、焦点、隐藏恢复、宽窄无第二Scene。M1不得擅自调整世界位置、角色大小或存档。

完成门：功能路径无遗漏；模拟推进与现版相同；UI事件不调用额外世界写入。

### M2 — 全视口、统一投影与有限镜头

取消外层canvas的3:4布局约束，Scene绝对填满插件卡片；底抽屉/面板改覆盖。真实background移入统一世界变换，单独实现缓存的非交互氛围延展。引入纯camera函数与协议3；普通镜头1–1.5倍，camera状态不进入HomeWorld。

统一input-router：角色拖动/布置拖动/相机平移/列表滚动有互斥所有权；5px判定统一复用。所有投影改变递增viewportRevision，旧输入拒绝。复核现有气泡DOM位置投影与12px最小字体，不能只修Canvas。

完成门：矩阵点往返、DPR、viewport stale拒绝；拖动不跳点；旧座位命中不变；隐藏零绘制；全景能找到所有合法对象。没有假场景空白可行走区。

### M3 — 四页与视觉定稿

应用同一套浅/深色token、HUD溢出规则、Dock/抽屉宽度；移除顶部下拉/常驻存档行/帮助footer。完整居民头像由现有PaperDoll离线合成；新资产登记资源生成器和Host白名单，UI按需加载。

居民页补选择/在场/活动/关系；心愿页保留所有活动条件；手账整合两套事实和相册；布置页显示真实缩略和解锁状态。不新写剧情/奖励，不用硬编码fixture替代真状态。

完成门：340×720、580×720、1080×760的浅深主题截图与HTML对照；英文无溢出；没有单层秃头头像；同一按钮布局和命中尺寸一致。

### M4 — 消息与偏好窄迁移

新增deriveNotices纯函数，输入只取confirmed snapshot。接入世界commit成功/未知结果经只读确认后的唯一成功路径；重试、重连、重复体验不能重复通知。ID集合有界，toast聚合、暂停显示和历史定位按规范。

偏好1→2显式codec：读1保留主题/语言/动态/气泡，初值增加新字段；写只接受2。旧原始字节与指针保护复用SaveStore迁移支持，不默认清档。Host和client都验证长度/字段；错误/未来版本仍拒绝。

沿现有单偏好写入链处理主题变化与标已读；并发用户意图要串行或显式禁用，不能因为`preferenceSaving`直接return而悄悄丢失已经接受的动作。unknown只读核对，不重放写请求。读取消息/mark read不能写world、触发奖励、改变world ticks/rng。

完成门：旧偏好迁移与保护、初次升级历史不刷屏、重启已读保持、保存失败不假成功、无界消息不会增长。

### M5 — 受控布置与模式生命周期

先做按钮选择合法锚点，再加Canvas直接拖到同一锚点。选择/ghost/高亮属于presentation；有效drop才一步undo。家具和角落从homeScene导出几何，未改变positions枚举与48组合。

统一Home/挂饰模式工具栏但保持各自事务；禁止两份草稿。草稿dirty判定与初始快照比较，不把只是选中对象算dirty。显式关闭的放弃确认与临时隐藏区分；提交pending/unknown保留candidate及草稿，核对前不得关闭成“已取消”。

完成门：有效/非法/占用/同锚点/撤销/取消/显隐/断连全部覆盖；居民不被挪动来让路；保存后的render/hit/obstacle/seat同步。

### M6 — 拍照与输出构图修正

改PhotoPanel呈现，不改album事实结构。拆开观察相机与photoOptions；同一renderer进行规范3:4离屏输出，并在异常/取消后恢复现场矩阵。照片取景框所见内容与输出一致；UI、扩展背景和未确认ghost不入照片。

捕获仍有原timeout/尺寸/PNG校验；生成的RenderTexture/Canvas/Blob URL按生命周期释放。连续拍照不累积renderer或监听器。

完成门：固定世界在窄/宽/DPR变化后同参数照片几何一致；20张/40MiB/单张4MiB、删除确认、未知回执、取消、重启恢复不回退。

### M7 — 综合回归、证据与安装包

完整执行验收矩阵并保存结果，不用截图代替交互断言，不用headless性能代替原生GPU。先完成构建，再运行对应浏览器测试，避免测试旧bundle。正式源码预览与包安装入口均要检查。

如源码版本仍为0.6.1，交付本包0.6.2；若实际基线已更新，采用下一个未占用patch并记录，不改其他包版本。新偏好格式的回退限制写入发行记录；保留原包与迁移保护，不能用旧插件直接覆盖新偏好。

输出tgz、SHA256、文件清单、构建HEAD/脏树状态、实际命令与退出码、视觉截图、短录屏、自动化矩阵、待人工验收清单。不得自动发布npm、推送、安装到日常profile或启动真实付费模型任务。

## 5. 现有验证命令与新增命令

以下是本次审阅已见的现有入口。按环境与脚本要求运行；不把未执行命令列为已通过。

```powershell
node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs
node scripts/typecheck.mjs
node scripts/ai-village-release.mjs
node scripts/ai-village-v061-browser.mjs
node scripts/ai-village-v06-browser.mjs
node scripts/ai-village-v06-neighborhood-browser.mjs
node scripts/ai-village-v061-performance.mjs
node scripts/pack.mjs --only=ai-village
node scripts/smoke-packed.mjs --exclude-sandbox
node scripts/offline-install-check.mjs --exclude-sandbox
git diff --check
```

UI定位/流程变化需要更新旧浏览器测试的导航步骤，但保留行为断言的强度。不能删除失败断言、扩大超时掩盖死锁、把旧场景截图当新结果。

计划新增并实际实现后才运行：

```powershell
node scripts/ai-village-ui-v1-browser.mjs
node scripts/ai-village-ui-v1-visual.mjs
```

复用已有测试infra/profile/官方基线，不下载浏览器。发布脚本与source预览不同入口都应验证，单独开发页成功不代表DSH嵌入成功。

本轮不自动执行未带安全参数的一小时soak脚本；仓库明确记录用户暂缓。Windows真实缩放、真实IME、睡眠和物理多屏等未执行项独立列出。

## 6. 证据文件结构

```text
docs/ai-village/ui-v1/
  DESIGN_SPEC.md
  IMPLEMENTATION_PLAN.md
  ACCEPTANCE_MATRIX.md
  DECISION_LOG.md          # 只记必要技术适配，不重开产品选型
  RESULTS.md
packages/ai-village/art/QA/ui-v1/
  acceptance-summary.json
  visual/                 # 尺寸_主题_语言_状态.png
  interaction/            # 拖动/布置/拍照短录屏
  performance.json
  manual-pending.md
```

完整日志、profile、token、CDP地址凭据、临时照片放原`.build/`忽略目录；只提交去敏后的稳定证据。新测试数据必须synthetic，不读取真实会话。

## 7. 实施偏差的处理规则

允许：函数名/目录随当前源码做等价映射，新增纯内部helper，修复实现中确证的投影/清理bug并补测试。

不允许：重新选玩法、删既有内容、改四主入口、强制覆盖用户主题、把锚点变XY、把未知保存结果当失败重试、借UI改造重写存储/寻路/宿主协调、引入模型API或网络资源。

遇到现有失败先记录“基线已有”，能隔离时继续；由本轮引入的失败必须修复。最终未完成项用BLOCKED/NOT RUN/FAIL分别记录原因，不把“基本完成”作为通过状态。
