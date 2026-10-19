# 附件审查修复记录（2026-10-18）

范围：独立插件仓库。未修改官方安装包、真实 DSH_HOME、用户笔记或工作区 ACL；未在真实项目执行提交、切换分支或推送。`review-fixes-pending.patch`、`persistence-fixes-pending.patch` 是用户批准时的历史快照，现已应用并完成同范围修正，不应再次应用。

## 已处理

| 组件 | 修复与保护 |
| --- | --- |
| source-control | Git/Hg 先解析为绝对可执行路径，排除仓库内程序和相对 PATH；切换/创建分支禁止覆盖 ignored 文件；脏子模块可查看，但相关变更操作保守拒绝；已接收写操作不随面板请求断开而中断；取消后即使后代持有管道也有超时返回。 |
| working-notebook | v2 指针缺失且仍有修订/历史时拒绝初始化为空；公开更新禁止传入内部 `commitThrough`；v2 条目 ID 禁止空白；旧 NotebookStore 拒绝读写已有 v2；旧压缩 helper 可显式传入 v1 store，缺失时安装即报错。 |
| notebook 持久化 | journal 和不可变修订先同步，再发布 current；Windows 使用写穿透重命名，新目录也先完成命名空间发布；迁移及重试保留原文件；同步失败不得发布新指针。缓存限制为最多 8 个会话、32 MiB 的历史序列化字节（不是 JS 堆内存上限）；历史读取支持取消。 |
| 压缩审计 | 保留冷恢复所需的最后一条指令、证据计划与 appendix，移除完整 messages/toolHistory 副本；单条审计输入上限 256 KiB，超限明确失败，不静默丢审计或重试模型。 |
| runtime-adapter | Windows 改为物理锁文件上的独占内核句柄，禁止持锁期间删除；关闭失败可重试；卸载取消新保护并等待已进入的发布；仅兼容 schemaVersion=1 的 notebook 审计；原生库改为运行时依赖，POSIX flock 按平台加载。 |
| worker 构建 | 固定官方 `639ed015397290b3745d163aafe02ffee4aa3f84` 源码归档参与 worker 编译，构建前重新导出；验证产物没有 dshWinUi/electron 源码路径。 |
| desktop-pets / shared | 偏好及笔记设置在跨 Host 文件锁内重读修订；已观察到的持久设置丢失时拒绝覆盖；资源目录读改写加锁；失效 pin 不阻断快照；单击不保存拖动位置；渲染崩溃/就绪超时关闭窗口；导入/导出增加取消检查；冷加载跳过单个损坏会话；桌宠 HTTP 校验 JSON 与请求来源。 |
| sandbox guard | 禁用官方 fs-sandbox、filesystem；三个拒绝型 Provider 同属父 fiber，全部成功后才发布 ready；agent-loop 硬依赖 ready，冲突传入官方启动检查。 |
| sandbox 诊断 | reparse 根或子项不再报告完整扫描；完整报告必须包含无重复的祖先链；CLI helper 缺失返回非零状态，错误的 --out 走结构化错误路径。所有恢复计划仍为 executable=false。 |

## 验证

- 默认完整检查：类型、行为测试、构建、tgz 内容校验、Host 导入、真实 verifier worker、浏览器 factory、TypeScript 消费端与隔离 profile 的官方 CLI 组合。
- 固定官方 0.2.0-rc.2：完整行为回归，包括多轮压缩、冷恢复、设置修订竞争、同步失败、迁移和卸载等待。
- 固定官方 0.2.1-rc.2 沙箱专项：39 项通过，1 项 Low IL 原生夹具因系统权限跳过，8 项隔离环境用例待验收；另 1 项打包/官方配置组合检查通过。
- Windows 锁测试使用两个进程及 junction 别名，验证重复取得所有权失败、持锁时不能删除，以及进程异常退出后可再次取得锁。
- 日志：`.build/review-fixes-check.log`、`.build/review-fixes-original.log`、`.build/sandbox-enhanced/tests.json`。产物及摘要位于 `dist/`。

## 保留的契约与未完成验收

1. `observeDurable` 保留同步屏障与排他保护。普通 stable read 不能证明数据已持久化，不按附件建议降级为无锁读取。只读根、竞争 writer 或不支持物理文件身份的文件系统仍可能拒绝增强功能。
2. 实际断电、不同 Windows 登录会话、NFS/FUSE 等未验收。新增同步及写穿透操作不等于已证明所有磁盘/控制器在断电时可靠。
3. Git/Hg 的取消不是回滚；已退出父进程的脱离后代仍无法靠 taskkill 保证全部回收。结果不确定应重新读取状态，不能自动重放写操作。仍需后续 Job Object 方案才能宣称完整进程树所有权。真实 Hg 用例因本机无 Hg 跳过。
4. guard 是拒绝执行的测试组件，不能提供可用的隔离运行环境，不能约束任意可信 Host 插件直接调用系统。切换执行 Provider 需停止活动任务并重启测试 profile；不对既有进程补加隔离。沙箱包要求 0.2.1-rc.2，不混装到当前 0.2.0-rc.2 Desktop。
5. Windows VM、EXE 写 Temp、父目录删除逃逸、硬链接/符号链接逃逸等执行安全验收，按用户选择待隔离环境就绪。未改成 danger-full-access，也没有递归重置 ACL。
6. 诊断 JSON、哈希链台账、helper 自带 manifest 都不是可信恢复授权或签名；重放、截断及同用户篡改防护尚不能支持执行 ACL 恢复。台账还没有形成抵抗目录重定向的原生句柄边界，故不得升级为自动恢复依据。
7. 原 provider 自定义 root/compression 仍须按 install.md 显式配置；不支持身份的文件系统不做弱化兼容。资源解析/图像解码仅在阶段边界响应取消，卸载会等待当前步骤结束。sharp 离线依赖、资源重复、全量 i18n/可访问性及通用图像流式接口不在本次安全修复交付内。
8. 本次重新打包并做隔离安装验证，没有更新正在运行的官方 Desktop。用户真实数据的修复、旧 Low IL 清理及正式安装验收不能由临时夹具测试替代。
