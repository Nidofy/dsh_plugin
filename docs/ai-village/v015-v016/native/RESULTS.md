# 0.16 原生隔离 Desktop 验收

2026-10-29（Asia/Shanghai），最终候选 `0.16.0-preview.2` 在实际官方 DSH `0.2.1-rc.3` Desktop 通过本页所列原生范围。没有安装 preview.1。原生证据不等同于六组新增故事全覆盖，也不代替正式美术签收。

## 身份与隔离

- 包：`dist/nidofy-dsh-ai-village-0.16.0-preview.2.tgz`。
- SHA-256：`db489226be230fa1b9fa68bacc2a5a13da73fb1124dd762f643efd4c7e9c09df`；每轮重新校验包，安装后的 398 个文件逐个比较 TGZ 内容。完整 build identity 在各轮 `result.json`。
- 官方临时 carrier：`C:\Users\enxi1\AppData\Local\Temp\dsh-ai-village-rc3-qa-ead9a0fb\carrier\DeepSeek Harness.exe`。固定版本 `0.2.1-rc.3`，`app.asar` SHA-256 `04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0`。
- 专用目录 `.build/ai-village-v016-desktop`；DSH_HOME 为其 `home`，Electron userData 为其 `electron-data`，CDP 仅 `127.0.0.1:18786`。启动、重启和停止都校验精确 carrier、PID、创建时间和隔离参数。启动使用 `-WindowStyle Hidden`；实际页面记录 `visibility=visible`，不声称窗口物理不可见。
- 只复制已冻结 A6 revision 147 的游戏目录；未复制真实会话、API key、用户设置或 Electron userData。创建空 profile，官方欢迎页选择稍后配置。每轮比对原 A6 全部游戏文件哈希不变。
- 实测 Electron `44.7.0`、Chromium `152.0.7977.130`，页面 1279×821 CSS px、DPR 1.75；未启用 software rendering。

## 实际结果

| 证据 | 结果与边界 |
| --- | --- |
| [准备](pre1/prepare-01/result.json) | 仅复制冻结 A6 游戏，独立空 profile；首次准备早于候选改名，因此保留在 pre1 目录。 |
| [检查](pre2/inspect-01/result.json) | 连接经身份验证的原生官方进程，空会话和界面检查。 |
| [官方安装](pre2/install-01/result.json) | Plugins → Add plugin → 本地 TGZ → Enable now；398 文件逐字节一致；实际 Host 将暂停的 world14 迁移为 world16，既有位置、姿态、时钟、RNG 和旧字段保持；原 r147 snapshot 哈希不变。 |
| [原生场景操作](pre2/play-01/result.json) | 茶香书签：通过真实场景物件的屏幕坐标点击发现、note、wave、press、keep；等待实际路径到达，验证选择影响、唯一首次记忆及纪念，再点击场景回访。没有直接写世界状态。 |
| [三地区](pre2/play-01/result.json) | 通过公开地图往返 courtyard/bookhouse/tea-square；每次实际首帧成功；同一居民集合和记忆，暂停跨区 ticks/RNG 不增加。 |
| [两轮启停](pre2/lifecycle-01/result.json) | 官方管理器禁用后 Host endpoint、launcher、iframe 移除；启用恢复单一 launcher，完整 saved 值一致。 |
| [冷恢复](pre2/restored-01/result.json) | 核验后关闭 PID 30936，启动新 PID 10140；恢复相同 revision/operation/world，实际首帧成功。 |
| [卸载](pre2/uninstall-01/result.json) | 官方卸载后 Host/launcher/iframe 消失；磁盘 pointer、snapshot 和包含新记忆的完整 saved 原样保留。 |
| [进程终检](pre2/process-final.json) | 严格停止 PID 10140 进程树后，全部 13 个已知 PID 不存在，包括早期失败父 36692/子 31824；精确 carrier 无剩余进程，18786 无监听。 |

各轮页面错误数组均为空；捕获的 API 请求没有模型生成请求。截图实际存在，已目视安装迁移、故事回访和冷恢复画面。页面标签能换行，但拥挤角色、占位道具和正式方向动画仍按 [美术审查](../art.md) 的缺口处理。

## 保留的失败尝试

`pre1/inspect-01` 保留缺少 launch.json 的失败：初次启动后受限执行环境不能读取 CIM，未能完成启动记录。随后只读提权查询精确 PID 36692 的路径、参数及创建时间，恢复身份记录；`pre1/inspect-02` 保留 CDP ECONNREFUSED。首次 stderr 显示 Electron 对载体目录 AppContainer ACL 的访问诊断。

没有按照诊断改 ACL，也未加 `--no-sandbox`。经自动批准的外部沙箱执行权限再次运行相同隔离 launcher 后成功。第一次精确进程树停止报告子 PID 31824 AccessDenied，因此当时没有宣称停止成功；随后只读核查其已退出，本轮终检再次确认不存在。失败证据和相关启动日志均保留，没有覆盖旧 A6 证据。

## 重现与未覆盖

新脚本为 `scripts/ai-village-v016-desktop-launch.ps1` 与 `scripts/ai-village-v016-native.mjs`，由既有下午故事验收脚本复制后限定到新目录、端口、版本与 world16。每次 evidence label 必须唯一，runner 会拒绝复用目录；每轮附有当时 runner 副本与哈希。准备模式拒绝覆盖已存在 QA profile。默认仅使用本页通过的模式；复制保留的其他模式没有本轮资格结论。

运行时固定 `AI_VILLAGE_EXPECTED_VERSION=0.16.0-preview.2` 和上述 `AI_VILLAGE_EXPECTED_SHA`。本次顺序为 prepare、launcher、inspect、install、play、lifecycle、launcher -Restart、restored、uninstall、launcher -Stop、只读终检。CIM 身份核验和原生进程启动需要经自动批准的外部沙箱执行权限。

本轮只原生完成 **茶香书签一条**；六组新增配对与日记三章的功能覆盖应查看独立浏览器/核心测试。未覆盖物理睡眠/最小化、IME 候选、长期硬件性能、原生未知 ACK 故障注入、真实模型任务负载、Git/Live2D 共存和正式四向动画签收。没有触碰真实 DSH_HOME，没有发布 npm，没有清理保留的隔离游戏存档。
