# rc.3 A6 恢复审计

2026-10-26。本次只读审计原请求 A1–A6、当前源码、RESULTS/HANDOFF、pre5 构建与原生证据；仅新增本文，不修改产品、旧报告或正式 rc.2 包。本轮授权仅恢复 A6 及此前剩余工作，**B 不在授权范围内**。本文是恢复时的缺口快照，不是新增验收通过证明。

## 结论

现有源码差异足以支持从当前 Git/Live2D 源码建立独立 rc.3 QA 候选，并开展严格类型、专项测试和真实组合验收；不足以直接宣布它们正式兼容。正式 Source Control 0.1.3、Live2D 0.1.2 的 rc.2 manifest、历史包、锁与证据应保持原样。

恢复时有两项明确未关闭的行为门禁：

1. **A3.6 原生 Git/Live2D/Village 组合**：原官方 rc.3 拒绝 Source Control rc.2 engine 后，未完成三插件组合，Live2D 也未继续安装。该拒绝是正确的兼容检查，不是允许绕过的测试故障。
2. **A5 浏览器层角色拖放**：pre5 双 DPR fullplay 的 32 项检查与其实际 runner 未执行角色 pointer down/move/up 拖放；现有原生专项也没有该操作。已有 controller/input-router 单测不能替代原请求明确列出的浏览器拖放。

Village 现有 415 测试、双 DPR 完整玩法、安装/升级/冷恢复/启停/卸载、离线安装和可复现包不因恢复审计自动失效；在源码和包身份保持一致时无需重复全套。

## Git/Live2D 的源码依赖证据

基础证据见 [A1 完整差异](DSH_0.2.1_RC3_DIFF.md)。本次额外使用独立官方 Git 副本，对 rc.2 `687f282e8625c6b8d11ff58211a90524be2e4317` 与 rc.3 `1f81c047fc48fa190a683e469daa699857e9afe8` 执行目录 tree 比较及实际 diff：

| 实际消费方/接口 | 证据与影响 |
| --- | --- |
| 三插件 HeaderLauncher、shell.overlay、locale、connection/reset、uiSession | A1 已证明 connection、ui-layout、ui-renderer、ui-slots、locale、ui-session 整目录相同。Header corner marker 保留，More 位于独立行；仍须验证三入口同时存在的实际宽度、重建迁移与撤销。 |
| Git Host `workspaceRegistry.list().map(w => w.path)` | `packages/workspace/workspace/src` 两版本共同 tree `45be3ccdbcb3c13e9a4cb86b7b612db0b8362f38`。来源为 `packages/source-control/src/index.ts:53`，可信根仍由配置和登记 workspace 提供。 |
| Git `settings.section` | `packages/client/ui-settings/src` 共同 tree `6bcf51fa271b5763ac4adf713a6a32087ab6bb73`。不需要替换设置页接口。 |
| Git `useWorkspaces` / session cwd | `ui-workspace/src/client/contract` 共同 tree `cc317b0aa0921325ebf89e83617d06dff9256b06`；该包 src 的实际变动仅 navigation.ts。Git `client/index.ts` 只读 items/sessionIds/path 与 useSessions cwd，没有调用变化的 startSession/openWorkspace 草稿路径。实际会话切换与可信仓库映射仍须专项验证。 |
| UI primitives | Menu、Tooltip 与图标有 rc.3 变化，不能将整个 primitives 宣称相同。现有真实 rc.3 Header/Menu 组件测试只证明 Village 入口与该组件的关系，不证明三插件 Desktop 组合。 |
| Live2D Host/Client | Host 使用同一 authenticated connection/request；Client 使用相同 slots、selection、connection.state、useSessionStatus。其 iframe/Core/资源及释放逻辑属于插件自身，仍需用 rc.3 候选的实际 bundle 验证。 |

目前 415 测试的 rc.3 配置只额外包含 Live2D `registration.client.spec.tsx`、`floating-layout.client.spec.ts`；没有包含 Source Control 测试，也不等于 Live2D Host/HTTP/资源/iframe 全套通过。QA 通道至少应覆盖两包实际类型与构建，以及现有 registration、layout、lifecycle、HTTP；Git 的 project/service 和 Live2D 的 resources/bridge/panel 是有意义的现成专项，不能把旧 rc.2 结果改名算作新结果。

## 独立 QA 候选必须具备的身份

