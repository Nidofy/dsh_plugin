# 数据、取消与回退

## 版本和所有权

正式代码采用 LivingWorld schema7、scene3、simulationRules4、contentRevision4，Preferences仍3，frame5。`livingWorldCodec`仅验证7的写入；decode依次调用原1–6迁移器。旧home/neighborhood/content解码器和旧规则保留。frame5新增一个找鲸点击意图，仍校验token/source/origin/sequence/viewport以及本次活动令牌；原首帧回执与生产入口选择器不变。

Host仍用现有SaveStore、profile身份、租约/epoch、operationId、CAS、旧current/previous原字节保护。新状态没有另建writer，没有访问真实DSH_HOME。迁移测试对6→7保存42轮后仍验证旧snapshot字节及upgrade指针；另逐一验证1–6纯读取不改输入。

## 新持久字段

| 字段 | 消费者和边界 |
| --- | --- |
| life.social | 最多一个双人短社交；固定模拟时间起止、六种kind、稳定居民ID；控制器与纸娃娃消费；不写手账或心愿 |
| play.active | 最多一项主活动；七个定义、最多四阶段、三参与者、每人最多九路径点；到达期限1800tick，观察60tick，ready才接收玩家操作 |
| play.active.board | 三槽，-1空或0–2物品；禁止重复物品，完成阶段必须全部归位 |
| play.active.choices | 找鲸最多两次hint；茶点恰好三次rice/tea/fruit后才能结尾；其他故事必须为空 |
| play.decorations | 七个闭合ID；window/door/wall/null；必须已有对应完成事实才可摆放；绘制、照片与近处居民观察使用同一坐标 |
| play.nextTick / lastEventId | 短冷却和最近完成ID，首次历史仍存memory.eventId；正常新游玩由runtime生成新UUID，晚回执不重放 |
| neighborhood.memories | 沿用已有首次回忆结构；从11类邻里扩到18类，加原茶会共19类；新定义最多三人，首次tick/成员/eventId不因重玩覆盖 |

世界48KiB、完整封装64KiB限制未变。新的标签、台词、偏好、动作、昼夜和长期目标不持久化。新增记忆投影到旧解码器前过滤，但原世界中的未知ID仍由7解码器拒绝；不会静默丢掉未知内容。候选记忆深拷贝，未确认CAS不能提前改旧世界count。

## 生命周期

- 隐藏/sidebar/关闭/断连/拍照/布置/user暂停继续通过原因集合控制同一30Hz时钟，不补算离线时间。
- 主故事开始取消短自主社交，旧茶会与邻里事件和新主故事互斥。到齐、观察与阶段按钮共同构成可完成链。
- 成员离场或有效拖离会取消当前主故事并释放其他参与者；无效拖动不取消。布局更改必须先结束主活动，不瞬移居民清障。
- 关闭、隐藏及重启保留已确认阶段；途中位置以已有检查点保存。到达超时提交取消，不发奖。取消本身也经CAS确认。
- 整理每次放置、重置，找鲸提示和发现，茶点每次选择均为受控候选写入。按钮携带UUID:stage；跨阶段旧点击拒绝。canvas从按下到抬起期间换活动也拒绝。
- 结果unknown时只读对账，持续unknown仍阻断；没有自动重放完成、领奖、上传。运行时专项测试覆盖首次和重玩ACK门控、拒绝、三个失败读取后成功核对、冷读与迟到token。
- 重玩只增同一条回忆次数及实际参与者共同经历，纪念物不是可累积物品，不重复创建。和旧系统一样保留首次及最近事件ID，不声称无限历史操作账本。

## 回退

0.6.4不理解7格式。停止新插件后保留整份新profile；使用SaveStore保护的升级前指针和对应快照，在另一隔离profile恢复旧包。禁止在新存档上直接降级写入或删除新字段。偏好及相册保持各自原事务与备份边界，不随剧情回退被隐式删除。
