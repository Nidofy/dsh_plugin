# 0.7 本地预览交接

后续已在同一entrance分支实现 **0.7.0-preview.2 桌面棋局开发预览**（生产提交`de862de4dfb2c8621715ed8c3ff6682fcbfc6117`，world8）。当前交接以[table-preview/HANDOFF.md](../table-preview/HANDOFF.md)及其包/验收记录为准；下文保留preview.1历史，不再把游戏桌当成尚未开始的任务。

工作目录 `D:\Documents\FeiyangChen\devApps\dsh_plugin`，分支必须继续使用已有的 `codex/feature-ai-village-entrance`。实施基线HEAD为 `963a501947b74498d0924a1c6892aecd3ef116bc`；本次最终提交身份由交付回复和 `git log -1 --format=%H -- docs/ai-village/living-v07-v09` 确定，不能把基线HEAD当成含新增代码的提交。

起始两份用户未跟踪文档保留在原处，不纳入本轮提交：`NEXT_FEATURES_2026-10-21.md`、`UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md`。其SHA分别仍为 `96a5d3e87dcdd00989195f5f6c634ce602f962a891a1c3a655e84cee26de6dd8`、`127e7704dffa665a452bbfd4f7df4a79ef27e96561a6490dea0935b553f8d9ec`。没有修改Desktop宿主、实际DSH_HOME或远端。

## 接手顺序

1. 读本仓AGENTS、[IMPLEMENTATION.md](IMPLEMENTATION.md)、[DATA_AND_RECOVERY.md](DATA_AND_RECOVERY.md)、[CONTENT_AND_ART.md](CONTENT_AND_ART.md)、qa最终结果及 [PACKAGE.json](PACKAGE.json)。不要重做已有证据关闭的旧阶段。
2. `git status --short` 和 `git branch --show-current` 确认当前工作；保持两份用户文档。归档在忽略目录 `dist/nidofy-dsh-ai-village-0.7.0-preview.1.tgz`，不应提交生成包。
3. 先关闭尚未完成的0.7验收：真实Windows GPU/DPI/多屏、完整Desktop并行会话与原生输入、反复启停资源释放。现有90秒自然社交和20秒软件性能不能替代一小时真实运行或硬件预算。
4. 下一项代码任务可从批准空餐桌的受控游戏桌开发预览开始：稳定物件ID、同一eat组锚点/两席、清楚的轮次规则、角色手部接触、占用释放和取消。视觉只能复用已批准桌体；新棋盘须记录原创来源并独立审核。先实现纯规则/碰撞/CAS/冷恢复，再接四入口和同一frame循环，不能仅画背景物件。
5. 0.8完整玩法、性能和数据门禁成立后才实施AI书屋。先明确共享居民/长期进度与当前区域事实、两区域迁移/安全落点和有界按需资源；书屋原画缺失时仅可明确标记开发样板，不进入正式资源选择器。

## Ownership与已关闭验证

主实施负责living-state/engine/controller、Host/runtime/frame接入与迁移；life负责life目录及纸娃娃动作；play_ui负责play-catalog/PlayPanel及UI/runtime专项测试；独立audit_qa负责脚本与qa证据目录。接手时这些子任务已集成，勿再次并发编辑同一核心文件。

188专项测试、全仓严格类型、正式小院构建、276文件解包校验与空缓存offline安装通过。188包括已有功能回归及新增7项状态链、真实runtime未知ACK只读核对和迟到点击保护。旧1–6读取与旧原字节保护有实际测试；软件浏览器使用正式组件、官方Host/Connection和独立profile。具体失败历史、继续验证和录像见qa，不能把中途FAIL目录改名成PASS。

## 未完成与发布边界

当前是本地 **0.7.0-preview.1**，不是完整0.9。M2独立随机剧情事件、M4全部主题收藏分类、M5新家具和M6书屋均未全部实现；M5/M6不能通过文字规格计作完成。真实硬件性能、完整原生Desktop安装、真实IME/模型并行负载、一小时GUI均未在本轮验证。没有发起模型、付费生成或外部资源上传。

入口候选继续 **ART_REVIEW**，生产仍静态选择。不能因本轮功能或软件截图通过而改成APPROVED，也不能改变首帧ACK或提前揭幕。新故事数据通过原SaveStore同一writer保存；未知写结果只读核对，禁止自动重放。旧包0.6.4不理解世界7，回退须使用被保护旧快照和另一隔离profile，不能在新档上直接降级写入。

## 可直接继续的Prompt

> 在 D:\Documents\FeiyangChen\devApps\dsh_plugin 的 codex/feature-ai-village-entrance 继续。先核对实际HEAD、工作树和 docs/ai-village/living-v07-v09/HANDOFF.md、IMPLEMENTATION.md、qa最终报告、PACKAGE.json，保留两份用户未跟踪文档。0.7.0-preview.1 已有七人个性/自主社交、三条故事、三小游戏、三人星空、七件世界内纪念物；188专项、类型/构建/离线安装和隔离浏览器证据已完成，不重做已关闭旧任务。优先补齐未完成的硬件/原生生命周期门禁及实际发现的问题，然后实施批准餐桌上的受控游戏桌开发预览：同一物件定义驱动锚点、占用、交互、命中、照片、迁移；先验证再接UI，不以占位美术冒充正式成果。资源缺口独立记录，入口ART_REVIEW和首帧门禁不变。0.8完整门禁通过后才推进AI书屋；只使用隔离profile，不访问真实DSH_HOME，不远端发布。按清楚ownership协作并持续完成可独立推进的工作。
