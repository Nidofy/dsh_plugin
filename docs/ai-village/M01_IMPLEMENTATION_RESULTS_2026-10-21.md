# AI 小院 M0/M1 首批实施记录

本轮已完成可运行的内容/布局样板、历史快照基线、一个旧档兼容修复、家具渲染解耦及后续状态契约。**这是 0.4 的第一批实现，不是 M0/M1 全部放行，也不是可安装的 0.4 版本。** 42 组稠密路径试验与美术检查仍有明确待解决项。

依据：[综合实施方案](CONTENT_UI_IMPLEMENTATION_PLAN_2026-10-21.md)。代码全部在 `dsh_plugin`；没有修改 Desktop 宿主或日常 profile，没有重打/覆盖现有 `dist` 包，没有提交或推送。

## 已实现

| 交付 | 实际行为 | 位置 |
| --- | --- | --- |
| 双座几何 | 单桌左右两席，真实原版寻路和到位检测；七人使用原有纸娃娃、动作与资源 | `experiments/content-ui/scene.ts` |
| 茶会样板 | 选择两人及食物→同时分配两席→双方到齐→5 秒交流→一次内存手账/风铃；取消/遇阻不发奖 | `experiments/content-ui/model.ts` |
| 内容 UI | 伙伴/心愿/布置/手账；340px 浮卡与展开；中英、深浅；同一 frame、同一世界时钟 | `experiments/content-ui/client.ts`、`index.html`、`style.css` |
| 风铃草稿 | 三槽位预览、撤销、Esc、确认；编辑暂停世界；确认后显示反应 | 同上，仅本页内存 |
| 家具渲染 | 从单一碗和固定手臂深度，改为按家具/座位计算；legacy 默认坐标保持 | `src/frame/furniture.ts`、`scene.ts` |
| 原版旧档修复 | schema 1 缺 facing 时默认 right；schema 2/3 缺失仍拒绝；不修改原快照字节 | `src/core/world.ts` |
| 历史证据 | 真实隔离测试的 schema 1/2/3 快照及 scene 1，全有原始 hash；非伪造新结构 | `tests/fixtures/legacy/` |
| 契约 | schema 4 最小结构、提交回执、命令、视口字段与容量上界 | [状态契约](V04_STATE_CONTRACT.md)、`experiments/content-ui/contracts.ts` |

样板 UI 和模型没有导入正式插件入口，也没有连接 save 路由。正式包场景仍是 scene 1，正式世界仍是 schema 3。生产源码本轮只增加通用家具绘制、缩窄 frame bridge 所需接口，以及上述旧档兼容修复。

## 直接运行

在仓库根目录：

```powershell
npm run village:content:serve
```

打开 <http://127.0.0.1:18753>。服务只监听本机，固定静态文件路由，没有存档写接口；Ctrl+C 结束。

推荐体验：心愿→保持默认 DeepSeek/Claude→选择食物并邀请→等待实际同桌→布置→尝试三个位置→撤销或确认→手账。选择其他组合时可能被旁人挡住，页面会给出中止原因。刷新或点击重置会清空样板进度。

自动化与基线命令：

```powershell
npm run village:baseline
npm run village:content:check
node scripts/ai-village-phase4.mjs check
git diff --check
```

baseline 的 `freeze` 参数只用于首次收集旧测试快照，使用排他创建，不应在后续日常验证中重复执行。普通 baseline 会核验冻结文件 hash 并比较当前本地 lib 与既有 tgz。

## 样张

- [双人到位与交流](../../packages/ai-village/art/QA/content-ui-m01/tea-two-seats.png)
- [340px 浮卡](../../packages/ai-village/art/QA/content-ui-m01/compact-light.png)
- [深色英文展开](../../packages/ai-village/art/QA/content-ui-m01/expanded-dark-en.png)
- [风铃确认与角色反应](../../packages/ai-village/art/QA/content-ui-m01/wind-chime.png)

已逐张查看上述样张。角色使用现有真实资产；桌面是原片加宽的几何样板，茶点仍显示旧饭碗手型，风铃为定位 SVG，尚未完成正式美术。

背景 cover 与世界 contain 的组合会让“窗边”锚点落到地面。因此样板把场景框约束为 3:4，展开两侧留白，保留完整的窗/门并让挂点保持一致。正式版本须在此方案与单独的背景装饰投影之间做实现选择，不可直接恢复任意裁剪而沿用这些挂点。

## 基线核对结果

基线 HEAD：`301cc0feb6bbf3dd71ac8c2f6c7e8817ef49a875`；包 0.3.2；DSH 0.2.1-rc.2；固定官方 revision `687f282e8625c6b8d11ff58211a90524be2e4317`。

原始 tgz：28,956,910 字节；SHA-256 `3edfb45ea6b56b8ac3fdb8769edeb631e18a40cdd32b3ea1050eb1d032d401a0`。

