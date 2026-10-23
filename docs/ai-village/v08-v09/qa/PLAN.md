# 0.8 偶遇与收藏：QA 准备及副作用审计

准备基线为 `41f512d61c39aae099190c538a555fc81cfd6466`，分支 `codex/feature-ai-village-entrance`。只拥有本目录及 `scripts/ai-village-v08-qa.mjs`；不改src、其他文档或提交。已重新读取AGENTS、README、architecture、phase4-host/client与真实table QA脚本。

准备时状态为 **PREPARED / NOT RUN**；候选授权后开始实际执行，结果见各独立 label 的 validation.json 与最终 RESULTS.md。新脚本没有 `--execute` 时仅打印准备状态，不构建、不创建profile、不启动浏览器。现已按实际 core/encounter.ts 与 PlayPanel/CollectionPanel 接线；不注入世界绕过自然窗口。

## 已知契约和等待预算

主实施提供的预期契约是schema9/content6/rules4/frame6。`world.play.encounterWindow`为已消费窗口，初始-1；`currentEncounter(world)`是纯投影，固定hash不消耗world.rng。周期2700 ticks（90秒），窗口偏移300+hash%300（10–20秒），持续1800 ticks（60秒）；每pair两类随机先后。两种均双人三阶段：paper-rescue/message-board，leaves-gather/leaf-pot。开始或略过消耗窗口；取消不会令同窗再出现。每种首次预计不超过200秒自然时间。

只读取真实fixture world/UI或纯投影；不注入world、不伪造tick、不修改seed、不卡住定时器后批量推进。主交互预留约8–15分钟，包括自然出现、两种完整完成、取消/略过/下一窗及首次回忆重复计数。若在上限内未观察到则记录NOT OBSERVED/失败，不捏造通过。七人可见/隐藏各20秒另约1分钟；50次启停约1分钟；性能窗口与构建/原生Desktop串行。

最终UI接口已从真实源代码核对：article“此刻的小偶遇”，“一起帮忙”/“这次先略过”；三阶段动作词来自 catalog；收藏入口为手账→回忆→“收藏分类”。无需增加测试专用触发接口。

## 副作用边界

- `runPreview({out,buildOnly:true})`读取`.local/environment.json`和固定official baseline，在指定out构建实际fixture/harness/index.html；它不构建生产lib、不启动旧脚本主流程。不用serve模式，避免认证入口落入preview-entry.json。
- 先复制最终lib/assets到新 `.build/ai-village-v08-qa/<label>/preview`。每个label新建专用profile，Host只从该profile取可信根；官方Connection鉴权链接仅内存使用，不写证据。
- 依赖使用已安装Playwright1.61和Chromium headless shell，不下载或安装。浏览器仅允许本次loopback origin/blob；外部请求计入失败。不会访问日常DSH_HOME、真实会话或发送模型请求。
- 源码89份以上按实际清单、三个bundle、fixture均记SHA；HEAD/dirty记录用于明确工作树基线。输出只在本qa目录的新label，拒绝覆盖；`.build`保存鉴权和测试profile，不纳入证据。
- 只使用真实按钮/复选框、鼠标和正常主机fixture生命周期。检查快照不改世界；theme/sidebar/flush/dispose等沿用现有公开夹具能力。最后在finally关闭context、Host与browser。

## 计划证据

1. 两种自然offer、完整三阶段、首次回忆及奖励；重复体验保留第一次参与者/时间，只增加次数。
2. 正常略过与取消消费当前窗口；同窗不复现，下一自然窗口仍可继续，隐藏/user暂停不推进。
3. 收藏分类实际入口、分类切换、已解锁条目与空状态，窄窗口滚动/返回及浅深主题。
4. 精确冷恢复与未知ACK只读恢复（按最终变化决定针对性复用，不覆盖旧证据）。
5. 50次真正关/开、热态监听器稳定、世界冻结及最终frame释放；不是一小时验收。
6. 无active脚本事件的七人自然生活可见/hidden各20秒，保留20–35FPS、128纹理、最多600绘制样本门槛；记录世界端点和软件CPU限制，不冒充GPU/原生预算。

候选就绪后拟运行：`node scripts/ai-village-v08-qa.mjs integration-01 --execute --scenario=encounters`，随后独立`lifecycle`、`performance`新label，避免一个漫长脚本故障迫使全部重跑。实际命令依最终契约完善。
