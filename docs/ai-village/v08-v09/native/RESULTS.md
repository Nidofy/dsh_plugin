# 0.8.0-preview.1 原生 Desktop 安装与冷恢复

最终候选3（SHA256 `03fef5907efe727008136473448128b0f38d2eb41bdbd6d566f7fe374697e12d`，32,174,312 bytes）的全新官方安装、已读取空相册显示与读取候选2测试存档冷恢复补验通过，见[最终包补验](FINAL_CANDIDATE.md)。官方同版本原地重装被宿主拒绝，不能将补验称为原地升级通过。以下记录保留候选2原始身份与范围。

2026-10-23，本次固定候选2的官方安装、schema9真实偶遇、收藏、纪念物摆放、照片及完整进程冷恢复通过。使用全新独立 profile，不把历史preview.2的结果计入本轮。

## 身份与边界

- 包：`dist/nidofy-dsh-ai-village-0.8.0-preview.1.tgz`，32,174,210 bytes、276 files。
- SHA256：`65936d4cf3015f5960a64758567ddad8495ade321f4a28d321ab99b251ea4bb8`。
- 候选1 `617c36c2314bbfb64a4e99daf3bc34ebdc6abe0f34158dd53e1c6084038a66f2` 在安装前被主流程发现 schema9 frame 分派遗漏，本轮**没有安装或运行候选1**；其错误修复与浏览器证据归主验收。
- 官方载体：既有 `.build/ai-village-phase5/carrier/DeepSeek Harness.exe`，`0.2.1-rc.2`。没有下载或改造载体。
- 独立目录：`.build/ai-village-v08-desktop`；DSH_HOME=`home`，Electron user-data=`electron-data`，CDP仅`127.0.0.1:18766`。
- 新脚本：`scripts/ai-village-v08-desktop-launch.ps1`、`scripts/ai-village-v08-desktop.mjs`。复用历史流程的已核对逻辑，但没有运行旧table脚本、修改旧profile/证据或更改日常DSH_HOME。

每次启动均通过正常工具 `require_escalated` 以正常 Windows 进程运行 `Start-Process -WindowStyle Hidden`；此前历史载体受限启动的ACL问题没有在本次重新绕过或修改权限。没有 `--no-sandbox`、ACL变更、宿主源码变更、额外SDK安装、复制用户数据、输入API key或发送聊天。冷启动欢迎页均经真实 Add API Key → Set up later 关闭。Hidden是启动参数，不保证Electron后续不会展示窗口；宿主可能自行检查更新，不声称宿主全程零网络访问。

## 实际执行

| 本轮证据 | 结果 |
| --- | --- |
| [install-01/result.json](install-01/result.json)、[官方安装图](install-01/installed.png) | Plugins → Add plugin → 本地tgz → Install → Enable now。固定SHA匹配，随后终止并重启完整测试进程树；安装后的package version、index/client/frame bundle与scene.json逐字节匹配最终构建。 |
| [check-01/result.json](check-01/result.json)、[自然偶遇](check-01/natural-offer.png) | 实际打开schema9小院，通过居民页让Claude加入，正常Resume等待自然时间。窗口0的《叶子的来信》出现后，通过 Lend a hand 接受。没有修改ticks、RNG、offer或world。 |
| [阶段1](check-01/encounter-stage-1.png)、[阶段2](check-01/encounter-stage-2.png)、[阶段3](check-01/encounter-stage-3.png) | Bluewhale/Claude三个片段都实际走到相应targets并进入ready；暂停保存后逐一核对住民坐标与targets相同，再Resume点击明确阶段动作。最后通过 Remember this breeze 完成。 |
| [收藏分类](check-01/collection-categories.png) | 手账中的8个分类存在；Chance encounters显示1/2并列出《叶子的来信》，Residents in shared memories显示2/7。完成事实count=1，未以仅在场住民充当收藏。 |
| [已摆纪念物](check-01/placed-keepsake.png)、[真实照片](check-01/native-keepsake-photo.png) | Decor → Hangings → Breeze-leaf pot → Choose a place → Wall → Save this place，持久值leaf-pot=`wall`。实际renderer拍摄720×960 PNG，经Save to album保存；图片hash核对，拍照前后暂停world相同。工具图像查看确认照片包含已放置的代码叶子盆与两位居民；不代表正式美术签收。 |
| [restored-01/result.json](restored-01/result.json)、[冷恢复图](restored-01/cold-restored.png) | 在暂停checkpoint后终止整个身份匹配的测试进程树，再启动官方Desktop、重新进入小院。整个schema9 world逐字段相同，含encounterWindow、首次memory及摆放位置；album索引相同，PNG读取字节hash相同。重新打开收藏分类后world仍不变。 |

最终暂停world：ticks=2393，play.encounterWindow=0，play.active=null，leaf-pot=`wall`。首次记忆 `leaves-gather`：participants=`bluewhale,claude`，completedTick=2387，count=1。

相册照片 `Native 0.8 encounter`：720×960、1,324,210 bytes，SHA256 `5ee908a2e07722ce719966b090ae1ddba86c64de3d3c1b341e66e327bd1df79c`。

本次install-01、check-01、restored-01均首次执行通过，记录的page errors和截图问题均为空。check脚本保留自然等待的tick/stage观察；不存在通过重置profile、造完成事实或跳过保存错误的重跑。

## 清理、复现与未覆盖项

进程链：首次测试PID20696，安装后完整重启为556；保存完成态后再次重启为29968，冷恢复通过后其主进程与子进程全部通过EXE路径和独立user-data命令行身份校验停止。随后确认CDP18766已关闭，通知浏览器QA开始后续独占性能采样。原始stdout/stderr、profile和预期checkpoint仅保留在忽略的专用`.build`目录，不提交认证原始日志。

复现需将`AI_VILLAGE_EXPECTED_SHA`设置为上面的候选2SHA，并为每次脚本调用指定新的证据label；已有证据目录会拒绝覆盖。流程为新launcher → `install <label>` → launcher `-Restart` → `check <label>` → launcher `-Restart` → `restored <label>` → launcher `-Stop`。没有安装额外Playwright，复用已有源码依赖。`node --check`和相关`git diff --check`通过。

本轮native只覆盖一个自然偶遇及其三阶段完成、收藏、摆放、照片与完成态冷恢复。第二种偶遇、过期/略过/取消/重玩、未知ACK、旧schema迁移、完整尺寸矩阵及性能由本轮其它专项分别取证，不能由本记录推导通过。本轮没有原生GPU/FPS性能样本、一小时soak、多DPI或人工美术签收；功能运行期间与另一代理的浏览器功能验收并行，但双方未同时做性能采样。书屋、多区域和0.9尚未在此包实现，入口ART_REVIEW/正式资源门禁保持不变。
