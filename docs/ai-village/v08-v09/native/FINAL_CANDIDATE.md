# 0.8.0-preview.1 最终候选3原生补验

2026-10-23，最终包全新官方安装、已读取空相册分类/目标、读取候选2真实测试存档的完整进程冷恢复通过。本补验不重跑候选2的自然偶遇三阶段，不冒充同版本原地升级成功。

## 身份与实际结果

- 固定包 SHA256：`03fef5907efe727008136473448128b0f38d2eb41bdbd6d566f7fe374697e12d`，32,174,312 bytes，276 files，版本 `0.8.0-preview.1`。
- 沿用官方 `0.2.1-rc.2` 缓存载体，独立 CDP `127.0.0.1:18766`，正常 sandbox；每次均 `Start-Process -WindowStyle Hidden`。不改 ACL、宿主、日常 DSH_HOME，不安装额外 SDK。
- 脚本增加受限 `RunRoot` / `AI_VILLAGE_RUN_ROOT`，每次标签目录拒绝覆盖。三个新隔离根均在 `.build/ai-village-v08-desktop-final-*`；旧候选2根保持原样。

| 证据 | 实际结果 |
| --- | --- |
| [final-empty-install-01](final-empty-install-01/result.json) | 全新 `final-empty` profile 经 Plugins → Add plugin → 本地 tgz → Install → Enable now 安装，随后完整终止进程树并启动。 |
| [final-empty-check-01](final-empty-check-01/result.json) | 实际 Album 读取返回空索引，UI显示 Local album · 0/20、空相册说明；Memories 分类实际节点为 Photos · 0，照片目标为 0/3。schema9 world前后一致、album仍为空，没有制造完成或照片事实。截图保留页面状态，分类计数位于滚动区域，DOM断言为主要数量证据。 |
| [final-import-install-01](final-import-install-01/result.json) | 另一个全新 `final-import` profile 官方安装同一最终 SHA，未带入旧包依赖。安装后停止全进程，再执行存档复制。 |
| [复制来源清单](final-import-install-01/copy-provenance.json) | 仅将已停机候选2 `nidofy-ai-village` 存档目录和 expected checkpoint 复制到已停机的 final-import。33 个存档文件逐一 hash 核对；自动生成的新目录移到专用根的 pre-import-generated-village 保存。没有复制凭据、会话、包依赖、日志或 Electron user-data；源目录未修改。 |
| [final-import-restored-01](final-import-restored-01/result.json)、[实际收藏图](final-import-restored-01/cold-restored.png) | 完整冷启动后，安装 bundle字节匹配最终构建；schema9 world逐字段等于候选2 checkpoint，ticks2393、首次 leaves-gather count1、leaf-pot=wall均保留。相册索引及 PNG hash相等；真实读取显示 Local album · 1/20、Native 0.8 encounter缩略图、Photos · 1。没有重演写入或修改world。 |

原照片为720×960、1,324,210 bytes，SHA256 `5ee908a2e07722ce719966b090ae1ddba86c64de3d3c1b341e66e327bd1df79c`。成功记录的 page errors / screenshotIssues 均为空。

## 保留的失败与限制

曾在第三个独立 `final-upgrade` 根复制候选2测试 profiles 和 checkpoint尝试官方原地重装；凭据、会话、Electron数据与日志排除。该副本保持在忽略目录，未用于最终成功断言。

1. [final-upgrade-install-01](final-upgrade-install-01/result.json)：脚本误以为 Uninstall 会删除 dependency，实际 bundle选择已移除但依赖保留，等待超时。随后按实际状态修正脚本，没有重置存档。
2. [final-upgrade-install-02](final-upgrade-install-02/result.json)：宿主保留详情页，脚本等待 Add plugin超时；补充真实 Back to plugins导航。
3. [final-upgrade-install-03](final-upgrade-install-03/result.json) 与[实际错误图](final-upgrade-inspect-01/desktop-inspect.png)：真正提交官方安装后，宿主明确拒绝同版本重装：包已经安装，要求先卸载。未绕过该限制，也未手删依赖或存档。最终采用新官方安装+只读旧存档冷恢复的独立路径。

因此最终包的旧数据可读性已有真实Desktop证据，官方同版本原地替换仍未通过。没有新增原生GPU/FPS、长时间soak或美术批准；性能由独立浏览器专项采样。主代码仅修正空相册读取身份，候选2自然偶遇全流程仍以其原SHA记录。

## 清理与复现

final-empty进程45168→18876，final-upgrade进程20212，final-import进程38492→15016。每次停止均重新核对载体EXE及指定user-data后终止全树；最终全停。原始日志保留忽略目录，不提交认证日志。QA performance-02在所有native停机的窗口完成；本补验最后一次启动发生于QA放行后。

复现时固定上述 `AI_VILLAGE_EXPECTED_SHA`；launcher `-RunRoot <新的受限根名>`，Node同名`AI_VILLAGE_RUN_ROOT`。全新安装用 `install <新标签>`；完整重启后 `empty-album <新标签>`。读旧存档需先停止两个专用实例、明确复制来源并核对文件hash，随后完整启动运行 `import-restored <新标签>`，该模式要求候选2 checkpoint身份。结束用同根launcher `-Stop`。脚本语法与相关diff检查通过。
