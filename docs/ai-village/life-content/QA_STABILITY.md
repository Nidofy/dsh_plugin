# 原生稳定性与性能验收

2026-10-23。用户已要求继续。旧暂停和失败证据保留；最终候选已完成独立一小时可见运行验收，固定旧基线一小时仍未通过。

## 固定基线与环境

- 用户所说 0.9.2 已澄清为 `0.9.0-preview.2`。核对时 HEAD `6a254cd`；固定包 `nidofy-dsh-ai-village-0.9.0-preview.2.tgz` SHA256 `929d5be8cb72a2ad0c1e9a32b30fc90181c3ceab2d4a6755fd6e884ff19d5638`。
- 缓存官方 Desktop `0.2.1-rc.2`，新根 `.build/ai-village-life-qa-desktop-baseline`，独立 `DSH_HOME`、Electron user-data 与回环 CDP18769；没有更改用户日常实例、ACL 或 sandbox。启动参数仅 user-data、远程调试端口和回环地址，未禁用后台节流，未强制 DPR。
- [GPU/浏览器完整记录](QA-native/inspect-02/result.json)：Intel Arc 140T GPU，驱动 `32.0.101.8243`，WebGL 与 GPU compositing enabled；原生页面 `devicePixelRatio=1.75`，CSS viewport 1279×821，截图2239×1437。
- [Win32原生窗口独立核对](QA-native/environment-processes.json)：`GetDpiForWindow=168`，即175%。这不是浏览器 deviceScaleFactor 模拟；只覆盖此窗口所在显示器，未声称多DPI矩阵完成。机器另有 Oray 虚拟显示驱动，不能据此宣称所有显示路径相同。
- 全部安装由官方插件管理器UI完成，检查安装后 index/client/frame 三个bundle逐字节等于固定tgz解包内容。源码同时开发不会污染这个原生基线。

## 已完成结果

| 证据 | 实际结果 |
| --- | --- |
| [install-01](QA-native/install-01/result.json) | 新profile官方UI安装固定preview.2成功；无API key、无模型调用。 |
| [check-02](QA-native/check-02/result.json) | 实际庭院→书屋；暂停旅行保持ticks/RNG/共享事实。用`WEBGL_lose_context`扩展实际触发当前canvas上下文丢失，回到门前并卸载iframe；5秒后仍不自动揭幕；用户动作开门后原书屋精确恢复。关闭/重开同样保留世界。 |
| [performance-02](QA-native/performance-02/result.json) | 七居民、原生Intel GPU、175% DPI；独占测试/构建窗口，两区各20秒可见/20秒关闭。原20–35FPS、纹理最多128、绘制样本最多600的门槛不变。 |

故障注入只调用浏览器的真实WebGL上下文丢失API，不修改世界、模拟时间、产品状态或源码。此原生流程不等于网络故障；原生请求由官方connection/request通道完成，不能拿HTTP route未截获的结果冒充heartbeat失败覆盖。

| 原生样本 | FPS | JS提交p95 ms | 纹理/URL | 绘制样本数 | CDP可见进程CPU/单核 | 父页面TaskDuration/单核 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 庭院可见20.025秒 | 25.967 | 1.000 | 128/128 | 593 | 19.978% | 2.492% |
| 庭院关闭20.027秒 | 0 | — | 无iframe | 0 | 0.479% | 0.045% |
| 书屋可见20.019秒 | 26.076 | 1.200 | 121/121 | 588 | 20.157% | 2.221% |
| 书屋关闭20.027秒 | 0 | — | 无iframe | 0 | 0.748% | 0.099% |

两个关闭区间均ticks=0且完整持久世界相等；可见区间推进512/437个已保存ticks。p95只计JavaScript提交，不是GPU完成时间。当前frame解码RGBA估算为庭院67,346,784、书屋57,210,584 bytes，不是显存测量。CDP CPU包含browser、两个renderer、GPU及network进程，**不含独立Host**，不能称全应用CPU；完整子进程只读快照另列，旧performance-02没有独占全树CPU区间；新software-performance-02另列完整子树口径。

