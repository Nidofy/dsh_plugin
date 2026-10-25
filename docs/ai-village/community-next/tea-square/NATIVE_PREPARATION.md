# 0.13 茶会广场原生验收：脚本与执行说明

初始状态为 PREPARED_ONLY；2026-10-25 已按主线程指令开始固定0.13 gate包原生安装、planned门禁与庭院七人冷恢复验收。实际结果、失败记录和清理状态见 `native/RESULTS.md`。茶区美术尚待用户批准；未执行茶玩法，地图保持planned，不注入世界绕过。

## 隔离与身份

- 新脚本：`scripts/ai-village-tea-square-native.mjs`。
- 独立启动器：`scripts/ai-village-tea-qa-desktop-launch.ps1`，固定 `.build/ai-village-tea-qa-desktop`、CDP `127.0.0.1:18774`、独立 `home` 与 `electron-data`，仅Hidden启动，不抢占前台。
- 不能复用社区0.12原生profile、脚本标签或既有证据。实际用户DSH_HOME不修改。
- 启动器复用缓存官方0.2.1-rc.2 carrier；Restart/Stop必须同时匹配专用PID、carrier绝对路径和专用user-data命令行后才结束测试进程树。主脚本本身不启动或停止Desktop。
- 除inspect外，必须显式提供已获批准待验收的0.13.*版本与64位SHA。脚本先核对dist包，再核对安装后的Host/client/frame三bundle逐字节相等。
- fullplay/checkpoint必须先看到真实UI的茶区旅行按钮可用，再核对安装包/已安装目录的四张PNG及实际iframe收到的四key：`tea-square/background.png`、`tea-square/tea-table.png`、`tea-square/tea-counter.png`、`tea-square/message-tree.png`。缺门禁或资源返回NOT_RUN，不改目录或存档绕过。

## 实际测试路径

| 模式 | 计划覆盖 |
| --- | --- |
| inspect | 原生版本/GPU/尺寸/DPR/可见性/按钮只读观察 |
| install | 官方插件管理器本地安装并启用固定SHA包；不覆盖已安装同名包 |
| gate | 茶区planned按钮不可进入；地图浏览保持暂停world与写入次数不变 |
| fullplay | 新鲜profile，七人通过正式UI入住；公开地图往返；真实三人到齐；错排/重排/token；完成一次、取消不奖、重玩保留首次和茶签收起状态；真实照片；拒绝书屋直达茶区 |
| checkpoint | 若茶区planned，仅通过庭院UI入住七人并保存暂停gate-world检查点；若已开放才执行stage1部分杯垫检查点。结果为CHECKPOINT_READY |
| restored | 必须同SHA但新的启动PID；启动后world与checkpoint逐字段一致。gate-world只验七人、frame11和planned门禁；茶玩法检查点才继续完成、取消与重玩、照片 |
| photo | 仅对已有合法完成且已挂茶签的茶区世界拍摄实际720×960 PNG |

所有修改均为真实UI点击。状态GET和被动iframe消息监听只读，不调用runtime开发方法，不修改world/ticks/RNG，不制造保存回执。照片读取实际“Photo preview”展示的blob原字节，保留PNG大小/hash；不重新绘制照片。采样核对脚点间距与按实际tick计算的17单位/秒最大移动距离。计时与采样有界，原生隐藏节流导致等待超时则如实记FAIL及环境信息，不视为前台性能结果。

## 待批准及最终包固定后才使用的命令

以下是未来执行说明，不是本轮已执行记录。先由主线程确认视觉批准和最终包SHA，再填入真实值；不要把占位字符串当成授权。

```powershell
$env:AI_VILLAGE_EXPECTED_VERSION = '0.13.0-preview.1'
$env:AI_VILLAGE_EXPECTED_SHA = '<最终已固定包的SHA-256>'
./scripts/ai-village-tea-qa-desktop-launch.ps1
node scripts/ai-village-tea-square-native.mjs inspect native-target-01
node scripts/ai-village-tea-square-native.mjs install pinned-install-01
./scripts/ai-village-tea-qa-desktop-launch.ps1 -Restart
```

优先用可证明完整原生冷恢复的路线：

```powershell
node scripts/ai-village-tea-square-native.mjs checkpoint tea-checkpoint-01
./scripts/ai-village-tea-qa-desktop-launch.ps1 -Restart
node scripts/ai-village-tea-square-native.mjs restored tea-cold-restored-01
./scripts/ai-village-tea-qa-desktop-launch.ps1 -Stop
```

若仅做同进程完整流程，用fullplay替代checkpoint/restored。fullplay和checkpoint要求初始courtyard且无茶会memory；不能在已有完成事实的profile重跑并把历史当新结果。所有证据标签必须唯一；失败标签保留，不覆盖。gate模式供仍planned的包做只读门禁验收。每次结束由启动器Stop并另行只读确认PID退出和端口无监听。

## 证据与限制

未来运行输出位于 `docs/ai-village/community-next/tea-square/native/<label>/`：`result.json`、实际截图、真实照片（仅photo/完成流程）。启动和冷恢复checkpoint在独立.build目录。结果明确区分PASS、FAIL、NOT_RUN和CHECKPOINT_READY。

尚未运行或不在此脚本覆盖：用户美术签收、前台硬件FPS、实际物理休眠/最小化、额外物理DPI、长时间内存浸泡、native故障注入UNKNOWN ACK（该行为由单独core/browser测试覆盖）。不把页面visible等同OS前台，不把隐藏约1FPS计作性能回退，不抢占用户前台来造性能样本。

静态校验：`node --check scripts/ai-village-tea-square-native.mjs`；PowerShell Parser对新启动器解析无错误。首次准备时未启动；随后实际原生gate验收单独记录于RESULTS.md。