- 在新的独立目录从当前源码重建，采用固定 rc.3 source/runtime；不能只解包旧 tgz 更改 engine。使用独立、明确标为 QA 的版本/文件名，正式 rc.2 package.json、lib、tgz、manifest 与历史锁保持原样。
- 精确声明 QA 候选的 DSH engine 与相关 peer；官方插件管理器正常安装，不允许强制安装、不改官方包管理器或安全检查。候选完成的是这次组合资格，不自动宣称所有功能正式发行兼容。
- 每个候选记录源文件 hash 集合、原始 manifest 与 QA manifest 差异、实际 build/test 命令、官方完整 revision/归档 hash、runtime lock hash、工具版本、生成 bundle/资源 hash、tgz SHA-256。安装后核对真实 profile 中 lib/assets 与该 tgz 一致。
- 解析依赖应明确落到 rc.3 独立通道；缺少显式包时不得悄悄回落仓库 rc.2 node_modules。Cordis/React 保持宿主实例，不把第二套服务身份塞进客户端。
- 不运行全仓 `scripts/build.mjs` 来产生 QA 包：它会准备旧官方 worker 并重建正式包目录。独立通道应只产出此次两包 QA 文件。

## 本轮原生组合必须证明

使用原字节官方 rc.3 Desktop 与隔离 profile，固定 Village pre5 包和两个 QA 包的 SHA；无需模型或联网仓库操作。

| 操作 | 需要的实际断言 |
| --- | --- |
| 正常安装并启用三包 | 官方管理器接受并加载；每包版本/hash 可追溯；无重复 Host/Client，无页面加载错误。 |
| 三个 Launcher + More | corner 中各一个，顺序及点击可达；已有非空会话和 New Session 重建后仍唯一；Conversation More 不被遮挡。 |
| Git + Village | Git 上、小院下同时可见，实际边界无互相覆盖或遮挡 composer；Git 展开/关闭不关闭世界；使用新临时仓库验证公开 status/diff 只读路径和当前 workspace 映射，禁止对用户项目执行写入。 |
| Git + Live2D | Git 保持显示，Live2D 真实 iframe/模型首帧可见；不能仅以空容器代替成功。 |
| Village ↔ Live2D | 双向显式打开互斥，旧 iframe/资源被撤销；Git不参与互斥；返回 Village 保持同一 world/profile 与已确认长期事实，已暂停世界可进行精确比较。 |
| Sidebar、会话、草稿 | 三包加载下 Sidebar 隐藏/恢复浮窗，真实 existing→NewSession 后草稿不变；重建不叠加 Launcher。 |
| 停用/重启用与关闭 | 关闭或停用一包不会破坏其余入口/面板；重复启用不积累 DOM、资源或事件。卸载测试只作用于 QA profile 并保留 Village 数据。 |

组合记录应保存各次真实断言、截图状态、错误、所用 SHA 与清理结果。截图失败明确标记 NOT_CAPTURED；不能靠手工插入 DOM、改 Host 状态或改世界 JSON 达成 PASS。

## 拖放补测与已有 A4 覆盖映射

角色拖放建议作为同包补充浏览器/原生用例，保留原 fullplay 证据。七人庭院先暂停读取坐标与长期事实；通过 UI 恢复后，对实际 iframe canvas 发送真实鼠标按下、越过 5 CSS px 阈值移动、释放至合法空地，确认实际角色落点及保存，然后再次暂停检查。可通过真实拖回恢复布局；不要用 API/内存写入替代操作。记录 DPR、画布变换、起终点、包 SHA 和草稿保持。若只运行一个 DPR，不能宣称拖放双 DPR 已覆盖。

**暂停态不允许角色拖放。** `input-router.client.spec.ts` 已明确 paused resident 仅在 pointer-up 选择；因此“暂停后拖不动”不是产品回归。可独立确认暂停拖动不改变位置。未暂停时其他居民和模拟时钟可以合法推进，不能对整个世界做错误的字节相等断言；应核对成员/worldId/长期事实及被拖角色的真实结果。

| 原请求范围 | 已有证据层次；不能扩称 |
| --- | --- |
| 十二位名册、七人上限 | pre5 原始报告中 roster、roster-expansion、roster-panel 共7项通过；多人场景实际活动另见双DPR七人记录。 |
| 地图、三场景与点击行走 | regions、region-assets、region-frame、region-panel 共20项通过，manual-move 7项通过；双DPR记录包含实际三区旅行与共读/茶会路径。真实角色拖放仍为独立缺口。 |
| 家具布置、几何、占用与旧档 | `home.spec.ts` 覆盖48布局、原子确认/冲突、居民占位拒绝、迁移及旧字节保留；`furniture.spec.ts` 验证绘制深度/道具。属于自动化源码回归，不是原生手工布置全流程。 |
| 相册 | `photo-store.spec.ts` 验证真实PNG、去重、有界存储与冷恢复；`album-client.spec.ts` 验证上传/删除丢ACK只读核对、不重放。pre5 fullplay验证真实照片输出，不等于在真实Desktop完成相册保存/删除。 |
| 手账/收藏/关系 | 现有 collection、relationship 和 notification 用例加茶会/共读实际完成证据；无需新增权威数据或重跑已通过全部内容。 |
| IME/Escape/焦点 | 现有原生 IME composition 事件与焦点断言可保留；实体输入法候选框未覆盖，应继续精确注明，不能写成实体输入法人工实测。 |
| 物理睡眠/长期性能 | 现有报告明确未覆盖。它们不是本轮新增组合补测的前置，不能将短软件渲染样本扩称长期硬件资格。 |