历史SwiftShader书屋20.890FPS、父TaskDuration74.279%是不同后端/进程拓扑的结果，不能用当前原生父页面2.221%直接推导性能优化百分比。此轮没有修改renderer来迎合历史数字。真实硬件两区通过原门槛，软件后端的新独立诊断见本文恢复结果及 [QA_RENDER_DIAGNOSIS.md](QA_RENDER_DIAGNOSIS.md)。

## 一小时持续运行

[soak-60min-01中断记录](QA-native/soak-60min-01/result.json)于09:48:49 UTC开始，用户要求安全暂停后标记 `INTERRUPTED`：完成7个一分钟样本，最后有效观测420.685秒；写中断记录时墙钟486.942秒，后者含停止驱动和安全落盘过程，不能当成已验证分钟数。7个样本均七居民、书屋121纹理/URL、唯一iframe、绘制样本不超过600，未记录页面错误。未到第10分钟，因此计划的循环关开/切区尚未执行。

此阶段允许并行构建/其他验收，仅验证正确性和资源边界，不作为独占CPU或帧率对比。旧基线一小时门禁未完成；新候选使用独立label完成自己的持续验收，不把中断前后或不同版本拼成连续一小时。

恢复后的 [soak-60min-02](QA-native/soak-60min-02/result.json) 已标记 **FAIL**。开始13:37:06 UTC，最后有效样本为第14分钟、累计859.463秒；仅第10分钟完成一次真实关闭/重开与切区，后续停更墙钟不计入有效观测。首次以 Hidden 启动，早期约1FPS；document.visibilityState=visible不代表原生前台。

[停更后的原生target诊断](QA-native/stall-target-diagnostic.json)显示CDP枚举和简单求值仍响应，但welcome.html可见、主应用隐藏且无iframe。旧QA无界evaluate令失败未能及时落盘。欢迎窗重现原因未建立，不能将全部现象归为纯QA错误，也不能宣称renderer已崩溃。已为读取与报告增加有界超时，新持续运行将逐分钟核对真实窗口可见、同iframe epoch帧数和ticks进展；意外欢迎页将FAIL，不自动掩盖。

[基线安全暂停](QA-native/stalled-baseline-safe-pause-01/result.json)成功后，身份核验关闭PID36908树。候选PID35968持久世界已paused、无活动故事；旧story-01标记INCOMPLETE后关闭测试树。用户日常实例未操作。新短测采用VisibleInteractive，不禁用后台节流。

## 安全暂停与恢复

[安全暂停记录](QA-native/user-pause-01/result.json)确认通过产品UI提交 `userPaused=true`，保存 `.build/ai-village-life-qa-desktop-baseline/checkpoint.json`。然后按缓存EXE及独立user-data身份关闭本次载体进程树；[清理记录](QA-native/cleanup-paused.json)核对测试PID/18769无残留，用户日常PID40100仍在。暂停当时，所有profile、截图、原始失败和已采样资料保留，没有提交。

用户已授权恢复。旧 `PAUSE_HANDOFF.md` 保留历史暂停事实；本记录追加实际新结果。启动继续使用正常工具提权，不改ACL、不添加no-sandbox，所有新label不复用旧result。

## 保留的失败与限制

- 首次在受限shell中启动缓存Electron因安装目录ACL报错；没有按日志建议改ACL，也没加`--no-sandbox`。正常工具提权后启动成功。旧失败进程身份核对后退出；一次taskkill遇已退出子进程返回失败，随后只读确认相关PID均不存在再启动。
- `inspect-01`：CDP尚不可用，连接拒绝，未执行产品检查。
- [check-01 FAIL](QA-native/check-01/result.json)：QA误以为原生heartbeat使用可拦截HTTP route，60秒未出现门。改用真实WebGL上下文丢失后`check-02`通过；不据此改生产网络代码。
- [performance-01 FAIL](QA-native/performance-01/result.json)：庭院可见有效样本25.910FPS；随后QA对已卸载iframe调用自动等待的elementHandle而超时。只改诊断脚本为先计数，`performance-02`全量重新执行通过。
- 物理系统睡眠/唤醒 **NOT RUN**，不会把关闭浮卡、最小化或renderer冻结称物理休眠。真实模型流式并行 **NOT RUN**；未输入凭据。宿主自己的更新检查存在，不能声称整个载体零网络。
- 本验收分工未修改生产源码。最终新候选包已另核身份、另取证，详见下文；本基线结果不算到新功能包。

