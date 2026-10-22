# 旧功能迁移表

| 原业务 | UI-v1.1 路径 | 业务 owner |
|---|---|---|
| 七人选择、看看 | 居民→全部居民→看看（返回观察）/详情 | 原 runtime/controller |
| 入住、离开、批量 | 居民→全部居民→安排入住 | 原 setCharacterPresent/setAllCharacters |
| 八种单人互动 | 居民→互动，或名单→详情 | 原 interact |
| 共同经历 | 居民→互动→共同经历 | 原 world.neighborhood.bonds |
| 配饰 | 居民→互动→配饰，或布置→氛围 | 原 Home draft |
| 六心愿 | 心愿→全部心愿 | 原 journal/memories |
| 茶/饭与五双人活动、参与者 | 心愿→一起活动 | 原 invite/interact |
| 取消当前活动 | 心愿或居民详情顶部状态卡 | 原 cancelEvent |
| 三布局、六家具、四锚点组 | 布置→家具→开始布置/模板 | 原 Home draft/CAS |
| 风铃/灯笼/挂饰 | 布置→挂饰→调整位置 | 原 decoration draft |
| 环境与七人独立配饰 | 布置→氛围→调整→模板/角落/氛围 | 原 Home draft/CAS |
| 20 步撤销/保存/取消 | 布置模式底栏 | 原 Home history |
| 12 回忆与重复次数 | 手账→回忆 | 原 confirmed notices |
| 照片/相册/查看/导出/删除 | HUD 拍照或手账→相册 | 原 PhotoPanel/AlbumClient |
| 未读与全部已读 | HUD 消息 | 原偏好 CAS |
| 主题/语言/减少动态/气泡/减少透明 | 设置→外观与显示 | 偏好 schema3 |
| 文字大小 | 设置→外观与显示 | 新 textScale 字段 |
| 观察缩放/全景 | HUD 视角；设置→交互与视角 | 原 presentation.camera |
| 人工暂停 | HUD 暂停/继续 | 原 user reason |
| 存档恢复/偏好恢复 | 设置→小院状态→诊断与恢复 | 原 Host SaveStore |
| Git共存/Live2D互斥/输入避让 | 原 shell.overlay/layout | 原宿主适配 |

导航本身不改 world；“看看”、入住及活动按钮沿用已有明确业务意图。未新增游戏规则、资产或模型调用。