| 核对对象 | 本地产物与现有 tgz |
| --- | --- |
| lib/index.js | 一致 |
| lib/frame.js | 一致；这是本轮构建前的包目录 lib，新的验证构建输出到 .build |
| scene.json | 一致 |
| lib/client.js | 不一致：本地 `475f19ea…`，tgz `391a0011…` |
| 实际 Desktop 安装 | 未读取，不能据 dist 包推断用户正在运行的版本 |

完整摘要见 [baseline.json](../../packages/ai-village/art/QA/content-ui-m01/baseline.json)。README 的安装文件名已从 0.3.1 校正为 0.3.2，旧“正式交付 0.2.1”说明也已校正。

## 验证结果与边界

| 检查 | 结果 |
| --- | --- |
| 原始相关基线 | 12 文件、28 测试通过 |
| 新增后的相关回归 | 16 文件、41 测试通过 |
| 固定官方严格 TypeScript | Host/Client 和新增 content-ui 目录通过 |
| 正式 Host/Client/Frame 构建 | 通过 |
| 原版接入浏览器验收 | 通过：七人/21 活动摆放、50 次 sidebar 切换、会话保留、Git/Live2D 协作、高分屏、重连/恢复、主聊天焦点与草稿、跨窗口 owner |
| 候选打包/解包 | `.build/ai-village-phase4/phase4-integration.tgz` 解包及 Host owner smoke 通过 |
| 独立样板浏览器 | 默认双人闭环、三槽位/撤销/Esc/确认、暂停、340px/展开、深浅/中英、800px、DPR 2、同一 iframe 和聊天草稿保留通过 |
| 浏览器外网/错误 | 样板与原版接入验收均为 0 外网请求、0 pageerror |
| 存档兼容修复 | 原始 schema 1 缺 facing 的 read/save/previous/recover/prune 回归通过；35 次继续保存后原字节仍保留 |
| 容量 | 满结构的 world≤48KiB、save/Saved/state≤64KiB；尚不是 schema 4 运行时验证器 |

样板目前仍加载全部 130 张纹理，无新增 PNG，Pixi 自带 ticker 未启动。最近一次软件 WebGL 样本 183 帧，平均 paint 约 1.18ms，最大约 117.5ms；包含初始化/布局成本，不是硬件 GPU 帧率承诺。完整浏览器数据见 [validation.json](../../packages/ai-village/art/QA/content-ui-m01/validation.json)。

没有执行全仓库 release 流程、真实 Desktop 的新 UI 安装验收或断电恢复。旧插件的自动化通过不能替代新内容的冷启动/持久化验收。

## 实验揭示的风险

**静态路径可达，不等于七人同时活动时能成功入座。** 两个座位从七个起点的静态路线全部可达，逐段不穿越障碍；但将两名角色按左右席顺序遍历 42 种组合，只有 11 组完成，31 组因沿用旧规则“碰到角色立即放弃”而中止。全部试验有界结束，失败没有发奖，详见 [pair-probe.json](../../packages/ai-village/art/QA/content-ui-m01/pair-probe.json)。

该结果是风险探测，不是“42 组验收通过”。M3 必须加入事件路径的有界等待、错峰入座与重规划，并重新检查桌前通道/第三人让行；不能用瞬移角色或缩小碰撞半径掩盖问题。

另外几项尚未完成：

- 正式 scene 2 几何尚未冻结；本轮 geometry probe 会取消旧活动，只能测试重安置，不能作为生产迁移。
- UI 样板不是正式 `Floating.tsx` 集成，尚未解除旧 764px 浮卡门槛，也没有把独立页的控制接入真实 owner。
- 所有故事、解锁、风铃在本页内存；schema 4、升级保护引用和 pending/unknown 提交机制仅有契约。
- 样板活动期间禁拖，正式暂挂/恢复语义待 M3；样板完成一次后不可再次邀请，正式重复活动待实现。
- 茶点/米饭资产未区分；七人专属台词和第三分支未制作；风铃反应是通用短句。
- 样板列表显示七人在场，不提供正式在场管理、赠礼、照片或未实现的设置按钮。

## 后续落地顺序

1. **M2 持久化基础**：历史版本解码分发、schema4 纯迁移、升级前保护引用、关键提交回执；先把 current/previous/recover/prune 全路径做通。
2. **M3 事件规则**：两席原子预留、有界重规划与错峰、拖动语义、单次结算；将 42 组路径结果作为回归基线，并扩展到活动中的阻路场景。
3. **M1 美术收敛与 M4 接入**：正式双座/茶具/风铃和双语内容；在真实 runtime 中复用已验证界面结构，接 frame v2，移除内存模型。
4. **M5/M6**：性能与长时试玩、隔离 Desktop 安装、重启恢复、全仓构建打包及 0.4.0 发布记录。

本轮没有要求用户额外确认，也没有把样板生成包当成正式版本。后续可以直接按以上依赖继续实施。
