# rc.3 / 0.13.0-preview.5 最终候选双 DPR 回归

2026-10-26，**DPR1 与 DPR2 完整玩法均 PASS，最终包身份核对 PASS，自有浏览器/Host 清理 PASS**。本轮只验证最终候选，不修改游戏内容；pre4报告及全部历史证据保留。

## 最终包与核对

包：`dist/nidofy-dsh-ai-village-0.13.0-preview.5.tgz`，53,670,374字节。

SHA-256：`c674e44495e99c066cae83aabbfedf03d0fc6d17de01b434434f205b1518f760`。

以[最终包身份](0.13.0-preview.5/package-identity.json)为准，逐项验证实际tgz SHA、当前129份游戏源码、两轮 `build.json` 的同一129份源码及三个bundle。另对当前输出及两轮独立运行目录中的全部306个 `lib/`、`assets/` 文件逐个验证SHA，全部与包内身份相同。[身份关联结果](0.13.0-preview.5/browser-fullplay-identity.json)记录runner、build、result各自SHA，避免后续代码或截图冒用此包验收。

| Bundle | SHA-256 |
| --- | --- |
| index.js | `45a51bc452888b22e41348a09bc423748ba3d1ee5182f655a2815494cd6e9199` |
| client.js | `4182fe1253bb6c8d7212b750baeb90259fd3763feb5b70aaba9d2f8a771ced25` |
| frame.js | `7bd7bd0b1eed6e8f59c9bdc60ce659629fff4638abba36cb1ba8860b556553ed` |

游戏源码、Client和Frame与pre4相同；Host bundle删除构建调试注释，关联的service内容哈希文件名随之变化。实际用TypeScript AST printer移除注释并规范化service文件名后，pre4/pre5 Host entry与service输出逐字一致。独立两次源码解包/构建/打包的复现证据另见[reproducibility.json](0.13.0-preview.5/reproducibility.json)，本报告没有把pre4运行结果替代为pre5结果。

DSH为 `0.2.1-rc.3`，源码提交 `1f81c047fc48fa190a683e469daa699857e9afe8`，归档SHA `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。独立runtime锁SHA为 `cb921ac43ecb67ddf6a9aea667b362848a7b8d5795a1bc2d7686db1eee7c6ba9`。仓库基线HEAD `ead9a0fb97631bf651421ebac9e1e6ab78012950`；包身份包含本轮适配工作树，不将基线HEAD当作全部未提交修改的身份。

## 本轮实测

| 轮次 | 结果 | 检查记录 | PNG | 真实旅行 | 页面错误 / 外网请求 |
| --- | --- | ---: | ---: | ---: | --- |
| [rc3-pre5-dpr1-01](../community-next/tea-square/browser/rc3-pre5-dpr1-01/result.json) | PASS | 32 | 30 | 19 | 0 / 0 |
| [rc3-pre5-dpr2-01](../community-next/tea-square/browser/rc3-pre5-dpr2-01/result.json) | PASS | 32 | 30 | 19 | 0 / 0 |

两轮顺序运行，均使用新建隔离profile、动态loopback端口和Chromium headless / ANGLE SwiftShader，不使用外部模型API，不修改日常DSH_HOME，不注入世界或推进时钟。

- 庭院、书屋、茶区公共地图旅行；七人在场；非邻接旅行拒绝；跨场景保留首次回忆和纪念。
- 书屋三个普通站点及其真实阅读/写字/坐姿、三阶段共读真实到齐、首次回忆。
- 茶会三人移动、暂停/侧栏隐藏、取消不奖；杯垫错排/重排/部分进度客户端冷恢复；收尾真实到齐。
- Host实际提交后丢最终ACK并阻断读取，保持未知结果，随后只读恢复；同一operationId只发送一次保存，只有一份首次奖励。
- 不同三人重玩只增次数，首次参与者/日期不变，收起茶签不自动重挂；显式装饰摆放有效。
- 普通选茶counter/choosing/seat/waiting四阶段、真实坐姿及显式取消；已有记忆保留。
- 每轮导出书屋窗座、共读、茶签三张真实720×960照片；拍照前后世界一致。
- 书屋/茶区各自320×360、340×720、580×720卡片，浅深色、中英文、200%字和减少动态；外观操作不写世界。
- 书屋等长坏资源和茶区503在写入前拒绝，实际门庭重试恢复。
- 每轮12次额外公开旅行后，各区Texture / TextureSource / Blob URL库存恒定：庭院128/128/128、书屋123/123/123、茶区125/125/125。

已目视pre5茶区普通坐姿及DPR2书屋窗座，获批素材正常显示；七人自然遮挡保留。英文200%导航长词分行和时间省略属于pre3/pre4已有视觉边界，详见[pre4报告](RC3_BROWSER_FULLPLAY.md)，没有在本轮重新修改或隐瞒。

## 范围与暂停清理

本轮是 **rc.3官方鉴权Host + 真实游戏组件/iframe + 自有布局夹具**；不能作为完整官方Client、新增More菜单、官方草稿恢复或Desktop安装的替代证据。客户端冷恢复是销毁owner/重载页面，Host仍运行；完整Desktop/Host重启及旧rc.2存档升级另看专项证据。照片导出不等于相册保存/删除全覆盖。未验证原生GPU、物理睡眠/最小化、长期内存或新方向动画，恒定资源库存不等于长期零泄漏。

按用户“A6后安全暂停”要求，本子任务到验证收尾为止，没有进入B阶段。两轮runner均退出0并走完context/browser/Host关闭流程。另在DPR2运行时记录Node PID38224及4个Chromium子进程，结束后核验这5个PID均不存在、两个pre5 runner进程均不存在、临时`127.0.0.1:63425`无监听，系统中也没有残余`chrome-headless-shell.exe`。未强制终止其他进程。[清理记录](0.13.0-preview.5/browser-cleanup.json)保留创建时间、进程树与端口证据。

日志 `.build/rc3-pre5-dpr1-01.log`、`.build/rc3-pre5-dpr2-01.log`，各轮profile和报告原件均保留。执行命令如下；若需复验必须换新label，不能覆盖本轮目录：

```powershell
$env:DSH_VILLAGE_COMPAT = 'rc3'
node scripts/ai-village-tea-square-qa.mjs rc3-pre5-dpr1-01 1 --mode=play --approved-scenes
node scripts/ai-village-tea-square-qa.mjs rc3-pre5-dpr2-01 2 --mode=play --approved-scenes
```
