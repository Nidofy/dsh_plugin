# 本次隔离 Desktop 启动记录

2026-10-23，官方缓存载体 `.build/ai-village-phase5/carrier/DeepSeek Harness.exe`，EXE/package 版本 `0.2.1-rc.2`。本轮创建专用 `.build/ai-village-table-desktop`，DSH_HOME 为其 `home`，Electron user-data 为其 `electron-data`，CDP 仅 `127.0.0.1:18765`。没有复制任何旧 profile 或用户数据。

1. 受限工具首次 `Start-Process -WindowStyle Hidden` 返回 PID 29236，但 Electron 随即在 `install_dir_access.cc:52` 报 FATAL。信息说明 carrier ACL 含 AppContainer package SID、缺少 ALL APPLICATION PACKAGES，沙箱令牌无法读取。CDP 无法连接。没有执行错误建议中的 ACL 修改。
2. 使用已授权的工具 `require_escalated` 正常 Windows 启动重试；先依据 PID、EXE 路径和独立 user-data 校验终止失败实例。主进程 29236 已终止，子进程 13384 拒绝终止，taskkill 非零退出，脚本如实停止。没有扩大进程终止范围或修改权限。
3. 再次通过 `require_escalated` 启动同一独立 profile，PID 14412，成功提供 CDP，浏览器 `Chrome/152.0.7977.130` / protocol 1.3。脚本 `inspect startup-01` 实际发现官方 app 页面及首次欢迎页；证据在 `startup-01/result.json`。尚未安装插件，此项仅证明载体启动。

所有启动都使用 `-WindowStyle Hidden`，但不保证 Electron 后续不会展示其窗口。没有 `--no-sandbox`、ACL 修改、宿主源码改动、额外 SDK 安装、日常 profile 操作。完整 stdout/stderr 留在被忽略的专用工作目录，不提交可能含认证令牌的宿主原始日志。首次失败与子进程清理限制不会被后续成功抹去。

后续正常权限只读核验：首次失败子进程 13384 已退出，无需进一步终止。为最终包的串行浏览器性能采样，测试载体 PID 28944 经 EXE 与独立 user-data 身份核验后完整停止，专用 CDP 确认关闭。

`startup-01/desktop-inspect.png` 用旧脚本 `fromSurface:false` 捕获的是黑图，只能与 DOM 检查一起证明连接，不能作界面视觉证据。后续改用 CDP `fromSurface:true`，`install-01/installed.png` 实际显示官方插件安装成功界面。`check-01` 是脚本导航失败：入场后 HUD More 浮层仍开，Decor tab 暂不可用；尚未更改桌面用途或增加居民。已在新脚本中关闭浮层并等退场动画后导航，保留失败目录，不修改生产代码绕过。

启动入口：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ai-village-table-desktop-launch.ps1`；`-Restart` 仅在验证记录进程属于本隔离实例后模拟冷进程丢失，`-Stop` 同样限制。安装和检查脚本每次创建新的证据标签，要求 `AI_VILLAGE_EXPECTED_SHA` 明确锁定最终 tarball；不能把历史 0.6.1 结果当成本次证据。
