# AI 小院：实施方案与路线

日期：2026-10-20。状态：P0–P5 已完成。用户已依次验收 P1、P2、P3，并授权补齐所有角色、增加角色选择、直接完成 P5，不再设置中途验收。最终范围与实际证据见 [阶段 5 结果](PHASE5_RESULTS.md) 和 [角色资源记录](ROSTER_ASSETS.md)。下文保留最初技术路线，涉及单角色首版的规划由本段范围更新替代。

仓库：`D:\Documents\FeiyangChen\devApps\dsh_plugin`。
审阅起点：`main` / `d4dd0e7e0a7f55671aba5568ca69303102a8818c`，初始工作树干净。
P0 三份文档已提交为 `0fb91a4` 并推送 GitHub main；P1 实施位于 `codex/ai-village-phase1`。

相关文档：[资源审计](ART_AUDIT.md)、[资产计划](ASSET_PLAN.md)。

## 目标与首版边界

独立 `@nidofy/dsh-ai-village` 包，源码目录 `packages/ai-village`。最终交付 DeepSeek、Claude、Gemini、GPT、Grok、Kimi、千问七名 Q 版角色和一个场景，完成待机、闲逛、抓起拖放、普通地面放置，以及工作桌、米饭桌、休息坐垫三种地点行为。按用户“共存或者切换”的要求采用角色选择；同一时间一位伙伴，不引入多人调度。

入口沿用会话工具栏与右侧浮卡。sidebar 展开、其他浮卡占位、窗口隐藏或空间不足时停止游戏；回来延续原世界。切聊天不创建新世界。关闭浮卡保留当前进度。

首版不增加经营数值、任务、背包、换装、多人、在线社区、音频或真实模型调用。工作与 DeepSleep 都是游戏动作。未来仅预留稳定角色、场景和行为 ID。

## 技术选择

采用 TypeScript、现有 React/Cordis 插件壳、固定版本 PixiJS 8、分层透明 PNG、JSON 动作与场景定义。PixiJS 的 Container 适合部件层级，Sprite/渲染排序适合纸娃娃与家具遮挡；输入在 Canvas 上保留 DOM Pointer Events 捕获路径。

仅实现一套正式渲染器。初始选择 WebGL，30 FPS 为调校目标，隐藏停止绘制与模拟；具体性能和资源上限须实测。PixiJS 在构建期准备并锁定精确版本，打入离线 frame bundle，不从 CDN 加载。P1 已在 ai-village 的独立 package.json/lock 中固定 PixiJS 8.22.0，通过离线 iframe 构建与渲染试验。

P1 的 tsdown 构建和许可证清单已经通过，保留 PixiJS 路线；仍需后续真实 Desktop 和性能验证。

本轮核对的上游接口资料：

