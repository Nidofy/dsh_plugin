# AI 小院 M2：存档基础与关键提交

日期：2026-10-22（Asia/Shanghai）。继续 [M0/M1 实施](M01_IMPLEMENTATION_RESULTS_2026-10-21.md)。

本轮把 schema 4 迁移、受保护升级引用和关键保存回执落到了源码与测试。**schema 4 codec 已在真实临时磁盘上工作，但尚未切换正式 Host/Controller 的世界格式。** 原入口仍使用 schema 3 / scene 1；七人双座通行尚需 M3 收敛，不能提前把未定稿几何发布给真实存档。

## 1. 已完成的代码

| 文件（相对 packages/ai-village） | 作用 |
| --- | --- |
| `src/core/content-state.ts` | schema 4 类型、白名单、容量与跨字段一致性校验 |
| `src/core/migrations.ts` | 冻结 scene 1 几何；schema 1/2/3→4 纯迁移；可注入的 WorldCodec |
| `src/host/save-store.ts` | 按 codec 读取/保存/恢复/回收；升级前指针保护、受保护版本读取；UTF-8 和 revision 边界 |
| `src/client/save-transaction.ts` | 不可变保存候选、四态回执、ACK 丢失对账、跨 epoch 重新取得 owner 后的核对 |
| `src/client/json-response.ts` | 流式限制 UTF-8 字节数、超限取消读取、拒绝非法 UTF-8 |
| `src/client/runtime.ts` | 接新事务；flush 返回回执；关键候选确认后才替换可见世界；串行等待、断连与卸载处理 |
| `src/host/service.ts` | 保存 ACK 带 profileId/epoch；JSON 响应整体 64KiB 上限 |
| `src/client/Floating.tsx`、`messages.ts` | 中英“确认中/待确认/未接受/最近已确认存档”提示；关键提交期间禁用冲突操作 |

旧样板的 `contracts.ts` 改为复用上述真实类型。普通画面、资产与 M0/M1 茶会内存模型没有变成正式 0.4 玩法。

## 2. schema 4 的拒绝条件

新增状态仍是有界结构，不接受任意 JSON：

- scene 2、规则版本 1、内容版本 1；未知版本明确拒绝。
- 至多 7 人、1 个事件、32 条手账；角色、食物、心愿、奖励、模板和风铃槽位都是白名单。
- 两名事件参与者必须不同、实际在场，且各自持有 eat/left 与 eat/right 意图；talking 阶段要求两人都已到位。
- 手账 ID/事件 ID 不重复，完成 tick 不超过世界 tick，次数为安全正整数。
- 首次完成、手账、wind-chime 解锁、风铃对象及最后完成 ID 必须一致。只有解锁没有手账、只给手账不创建物件等部分更新会被拒绝。
- 布置位置、layoutRevision 与“已摆放”发现标记一致；未解锁不能摆放。
- world 的 UTF-8 序列化不超过 48KiB；完整请求/快照/响应仍受 64KiB 边界限制。

这些校验适用于从文件/网络进入的值，并非只有 TypeScript 声明。它们防止结构不一致；事件究竟何时有资格结算，仍由 M3 的规则引擎控制。

## 3. 迁移行为

先用冻结 scene 1 校验原始快照，再进行纯内存迁移。未知 schema/scene 不会被当成新游戏。

迁移保留 ticks、rng、暂停、选中角色、全部在场角色及合法位置。先预留所有未受影响的位置，再安置新障碍中的角色，防止先移动的角色挤掉本来合法的人。

旧 eat/main 映射到新 eat/left。已经移动的桌/坐垫活动改为前往新位置，重新生成静态可达路线，不瞬移到位。未变书桌上的活动保留 position、phase、remaining 和 expires。找不到安全位置时拒绝迁移；不会把全部角色堆到 spawn，也不会改写原快照。

本轮不替代 M3 的动态避让：重新规划的静态路线仍可能被其他角色挡住。候选 scene 2 改动后必须重新运行全部迁移测试，再决定启用。

## 4. 升级前备份与恢复

`SaveStore` 采用 `WorldCodec<W>` 分离历史读取和当前版本写入。current、previous、save 前置检查、recover、prune 都经同一个 codec，避免只让第一次读取支持迁移。

首次覆盖历史指针前，以原指针字节 SHA-256 命名 `upgrade-v1-<hash>.json`，持久化保存原始指针全文。current 和 previous 都可能是唯一历史证据，因此替换前分别检查。已有引用必须逐字节一致，不会重写一个损坏引用。

回收保护集合包括 current、previous、已有 recovery 引用及完整验证过的 upgrade 引用。升级引用不随最近 32 份窗口被淘汰。引用损坏、hash 不匹配或目标快照异常时停止回收；如果新 current 已发布，清理失败只产生 retention diagnostic，不谎报保存失败。