以上已核对 pre5 原始 `.build/ai-village-rc3-pre5-tests.json` 的实际 passed 结果：home 8项；photo-store/album-client 共4项；collection 5项；relationship catalog/observation/panel 共10项；entrance/progress 共18项；save-transaction 6项。完整故事/小游戏的 living、play-panel 等亦在该77文件报告中通过。此映射不新增通过数量，也不把单测升格为浏览器或原生证据。

## 独立 QA 脚本静态复核

新增 `scripts/rc3-coexistence-build.mjs` 与 `scripts/rc3-coexistence.vitest.mjs` 已只读检查：独立新 stage 复制源码和测试，官方 rc.3 源码 paths、runtime junction、相关 peer 的实际 rc.3 版本校验，构建只输出 stage；finally 对正式 rc.2 的源码、manifest、README、lib、tgz、dist/manifest 做前后 hash 比较。未发现阻止该构建执行的生产目录修改。

需在结果收束时如实列出 Source Control 的 Hg 条件跳过情况：现有 service 测试在 Hg 不可用时 skip，exit code 0 不能描述为零跳过或所有 Git/Hg 功能均通过。建议 QA 身份同时记录工具版本、build/test 脚本 hash 与 source-ui lock hash。静态复核不替代候选实际构建、测试和原生安装结果。

## A6 正式检查点与文档收束

当前 Village 文件重新只读计算的 SHA256 仍为 `c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760`。如果此次只增加 QA 工具/证据而不改 Village 产物，可继续绑定现有 53,670,374 B 的 pre5；如改动 Village 产品或包内内容，应建立新候选身份并重跑受影响门禁，不能沿用旧 hash。

1. 在 [RESULTS](DSH_0.2.1_RC3_RESULTS.md) 新增本轮恢复段与新证据链接，分别关闭原生组合和真实拖放；不覆盖原失败/阻塞记录，不把 QA 候选当成正式 Git/Live2D 升级。
2. 新检查点应绑定最终 HEAD **及未提交工作树身份**、Village 与两个 QA tgz SHA、源码/依赖/工具身份、测试摘要、实际 Desktop 安装器与 app.asar hash。开源 tag commit 和 Desktop 内嵌 build commit 继续分列。
3. HEAD 当前仍为 `ead9a0fb97631bf651421ebac9e1e6ab78012950`，不能只用它冒充本轮未提交适配代码身份。现有包内逐文件 hash 和暂停源码快照已提供基础；恢复结束后应保存新的、可追踪的最终检查点，不改旧 checkpoint.json 的历史含义。
4. 更新 README/HANDOFF 的当前状态，明确用户只恢复 A6；结束后仍停在 A 阶段，不恢复“自动进入 B”。B 未实现的事实不改变。
5. 成功或阻塞收束时只停止已核实的 QA PID/端口，保留新旧 profile/世界/证据。任何未完成项保留为未关闭；只有实际门禁均满足才将 A6 标为通过。

本审计没有重跑 Village 全套测试，没有改正式 Git/Live2D 兼容声明，没有访问日常 DSH_HOME。

## 恢复收尾复核

后续独立复核确认 `coexistence-qa03-01` 的真实三插件布局、Git临时仓库status/diff、Live2D animated、双向互斥及Sidebar/草稿结果成立；空间回收、启停和冷恢复专项也通过。

审计拒绝采纳 `drag-pre5-05`：其鼠标路径仅2.14 CSS px，低于5px拖拽阈值，前后角色坐标完全相同；原runner的PASS不代表验收通过。新 `drag-pre5-06` 强制鼠标路径大于20 CSS px、生产gesture为actor且moved、选中角色身份不变及实际位移大于20世界像素。实际合法路径210.39 CSS px、角色位移222.76世界像素，r144同operationId确认新坐标；非法路径320.63 CSS px也真实进入拖拽并返回原位置，七人、长期事实、草稿、存档身份和磁盘hash保持。独立数值及代码复核确认此项足够关闭A5，实际DPR1.75，不冒称双DPR拖放。

原始失败与05假阳性保留、明确排除；最终清理、检查点及A6结论以 [实施记录](DSH_0.2.1_RC3_RESULTS.md) 和新的原生汇总为准。
