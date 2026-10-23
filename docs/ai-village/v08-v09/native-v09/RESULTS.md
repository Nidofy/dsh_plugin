# 0.9.0-preview.1 原生安装、书屋与冷恢复

2026-10-23，本轮官方Desktop安装、从专用0.8测试数据迁移、庭院→书屋三家具活动、共享手账/真实照片、完整进程冷恢复与返回庭院通过。未修改产品源码，所有写入由产品UI完成。

## 固定身份与独立环境

- 包：`dist/nidofy-dsh-ai-village-0.9.0-preview.1.tgz`，32,196,622 bytes，276 files。
- SHA256：`c1ba1a4b544cca84a9daf9e90bce572080b5628f5ca2326b7dad0237a05fbfa4`；本轮候选源码提交 `f346b20a36b248005f47f2c3f9146fb63c93eed1`。驱动核对包hash及安装后index/client/frame/scene字节。
- 载体：既有官方 `DeepSeek Harness.exe`，`0.2.1-rc.2`，不改宿主、不额外安装SDK。
- 新独立根 `.build/ai-village-v09-desktop`，DSH_HOME为其home，user-data为其electron-data；CDP仅`127.0.0.1:18767`。新脚本`ai-village-v09-desktop-launch.ps1`及`ai-village-v09-desktop.mjs`，没有运行旧版本脚本。
- 每次通过正常工具提权运行`Start-Process -WindowStyle Hidden`，正常sandbox，没有ACL变更或`--no-sandbox`。Hidden是启动方式，不保证宿主后续不展示窗口。欢迎页通过Add API Key → Set up later关闭，未配置API key或发送聊天。

## 实际证据

| 证据 | 通过范围 |
| --- | --- |
| [install-01](install-01/result.json)、[官方安装图](install-01/installed.png) | 全新profile从Plugins → Add plugin → 本地包 → Install → Enable now安装固定包。随后身份核验停止整个进程树。 |
| [复制来源/逐文件hash](install-01/copy-provenance.json) | 仅复制已停止的`.build/ai-village-v08-desktop`内`nidofy-ai-village`目录及checkpoint；33个文件逐一核hash。新自动生成目录移到本次根的pre-import-generated-village保留。没有复制会话、凭据、包依赖、日志或Electron数据。验收结束再次核对33个源文件，仍全部相等。此为专用测试数据迁移，非日常profile或原地包替换。 |
| [check-02](check-02/result.json)、[进入书屋](check-02/bookhouse-entered.png) | 启动读取旧schema9暂停存档，原庭院脚点/朝向、安全点、全部进度和相册与0.8 checkpoint相等。通过Decor → Furniture → Go to AI Bookhouse提交首次旅行CAS，保存schema10；该暂停旅行ticks=2393、RNG保持不变，原庭院pose存入returns。新frame实际region=bookhouse且frames>0。 |
| [书柜](check-02/activity-bookcase.png)、[阅读桌](check-02/activity-reading-desk.png)、[窗边座](check-02/activity-window-seat.png) | 每次先Resume，再点真实英文家具按钮；等待新intent保存后实际走到目标。Bluewhale依次read于(276,268)、work于(142,328)、sit于(92,270)，均intent.stage=use。暂停取证ticks分别2995、3302、3600；没有直接设置角色坐标、模拟ticks或活动状态。Claude同场正常生活。 |
| [真实书屋照片](check-02/native-bookhouse-photo.png) | Journal共享记忆/进度/关系/装饰/布局保持；Photo mode实际renderer拍摄并Save to album。新图720×960、160,801 bytes，标题Native 0.9 bookhouse，hash见下。拍照前后暂停world完全相等，旧照片保留，相册共2张。 |
| [restored-01](restored-01/result.json)、[书屋冷恢复](restored-01/bookhouse-cold-restored.png) | 再次停止全部测试进程并完整启动，schema10 bookhouse world逐字段等于check-02 checkpoint；两张照片索引与各PNG hash相等。实际打开Album看到Native 0.9 bookhouse，再读取Memories，旧共享事实不变。 |
| [返回庭院](restored-01/returned-courtyard.png) | 真实Return to courtyard后，两位居民原庭院position/safe/facing逐字段恢复，共享进度、journal、memories、bonds、各类装饰与home均保持。暂停ticks3600和RNG不变；新的庭院frame实际首帧通过。 |

迁移保护亦实际核对：原schema9 current指针的`upgrade-v1-<原指针hash>.json`内容完全相等，其引用快照原字节仍相等。此处验证正常活动保存后的保护，长期超保留窗口压力由独立存储测试负责。

新照片SHA256：`480780b0a5c64581b5399d1c06838cf54adf68c341eb87b58dd99af3274e1791`。书屋最终checkpoint：ticks3600、userPaused=true、active=bookhouse，Bluewhale窗边坐下；返回后active=courtyard，ticks仍3600。

## 可见性、图层与失败记录

成功流程的page errors与screenshotIssues均为空。三家具截图取证时frame实际visibility=visible、hidden=false、paused=true、tickerStarted=false；两居民书屋41张纹理/41个URL、无atmosphere texture，返回庭院48张纹理/48个URL与1个atmosphere texture。这些是功能现场资源计数，不作为独占性能FPS样本。

实际2239×1437桌面截图显示英文宿主与小院按钮可读，书页、桌上纸笔、桌后身体/手部与窗边书签进入画面；小院右侧浮卡及下方Dock未压住左侧空白主聊天输入区。照片实际包含独立书屋、两位批准角色和日期Bookhouse · Day 1 · 15:36。它是代码图形开发样板，不能推导正式原画批准或任意DPI/小窗口均无覆盖。

[check-01](check-01/result.json)保留一次**启动前失败**：全树停止后，启动器的Win32_Process查询暂见旧记录PID34900而拒绝启动，随后CDP连接被拒绝；没有执行产品check。独立只读复核该PID已不存在后，在同一个未重置profile启动PID30084，check-02通过。没有据旧PID终止身份不明进程，未以删数据掩盖失败。check-02完成后仅修正驱动末尾缺少process.exit造成CDP连接保持的问题；成功结果已写出，关闭载体后驱动以0退出，不影响产品状态。

## 清理、复现和限制

进程链34900→30084→9892。停止每次重新核对官方EXE及本次user-data，再终止完整子树。最终[cleanup.json](restored-01/cleanup.json)确认上述PID均不存在、18767无监听。随后立即通知audit_qa独占性能窗口，不再启动GUI或重测；原始stdout/stderr仅在忽略的专用.build目录保留，不提交认证原始日志。

复现：固定上述SHA，使用新的受限RunRoot/同名AI_VILLAGE_RUN_ROOT及新的证据label；install → stop → 仅导入已授权且停机的测试存档并核hash → start → check → stop → start → restored → stop。没有新下载或额外Playwright安装。脚本syntax及相关diff检查通过。

本轮原生只验证2位居民、三家具、一次往返、旧数据迁移和一次完整冷恢复。七人、12尺寸/DPR组合、50次区域往返、独占软件性能与故障注入由本轮浏览器/核心专项分别取证；没有原生GPU基准、一小时soak、模型流式输出并行或正式美术签收结论。宿主未输入API key、不发送模型请求，但不声称宿主自动更新等后台行为全程零网络。旧0.8证据、日常profile与入口ART_REVIEW/正式资源门禁未修改。
