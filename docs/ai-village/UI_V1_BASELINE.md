# UI-v1 基线 / M0

2026-10-22；HEAD `2cab99ab8b78de49b3c444ee4df388bf7a246634`，分支 main，AI Village 0.6.1。
与冻结审阅版本没有代码差异。开始时唯一未提交项为用户的未跟踪文件
`docs/ai-village/NEXT_FEATURES_2026-10-21.md`，保留原样，不切分支。

基线命令（实际执行，退出码均 0）：
- `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`：26 文件 / 103 测试。
- `node scripts/typecheck.mjs`：通过。

完整旧操作迁移表采用 `ui-v1/DESIGN_SPEC.md` §6.5，具体内容见 §6.1–6.4：
居民选择/入住/批量/八单人/关系→居民；同桌/六心愿/五邻里双人/取消→心愿；
三模板/四组锚点/角落/撤销→布置家具；三挂饰→布置挂饰；环境/七人配饰→布置氛围；
两套首次回忆/次数/照片查看导出删除→手账；主题/语言/动态/气泡/恢复/修订→设置；
暂停/时间→HUD；拍照/展开/关闭→系统动作。全部接既有 runtime 命令。

世界仍 schema6/scene3/rules3/content3；单 writer、CAS、未知回执只读对账、完整 composer 避让、
Git/Hg 共存、Live2D 互斥和用户暂停保留。只升级偏好和私有 frame 协议。

标定稿浏览器查看：NOT RUN。内置浏览器拒绝 file: 协议；不通过其他浏览器/服务绕过该安全拒绝。
冻结文字规范与 JSON 已完整读取。此限制只影响标定稿的浏览器核对，其他实现继续。
一小时真实运行验收：DEFERRED（用户明确暂缓）。
