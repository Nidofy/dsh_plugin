# Neural Lab 0.1.1 开发状态

本轮基于 `10e4f9d` 完成第三方 review 修复。用户报告 0.1.0 实际安装通过（user-reported）；本轮另做官方 Web、离线安装与真实 CPU 验证。所有开发位于独立分支 `codex/neural-lab-v0.1`，未修改主仓库用户未提交工作或实际 DSH_HOME。

已实现：configure 唯一参数源与六实验有效参数；可信 effectiveConfig 审计及旧记录兼容；36 活动提示细化；code12/unknown 明确分支；LeetCode 式双栏、行号高亮与原生编辑操作；单点统计卡和共享 loss 图；档案页签、局部锚点、统一草稿与保存期间并发保护；组件拆分、源代码格式化及本次临时目录安全清理。

官方深安装路径回归额外发现 Windows bind 文件降权读取 EIO，已改为容器内受保护的字节快照后再降权加载，原208字符路径的官方 Host→CPU 运行通过；不改宿主权限。

已验证：strict 构建、11 行为测试、24 参考/18 starter、33 参数运行、14 反例/攻击及 timeout/cancel、真实 CPU UI 14 项、最终交互浏览器13项、官方空缓存离线安装，以及最终包在原深路径下的官方 Web+CPU+Learn0.5.2 共存。详见 VALIDATION.md。

冻结包 `0.1.1`，71543 字节，SHA256 `a1a31220743bb208479da84bfd798d8d4e416f97a1e4238940d1bd3c5bb68e4c`。本地阶段提交，不推送或发布。

保留边界：真实模型成功回答、原生 Electron 本轮 GUI；任意大型文件产物、长任务恢复与 GPU 不在本轮范围。