## 恢复后的软件与候选验收

固定baseline软件后端 [software-performance-02](QA-native/software-performance-02/result.json) PASS：实际SwiftShader、DPI168、可见HWND19467972、前台PID3492。庭院25.614FPS/全树635.384%单核，书屋25.473FPS/全树812.601%单核。两区关闭均0frames、完整世界不变。独占窗口其他构建和验收均停止。20–35FPS/600样本门槛未调整；进程与独立V8 profile已将本次高CPU定位到软件GPU进程，具体内部着色/混合/填充成本未定，见 [QA_RENDER_DIAGNOSIS.md](QA_RENDER_DIAGNOSIS.md)。

最终候选0.10.0-preview.1，SHA256 `2a44566285875f40dbda18371b9384e634c43a821f9e65ac5556fc401caa9d11`：[candidate-install-01](QA-native/candidate-install-01/result.json)、[candidate-check-01](QA-native/candidate-check-01/result.json)、[candidate-restored-01](QA-native/candidate-restored-01/result.json)均PASS。实际七混合居民、WebGL故障回门、完整paused世界冷恢复已覆盖。原生完整故事candidate-story-01未完成，原证据保留；独立重跑candidate-story-02结果见下文。

候选 [candidate-performance-01](QA-native/candidate-performance-01/result.json) PASS，真实Intel硬件DPI168、可见前台HWND9442860（PID26908）。独占窗口庭院26.384FPS、书屋26.319FPS；可见区间完整子树成员稳定，CPU分别23.493%/22.396%单逻辑核。两区关闭后0frames且世界精确不变。

[candidate-story-02](QA-native/candidate-story-02/result.json) PASS：Bluewhale与Seedance在七混合居民原生世界中实际走完三个位置、每段90ticks，逐段UI动作后形成一条记忆与书屋书签。全程无时间/状态注入。[candidate-story-cold-01](QA-native/candidate-story-cold-01/result.json) PASS：整树重启为PID2788，官方欢迎页以Set up later跳过、不输入凭据；完整paused世界与保存checkpoint精确相同，含记忆、书签和七居民，然后真实返回庭院。

[candidate-freeze-01](QA-native/candidate-freeze-01/result.json) PASS：15秒Chromium renderer frozen/active后完整paused世界一致。物理系统睡眠/唤醒仍NOT RUN。实际原生最小化恢复未完成：Electron不支持Browser.getWindowForTarget，computer-use的窗口状态读取曾超时，未用其它窗口或用户日常实例替代。

最终候选 [candidate-soak-60min-01](QA-native/candidate-soak-60min-01/result.json) **PASS**：[完整汇总](QA-native/candidate-soak-60min-01/summary.json)。从2026-10-23 14:29:56.963 UTC开始，最后有效观测3676.349秒（约61.27分钟），严格60条minute样本，排除roster/start/epoch记录。书屋与庭院各30条；第10/20/30/40/50分钟五次真实关闭/重开和切区全部完成，新iframe周期明确记录，不拼接旧基线失败时段。

60/60样本真实原生窗口可见；只有5/60样本foreground=true，其余失去焦点仍持续渲染，**不是全程前台**。同周期每个分钟区间frames增加1538–1607、持久ticks增加1513–2101；采样间隔60.858–65.178秒（含只读取证和循环操作）。七居民、唯一iframe、书屋121/庭院128纹理与URL、最多600绘制样本全部满足，零pageerror，未出现欢迎页或失去监控的样本。此区间允许并行文档/Git等活动，只作正确性和资源观测，不当独占CPU或帧率比较。

