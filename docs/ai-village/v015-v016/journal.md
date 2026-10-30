# 社区手账展示层

2026-10-29。本轮复用原手账入口，内部提供故事、居民关系、纪念收藏、相册四页。实现位于 `src/client/CommunityJournal.tsx`，主线程负责接入 `ManagementPanel.tsx`。没有新增世界字段、关系数据库、持久 UI 存储或额外奖励提交者。

故事目录从当前 `afternoonStories`、庭院 story 目录、书屋共读/谜题与三人茶会派生。默认筛选当前区域，可切换全部区域；条目折叠展示动机、地点和已保存的原始参与者/事件 ID。进行中只引用现有 active；未完成内容显示为待发现线索，不宣称解锁或成功。已保存回忆继续使用原 `AfternoonMemoryArticles`、`BookhouseMemoryArticle`、`TeaSquareMemoryArticle` 与通知锚点；目录筛选不隐藏已有手账。

居民关系复用 `RelationshipPanel` 和原 `relationshipFacts`。十二居民 selector 保留；手账内每页最多 4 对，切换居民返回第一页，其他调用默认仍维持原完整列表。未发生的配对仅说明没有记录，不生成历史。纪念收藏从真实 memories 读取，即使收起仍显示来源；放置调用原 runtime 权威命令，界面不先写 world，异区/暂停/保存中/活动中禁止按钮。日记前两章 placement=null 时不制造物品。其余收藏分类、三地进度和本地相册均复用既有组件。

本次实际运行：

```powershell
node node_modules/vitest/vitest.mjs run --config scripts/ai-village-rc3.vitest.mjs packages/ai-village/tests/community-journal.client.spec.tsx packages/ai-village/tests/relationship-panel.client.spec.tsx packages/ai-village/tests/collection.client.spec.tsx
```

结果：3 文件、13 测试通过，其中新增 6 项。覆盖四页往返不改世界、首次事实来源/通知锚点、收起可查、异区禁放、暂停/保存中禁写、十二居民分页、相册按需读取。没有用这些 DOM 测试替代实际 340px/展开模式视觉验收；真实集成截图、键鼠焦点、DPR及构建身份由主线程/QA lane 统一记录。

新增组件不抢焦点、不监听全局快捷键。Escape 继续由外层面板处理；集成审查已提醒主线程，嵌套 details 必须优先关闭当前内层，回访提示也应先关闭。手账导航只使用原 presentation history。
