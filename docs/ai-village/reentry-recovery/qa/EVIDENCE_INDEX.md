# 故障回门验收证据

最终结论：[RESULTS](RESULTS.md)。历史失败与候选变化：[RUN_NOTES](RUN_NOTES.md)。最终内容核对：[FINAL_HASH_CHECK](FINAL_HASH_CHECK.json)；逐文件散列：[EVIDENCE_HASHES](EVIDENCE_HASHES.json)。

最终integration-04重点画面：

- [实际美术闭门](integration-04/heartbeat-closed-door.png)
- [自动核对已成功但仍停门前](integration-04/automatically-reconciled-still-closed.png)
- [约200ms开门中途](integration-04/courtyard-reentry-opening.png)
- [七头像加载、真实frame响应待放行](integration-04/courtyard-reentry-seven-loading.png)
- [当前庭院真实首帧后揭幕](integration-04/courtyard-reentry-revealed.png)
- [state失败后重关门与诊断](integration-04/state-failed-closed-diagnostics.png)
- [320×360深色减少动态闭门](integration-04/320-dark-reduced-closed-door.png)
- [320×360七头像加载](integration-04/320-dark-reduced-seven-loading.png)
- [书屋故障后恢复同区域](integration-04/bookhouse-reentry-revealed.png)
- [真实PNG decode失败后的备用门](integration-04/art-decode-failed-css-fallback.png)
- [备用门恢复同书屋](integration-04/art-decode-failed-reentry-revealed.png)

[validation.json](integration-04/validation.json)保存7项检查、19张截图元数据、门叶computed transform、隐藏HUD伪元素、图片自然尺寸、请求端点统计及diagnostics。[build.json](integration-04/build.json)保存103份源码、3bundle、QA脚本与夹具hash，并包含八张PNG与历史Git blob比较结果。`integration-04/video/`为实际全过程录像，文件名和散列见EVIDENCE_HASHES。

integration-01/02为早期CSS门候选；integration-03仅准备失败说明。不可将历史候选截图或包hash当最终APPROVED美术结果。