`readUpgrade(name)` 只接受白名单文件名，并重新核验引用 hash、快照 hash、revision、operationId 和历史世界。恢复此内容需要显式按当前 revision 做 CAS 保存，不能直接把 current 指针回拨到旧 revision。尚未为用户增加“选择升级备份”界面。

在隔离测试中，schema 3 原快照使用可回收的 managed 文件名，迁移后继续保存 40 次；原字节仍存在，通过 upgrade 引用读取后可以发布成一个新的恢复修订。不是依赖旧的非 managed 命名碰巧躲过回收。

## 5. 回执与关键候选

| 状态 | 当前行为 |
| --- | --- |
| idle | 尚无本次提交；界面可显示最近从 Host 读到的已确认 revision |
| pending | 记录 operationId 和不可变候选；关键提交增加 commit-pending 暂停原因 |
| committed | ACK 或对账同时匹配 profile、epoch、operationId、expectedRevision+1 和规范化世界内容 |
| rejected | 明确的参数/CAS/owner 拒绝；不发布候选；保留原因 |
| unknown | 结果不确定，保留候选；阻止后续写入，不自动生成新 operationId 重发 |

ACK 缺失、身份或内容不符时只读取 state 核对。收到另一 epoch 的响应不能直接认作成功；重新连接必须先 acquire 新 owner，再验证这个 owner 返回的 state。新租约已经使旧写入失效后，如果 revision 仍未改变，才能将它归为 SAVE_NOT_COMMITTED。

`commitWorld` 先等待已有保存，再提交候选。成功前可见 controller.world 不变，选择角色、入住、拖动及用户暂停切换不能篡改这个候选。成功后才替换世界。`flush()` 等待完整串行队列并返回终态，不再仅等待 Promise 然后让调用者猜测是否成功。

现有 runtime 的 `commitWorld` 目前校验 schema 3；通用 `SaveTransaction<ContentWorld>` 已用 schema 4 完整奖励候选测试。M3/M4 接入时必须让 controller、快照和 runtime 同步保留 schema 4 元数据，不能强制转成 schema 3 丢弃进度。

卸载等待在途提交，禁止开启新保存；重连不会自动重放未知操作。现有“恢复上一成功版”仍是明确的用户操作；本轮没有增加恢复按钮的自动重试。

## 6. 实际验证

本轮相关完整回归：**19 个测试文件、71 项测试通过**（上轮为 16 文件、41 项）。其中最后新增的卸载等待测试另单独验证，并随最终完整回归计入 71 项。

关键用例：

| 类别 | 已验证 |
| --- | --- |
| 迁移 | 原始 schema 1/2/3 字节、选中身份/时钟/位置、未变工作进度、新障碍重安置、旧 main 席映射、不可安置拒绝 |
| 内容校验 | 部分奖励、重复记录、未知内容 ID、非法参与者、未解锁摆放、未来 tick、大小/版本越界 |
| 磁盘 | current/previous 原件保护、历史 previous 恢复、40 次保存后保护引用仍可恢复、损坏保护引用停止回收 |
| 故障注入 | 写 upgrade/snapshot/previous/current 前失败；current 发布后抛错；候选快照写出后失去 owner |
| 回执 | ACK 丢失、state 也不可用、错误 profile/epoch/operation/revision/内容、重取 owner 后对账、CAS 拒绝、禁止重放 |
| 运行时 | 关键候选确认前不可见、冲突 UI 操作被挡、flush 等待关键提交、unknown 保留候选、跨 Host 重启对账、卸载等待且不新写 |
| 网络边界 | 按 UTF-8 字节限制读取、多字节超限、取消无限流、非法 UTF-8、正式 Host ACK 的 profile/epoch |

执行命令：

```powershell
node scripts/ai-village-phase4.mjs check
node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs --reporter=default --reporter=json --outputFile=.build/ai-village-v0.4-qa/m2/unit-tests.json
git diff --check
```

固定官方严格类型检查、Host/Client/Frame 构建、实际插件浏览器夹具、候选归档解包与 Host owner smoke 已通过。浏览器继续覆盖七人/21 活动摆放、50 次 sidebar 切换、Git/Live2D 共存、聊天草稿、断连恢复和跨窗口 owner；0 个 pageerror、0 个外网请求。

构建输出和临时 profiles 仅在 `.build`。没有重打现有 `dist` 包，没有修改用户真实 DSH_HOME，没有做 npm 发布、Git 提交或推送。未进行真实断电试验、完整新内容的 Desktop 安装或新美术验收；注入写入失败不等同于真实断电验证。

## 7. 下一步

进入 M3：为事件增加有限等待、错峰和重规划，重新跑上一轮的 42 种双人组合；实现正式事件的到位同步、拖动暂挂/解除及结算。随后让 controller/runtime 保留 schema 4 事实，选择经验证的 scene 2 并启用 codec，再把 M0/M1 界面接入真实 owner。当前 localhost:18753 页面仍是内存样板，不应把它的刷新清空误认为正式存档失败。
