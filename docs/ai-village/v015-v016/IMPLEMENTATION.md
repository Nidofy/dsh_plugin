# 0.15–0.16 场景故事迭代

2026-10-29。基线 HEAD `37203e4bceb1dd9fd6573269104a8f97e2fcaecf`，分支 `codex/feature-ai-village-entrance`。历史包为 0.14.0-preview.6 / DSH 0.2.1-rc.3 / world15 / content11 / region2 / frame12。以源码及包身份为准，根 README 的旧版本段落不覆盖当前实现。

## M0 差异表

| 目标 | 开始时状态 | 核对与本轮措施 |
| --- | --- | --- |
| 十二人、最多七人、三地区、地图、行走 | 已完成 | 保留原 owner、区域几何与旅行规则 |
| 茶香书签/倒影寻形路径、动作、CAS、回忆 | 已完成 | 场景物件尚不可操作；从现有状态机接入 |
| 茶香书签物件操作 | 部分完成 | 原纸签仅绘制；增加统一命中、短标签、单手势路由 |
| 六组指定居民故事 | 未实现 | 复用 afternoon 单 active；每组内容和有效操作不同 |
| 日记三地区章节 | 未实现 | 章节结束确认后旅行；已保存章节事实作为准入 |
| 手账/关系/收藏/相册统一组织 | 部分完成 | 原入口分散；只新增统一展示层 |
| 蓝鲸四方向动作 | 已有候选但尚未实际验收通过 | 保留候选，禁止冒充正式动画；独立审查与制作规格 |
| 真实 Desktop 新版本、性能和离线发行 | 未验收 | 历史446项/原生记录仅为旧版证据，必须重新验收 |

M0 实际试玩及截图见 [qa.md](qa.md)。空 profile DPR2 完成首次进入、入住、三地地图、找鲸、手账、隐藏/暂停与冷恢复；原纸签过小且无可点提示，故事面板遮挡主要角色。隔离浏览器使用真实 Host 和生产 UI，不注入进度。

## 文件所有权

- 主线程：frame protocol / input-router / scene、scene-interactions、Runtime、UI 接入和最终集成。
- content：afternoon catalog/state/engine、冻结 codec、新世界迁移与内容专属测试。
- art_audit：新候选目录、美术审查；CommunityJournal、ui-state、relationship-panel 分页。
- qa：新 v015 runner、独立基线/新版本证据。

开始时已有未跟踪的两份历史文档、afternoon/browser 各旧失败轮次和 output/ 均保留，非本轮所有。没有切换分支、清理工作区、修改真实 DSH_HOME、远端发布或改 Desktop 宿主源码。

## M1 契约

`sceneInteractions(world)` 是只读投影，包含稳定 ID、区域、世界坐标圆形命中、优先级、标签和合法命令。绘制和 Runtime 命中共享该函数。新 Frame13 `story-object` 只传 ID/token/point，不接受奖励或世界状态；父层再次检查几何、当前 token、暂停、遮罩、编辑、拍照、事务状态。

输入优先级：家具编辑/遮罩 → 中键或空格镜头 → 故事物件 → 棋盘/找鲸 → 居民 → 地面。一个手势只走一个分支；抬起时重验同 ID/token，拖动超过5px、失捕获、缩放/resize、Escape取消、暂停都不提交。无键盘故事捷径，IME不消费空格。

纸签读字、叶/波纹选择、压平、挂起分别复用 listen/fold/press/remember，最终回忆与纪念仍由同一 CAS 确认。取消不发奖。纪念回访只引用已保存 eventId。原面板保留辅助操作及无障碍入口。新道具目前为明确的代码矢量交互展示，不宣称新正式位图已签收。

M1 初步：严格类型/生产构建通过，原输入及 afternoon 集成16项通过；新增场景链与输入边界11项通过（含原输入测试）。真实场景完整验收进行中，结论以对应 result.json 为准。

## 发行状态

M1 内部检查点 0.15.0-preview.1 已通过双 DPR 场景链，历史包及失败轮次保留。后续候选为 0.16.0-preview.2。最终版本、包身份、完整门禁与剩余项见 [HANDOFF.md](HANDOFF.md)，不将 M5 未合格动画视为完成。

## M2/M3 数据与操作

world16/content12/afternoon2 在原 afternoon 事件增加一个有界 step；旧两故事保持 step=0 和旧动作。新六组及日记三章使用同一 active、路径、观察阶段、CAS 和首次 memory。每组两至三次有效操作，错误选项只改变有界尝试次数，不推进步骤；成功后清除当前步骤错误。serial 始终单调递增，旧 token 拒绝。

日记拥有稳定 arc `lost-diary` 和 `page/tea/home` 章节目录，保存事实分别对应三个稳定 story ID；下一章要求前章首次 memory 已存在且完成时刻合法。没有独立跨区 world、时钟、RNG 或任务写入器。前两章 placement=null，最后一章才获纪念。存档仍为48KiB上限，九条新增事实的七人测试存档小于12KiB。旧 world15、afternoon1、community 来源校验独立冻结；读取迁移不修改旧原件。

六组动机、角色文本、有效步骤和章节规则见 [content.md](content.md)。手账展示与来源边界见 [journal.md](journal.md)。新事件期间成员增减明确拒绝，参与者拖放仍拒绝隐式取消；选择在场居民保持可用。新故事使用真实家具附近候选脚点；旧两条故事的路线排序保留。

## M5 真实范围

正式三场景与角色原图继续复用。场景操作纸物为代码矢量，绘制、命中、奖励展示均处于世界坐标系；确认纪念在拍照时仍绘制，交互轮廓/文字在拍照时隐藏。无新增一级常驻入口。

双 DPR 实测发现并修复气泡遮挡、标签太小、无空格中文溢出和结束语遗漏。当前操作说明集中在顶部，场景保留短标签、选中和错误/成功表情，收尾物件跟随收尾脚点。新透明日记页、书签候选及方向动画审查见 [art.md](art.md)。候选未启用；蓝鲸正式四方向、足底配准和手部接触原画仍待制作与签收。

## M6 已执行

- 最终 pre2 严格官方 rc.3 Host/Client/public declaration 类型及 release 构建通过。
- 最终 pre2 84 文件 / 470 测试通过，日志 `validation/tests-pre2.log`。历史未来版本负例更新为17，旧fixture、坏档拒绝和原字节保护未放宽。
- 实际旧包 Host 写world14及三种world15，升级、只读不改原字节、一次CAS、幂等/冲突、冷恢复4/4通过，绑定pre2，见 `validation/host-upgrade-pre2-confirmed.log`。旧无confirmed日志因脚本默认候选实际为pre1，不作为pre2证据，保留原件。
- 空store官方 runProfilePnpm 离线安装、398文件解包/资源逐字节检查通过，见 `validation/offline-pre2.log` 与 `../compatibility/0.16.0-preview.2/package-identity.json`。
- 长期模拟覆盖六组七人在场、十二名册、三区域，36000模拟tick，两副本与周期冷读完全一致；有界近期历史、原首次事实保留，剧情结束后恢复普通活动。
- 原生及浏览器最终结果持续收集于 `native/`、`baseline/`，具体PASS范围以 [HANDOFF.md](HANDOFF.md) 为准。