- [PixiJS Container](https://pixijs.com/8.x/guides/components/scene-objects/container)
- [PixiJS Events](https://pixijs.com/8.x/guides/components/events)
- [PixiJS Ticker](https://pixijs.com/8.x/guides/components/ticker)
- [DOM setPointerCapture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)

Live2D 现有资源保留为参考，不引入 Cubism 游戏依赖。现有模型既不符合最终头身比例，也缺少游戏腿脚与坐姿，接入 Core 不能补足这些能力。

## 代码职责和状态所有者

```text
DSH Client 插件实例
  ├─ 浮卡协调 / 显隐 / 双语入口
  ├─ WorldStore：唯一内存世界，与 sessionId / React key 无关
  ├─ Simulation：固定步长、seeded RNG、行为、落点、暂停
  └─ FrameBridge ←→ sandbox iframe：Pixi 渲染、局部指针输入
          │
          └─ 已认证 connection/request
                    ↓
              Host SaveStore：profile 身份、写入者、修订、磁盘
```

这是拟定的插件内模块，不是宣称 DSH 存在同名官方服务。

| 模块 | 责任 |
| --- | --- |
| `core/world.ts` | 世界、稳定 actor ID、逻辑时钟、随机状态、最近安全落点 |
| `core/simulation.ts` | 纯函数/可测状态机；不 import DSH、React、Pixi |
| `core/placement.ts` | 地面与热点命中、碰撞、合法回退、简单可达路径 |
| `client/controller.ts` | 持有 WorldStore/Simulation，接收显隐与输入，不随会话组件卸载 |
| `client/Floating.tsx` | 标题、暂停/继续、关闭、保存状态与场景区域 |
| `client/bridge.ts` | 资源、绘制快照、输入意图的窄消息协议 |
| `frame/` | 图层、关键帧、表情、遮挡和 Canvas 指针捕获；不持久化世界 |
| `host/` | 固定资源路由、存档校验、单写入者、原子提交与恢复 |

行为采用 idle、wander、pickup、dragging、put_down、work、eat、rest。拖动作为可回滚事务处理。动作剩余时间、运动目标和必要动画相位属于可恢复的世界状态；不能只留在 renderer 内。

每次开始隐藏，先在 WorldStore 回滚未提交拖动，再停止计时并撤销图形资源。显示后从同一内存状态重建画面，逻辑时间不追赶现实时间。真正的客户端卸载、页面刷新和进程重启只能恢复最近成功存档，不承诺保留已经销毁的内存。

## 已核实的 DSH 接入点与改动范围

当前本地源码已证实：

- `packages/live2d/src/client/index.ts` 注册 `shell.overlay` 和 `conversation.session.header.utilities`。
- Live2D 的 Surface 使用 session key 与 connection generation 重新挂载；游戏不能复制此世界生命周期。
- `Floating.tsx` 在不可见时移除内容；`floating-layout.ts` 根据官方 sidebar 标记及可用宽度计算区域，撤销自己的留白。
- Live2D 仅响应 `source-control`，Git 仅响应 `live2d` 的 `nidofy:floating-panel-open`。
- Live2D Host 通过 `connection/request` 提供白名单资源，iframe 为不透明来源；现有 bridge 没有游戏输入/存档协议。
- `build.config.json` 之外，typecheck、pack 和 smoke 脚本也有包名单/资源专用逻辑；新增目录不会自动进入全部交付步骤。

因此实现时：

1. 游戏显式打开广播 `ai-village`；Git/Live2D 接受已知其他面板 ID 后让出位置。游戏打开意图、当前占位者和暂停分别管理。
2. 最后一次显式打开者拥有右侧区域。sidebar 临时展开后可恢复；被其他卡片替换后不因布局变化抢回位置。
3. 共用展示事件约定，避免复制业务逻辑；先做最小修改，不提前重写全局布局系统。验证任何时刻最多一份留白。
4. 所有 listener、observer、request、RAF/ticker、纹理、Blob URL、iframe 都纳入 ctx 生命周期清理。
5. 保持主对话、草稿、附件、IME 和审批键盘行为。游戏中英文文案，Esc 只在自身作用域按消费状态处理。
6. 首轮不需要修改 dshWinUi/electron 或官方安装目录。

兼容验证先以现有 Live2D 的固定官方 `0.2.1-rc.2` 基线
`687f282e8625c6b8d11ff58211a90524be2e4317` 为目标；只有另行通过旧版本回归后，才在游戏包 engines 中声明 `0.2.0-rc.2` 兼容。仓库全局 compatibility.json 的旧基线不能替代游戏实际验证。

## 拖放、场景与暂停

- 点击/拖动阈值初值 4–6 CSS px；保存抓取偏移和 pointerId，避免跳中心。
- DOM pointer capture 覆盖移出画布；正确区分 pointerup 提交后的 lostcapture 与真正取消。
- CSS 坐标转换包含等比缩放与留边；DPR 只作用于 backing store。
- 热点有 hit region、standing/sitting anchor 和遮挡配置；普通地面自由落地，非法位置回退安全点。
- 简单连通地面与有限导航点足够；每条漫步线段检查家具占地，不引入大型寻路系统。
- pauseReasons 是集合：user、sidebar、hidden-window、other-panel、insufficient-space、closed，以及必要的 disconnected/ownership 状态。清除一个原因不能清除其余原因。
- DSH 布局必须显式发送显隐；不能仅依赖 visibilitychange。
- 顶层失焦要取消拖动；同时区分“焦点进入游戏 iframe”和“应用真正失焦”，避免点击游戏立即暂停。

## 隔离与离线

推荐继续采用 `sandbox="allow-scripts"` 的游戏专用 iframe，允许场景交互，具备可访问名称。禁止直接沿用 Live2D 的 pointer-events:none 或 aria-hidden。

父页面负责唯一世界；frame 仅接收固定资源/渲染快照、上报受限输入意图。校验 source window、null origin、随机实例 token、协议版本、消息大小、序列和数值范围，拒绝迟到旧实例消息。frame 不接触文件路径、模型接口或通用 shell。

资源白名单、MIME、哈希和大小在构建及 Host 两侧核对。Pixi bundle 上限须按实际产物制定，不能照搬 Live2D frame.js 的 256KiB 上限。CSP 禁止外部网络，所有图像由已认证同源通道提供字节后在 frame 内使用。

“离线”指无外部网络/CDN/遥测/模型依赖；DSH 自身的本地或已配置 Host 连接仍承担资源与存档传输。不要把阻断全部通信和阻断互联网混为一谈。

## 存档与多窗口

一个实际 DSH profile 对应一个世界，Host 持有磁盘唯一写入者，客户端必须获得运行所有权。第二个同 profile 窗口显示占用状态，不启动另一份自主模拟。多个 Host 进程还需通过本机跨进程锁/平台已有机制防止争写；仅 JS Promise 队列不够。

P1 已在所选官方源码中核对 `ProfileContext.dir`，以 `<profile.dir>/nidofy-ai-village/` 作为独立存档目录进行试验。现有 desktop-pets 的 `resolveDshHome()/nidofy-extras` 提供仓库惯例，但不能据此假设共享 home 已实现 profile 隔离。游戏数据须独立命名，不改变已有 preferences、notebook 或宠物资源。

保存字段：schemaVersion、worldId、sceneVersion、avatarDefinitionVersion、revision、逻辑时间、稳定位置/朝向/行为与剩余时间、RNG、用户暂停偏好。瞬时 DOM/指针对象与悬空 dragging 不入档。

计划使用带版本的不可变快照与原子 current 指针，保留上一成功版；写入串行并校验 expectedRevision、owner epoch 和 operationId。超时/ACK 不确定时先读状态，不自动重放。连接重置不清空世界；重连校验同 profile 与修订，有冲突则暂停并显示状态。

成功放置、地点行为变化、用户暂停保存；自主漫步采用有界检查点，初值可取 10 秒再调校。写入前做体积和字段校验。卸载尽力完成已接受保存，但不把退出回调作为唯一保障。

损坏、过大、未来 schema、资源 anchor 失效分别处理；保留原档，提供上一版或明确恢复入口。写失败标记“仅内存/保存失败”。

可参考共享库的 CAS 与 durable-file 思路，但 `plugin-shared` 当前带广泛 DSH peers、koffi 和可选原生存储服务；不能为游戏小存档无审查地强制引入整套 notebook/runtime-adapter/native helper。持久化实现和 Windows 原子提交能力在阶段 P0 技术试验中落定。

## 实施顺序与交付门槛

| 阶段 | 工作 | 可评审交付 / 通过条件 |
| --- | --- | --- |
| P0 资源与方案 | 本轮完成 | 三份文档、文件审计；区分旧参考与实际可运行模型 |
| P1 视觉样板与技术试验 | 基准角色、空场景、小尺寸预览；离线 Pixi 构建、profile 路径/单写入者/原子保存最小验证 | 用户确认真实样板；依赖版本与关键技术风险有实测结论 |
| P2 纸娃娃动作 | 部件补绘、配准、四种脸、idle/walk/drag/put_down | 真实动作播放页；透明、关节、96/128px 观感通过 |
| P3 独立场景 | 家具遮挡、工作/吃饭/坐姿、导航、输入、暂停、存档 | 本地离线场景可以实际拖放到三个热点，重载可恢复 |
| P4 DSH 接入 | 三浮卡协调、sidebar、会话/连接、Host 存档桥、卸载 | 固定官方源码回归与浏览器交互证据；无状态重置和布局冲突 |
| P5 打包和真实安装验收 | typecheck、行为测试、build、pack、smoke、临时 Desktop profile 安装 | tgz/哈希/依赖清单/构建身份、截图或录像、实际执行与未验证清单 |

视觉批准来自交接包明确要求。用户已确认 P1、P2、P3，并将新增角色的中途检查委托给实施过程。P4 已完成固定官方源码与真实浏览器回归，详见 [阶段 4 结果](PHASE4_RESULTS.md)。P5 已完成正式打包及隔离官方 Desktop 安装、启停与进程恢复检查，详见 [阶段 5 结果](PHASE5_RESULTS.md)；未覆盖项按该记录保留。

验收重点：

- 拆件重建、透明底、实际小尺寸及六类主要动作。
- sidebar 50 次开合；拖动中隐藏/失焦；用户暂停后隐藏再恢复。
- 切会话、Git/Live2D、连接 reset、关闭再开；原世界保持。
- 非法落点、桌前遮挡、缩放/DPR/窄窗口与 IME。
- 多窗口/多 Host 所有权、保存冲突、磁盘失败、坏档/未来版本、重启恢复。
- 阻断外部网络，游戏运行；隐藏停止模拟与绘制。
- 禁用/重新启用不累积监听器、进程或图形资源。
- 真实 CPU/内存/帧耗时测量；开发页不替代官方 Desktop 安装。

后续可扩展多人同时在场、日程、家具与社区；七角色选择已在本次交付。首版不提前搭建多角色调度、通用资产市场或 LLM 代理系统。
