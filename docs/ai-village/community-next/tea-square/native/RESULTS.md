# 0.13 gate 包原生验收实际结果

日期：2026-10-25。状态：**GATE / CHECKPOINT / COLD RESTORE PASS；茶区完整玩法未执行**。

## 固定包身份

- 包：`nidofy-dsh-ai-village-0.13.0-preview.1.tgz`
- SHA-256：`fed59a28566bb09bd2a1f82c0096b7fb09a859e49102475b429b93085e4e845d`
- 大小：48,911,384 字节。
- 已安装Host/client/frame三个bundle与固定包逐字节一致。未在本轮修改源码、构建或重新打包。
- 全新专用profile，不声称完成0.12→0.13原生升级。旧0.12冻结包与旧社区验收profile没有修改。

## 已通过

| 证据目录 | 结果 | 事实 |
| --- | --- | --- |
| `gate-native-target-02` | PASS | 只读核验独立原生目标 |
| `gate-pinned-install` | PASS | 官方插件管理器安装启用固定包；三bundle匹配 |
| `gate-planned-map-recheck` | PASS | 茶区按钮保持planned/禁用；地图浏览不变更暂停world、不增加保存请求 |
| `gate-seven-checkpoint-recheck` | CHECKPOINT_READY | 在庭院通过真实UI入住蓝鲸、Claude、Gemini、GPT、Grok、Kimi、Qwen七人；暂停并保存gate-world检查点；无茶active/memory |
| `gate-cold-restored-capture-retry` | PASS | 专用PID21368完整结束后PID13268恢复；world14/content10/region2、七居民、ticks=6、userPaused=true与检查点逐字段相等；真实iframe消息version11；茶区仍planned；实际七人截图保存 |

最终截图：`gate-cold-restored-capture-retry/native-gate-cold-restored.png`。地图截图：`gate-planned-map-recheck/native-tea-map-gate.png`。

最终截图第一次CDP读取达到20秒上限；只重试一次同样的只读截图请求后成功。该次超时也保留在最终result.json的observations内，未降低世界/门禁/帧协议断言。没有激活用户前台或人为推进世界。

## 失败与中断证据完整保留

- `gate-native-target-01`：初次沙箱内启动CDP拒绝连接。stderr明确为缓存Electron carrier对AppContainer沙箱令牌的ACL访问限制。未采用日志建议去修改ACL；经工具自动审批后在沙箱外Hidden启动隔离实例。首次停止根PID28524时子PID29552短暂显示拒绝访问，随后只读确认两者均已退出且端口无监听，才重新启动。
- `gate-planned-map`：脚本在全新世界首次保存完成前读取region得到null。改为等待实际保存后，独立recheck通过；未改插件源码。
- `gate-seven-checkpoint`：Playwright `check()`过早断言受CAS控制的复选框状态。改用真实click，再等待权威保存中的居民集合；独立recheck通过。
- `gate-cold-restored`：地图截图后长时间未产生完成结果，QA客户端被中断；保留截图与interrupted.json，不赋予PASS。
- `gate-cold-restored-bounded`：隐藏窗口中“Close courtyard”按钮动画导致鼠标稳定性等待超时。使用可见、可用按钮的正常键盘焦点/Enter激活后继续；没有force点击或激活前台。
- `gate-cold-restored-keyboard`：世界冷恢复等值检查已PASS，最终截图达到20秒上限，整轮仍保留FAIL。catch保存的stopped.png及result.json均保留。
- 主线程只授权一次额外有界只读截图重试，最终独立标签 `gate-cold-restored-capture-retry` 通过；没有覆盖上述失败或更改其状态。
- `gate-progress-observed`、`gate-admission-observed`、`gate-admission-observed-02`、`gate-restore-observed` 是独立只读诊断，不代表茶区玩法验收。

## 隔离与清理

使用官方缓存Desktop0.2.1-rc.2，固定`.build/ai-village-tea-qa-desktop`、独立home/electron-data、CDP127.0.0.1:18774、Hidden窗口。启动/重启/停止经PID、可执行文件和user-data路径身份核验。未修改实际用户DSH_HOME、ACL、用户环境、系统DPI。

最终专用根PID13268及5个子进程已结束。`cleanup.json`于2026-10-25 07:26:37 UTC记录`rootStillPresent=false`、`cdpListeners=0`。保留测试profile和证据以便复核，不遗留运行实例。

## 明确未覆盖

用户茶区美术批准仍pending，生产入口仍planned。本轮未进入茶区，未执行三人完整玩法或茶区中途剧情冷恢复、四纹理原生加载、茶签照片；这些不能从庭院gate-world恢复推断为通过。没有测试原生0.12升级、真实物理休眠/最小化、前台硬件FPS、额外物理DPI、长时间内存浸泡或native UNKNOWN ACK故障注入。页面visible不等于OS前台，截图与隐藏调度等待不作为性能回退证据。