每分钟快照均为同六个PID，本轮未观察到进程成员变化；重建的是iframe，不应表述为实测renderer进程重建。总private 1036.33 → 1088.19 MiB，范围978.70–1102.58 MiB；总working set 1446.85 → 1431.52 MiB，范围1319.59–1489.32 MiB。

| 进程角色 | PID | private首→末 MiB | private范围 MiB | working set首→末 MiB | working set范围 MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| browser | 2788 | 150.59 → 156.46 | 150.17–161.86 | 194.42 → 202.33 | 193.89–204.79 |
| gpu-process | 40396 | 448.28 → 438.21 | 398.23–461.75 | 509.62 → 499.54 | 458.04–531.16 |
| utility | 39132 | 12.01 → 11.99 | 11.82–12.03 | 54.18 → 54.60 | 54.14–54.62 |
| renderer（两个进程合计） | 42800, 18516 | 228.71 → 284.96 | 208.55–284.96 | 463.79 → 448.88 | 375.67–503.76 |
| host | 28520 | 196.74 → 196.57 | 193.90–202.57 | 224.86 → 226.18 | 223.45–230.58 |

以上是分钟快照观测，working set合计可能重复计算共享页；跨区、缓存与GC会改变数值，**一小时不能证明不存在内存泄漏**。隔离profile托管快照目录在中间和末尾两次只读抽样均为32个文件，末尾145951 bytes，见[存储末值](QA-native/candidate-soak-60min-01/snapshot-storage-final.json)。不是对整个Electron缓存的大小声明。

[保存核对](QA-native/candidate-soak-60min-01/preservation-check.json) PASS：结束已通过UI提交userPaused=true，[最终checkpoint](QA-native/candidate-soak-60min-01/checkpoint-final.json)与result完整世界相等，原生故事记忆和书签与story-02一致；最终截图已查看，画面与暂停按钮正常。实际执行的QA runner源码按记录SHA核验后随证据归档。

[最终清理](QA-native/cleanup-final.json)确认本次测试PID及CDP18769/18770/18771全部无残留；用户日常DSH仍在，三个隔离profile、checkpoint及全部失败证据保留。物理OS休眠、原生最小化恢复及真实模型并行限制如上，不混入本次PASS范围。

## 复现入口

在本插件仓库、保留的候选隔离profile已停止时，以下入口可重新运行；必须选未使用的证据label。`performance`需先协调独占测试/构建窗口，`soak`只作正确性/资源持续验收。所有写入通过产品UI，读取Win32进程树需要工具环境正常授权，不改ACL或系统设置。

```powershell
$env:AI_VILLAGE_RUN_ROOT='ai-village-life-qa-desktop-candidate'
$env:AI_VILLAGE_QA_PORT='18771'
$env:AI_VILLAGE_EXPECTED_VERSION='0.10.0-preview.1'
$env:AI_VILLAGE_EXPECTED_SHA='2a44566285875f40dbda18371b9384e634c43a821f9e65ac5556fc401caa9d11'
$env:AI_VILLAGE_QA_ROSTER='mixed'
$env:AI_VILLAGE_FULL_CPU='1'
pwsh -NoProfile -File scripts/ai-village-life-qa-desktop-launch.ps1 -RunRoot ai-village-life-qa-desktop-candidate -Port 18771 -VisibleInteractive
node scripts/ai-village-life-qa-native.mjs soak candidate-soak-60min-02
if ($LASTEXITCODE -ne 0) { throw '保留失败证据，检查并通过UI安全暂停后再清理测试载体。' }
node scripts/ai-village-life-qa-soak-summary.mjs candidate-soak-60min-02
pwsh -NoProfile -File scripts/ai-village-life-qa-desktop-launch.ps1 -RunRoot ai-village-life-qa-desktop-candidate -Port 18771 -Stop
```
