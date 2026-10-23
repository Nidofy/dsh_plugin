# 错误回门再进入：运行记录

使用独立 `scripts/ai-village-reentry-qa.mjs`、`.build/ai-village-reentry-qa/<label>`、本目录新label。默认脚本仅打印使用方法；显式`--execute`才构建真实官方鉴权夹具并启动浏览器。正常profile、旧0.9证据和模型服务均未触碰。没有world/ticks注入。

## integration-01：首候选功能PASS，目检发现HUD伪元素泄露

实际heartbeat请求abort后回门并卸载iframe；只读自动核对成功仍停门前；用户点击后开门→7头像加载→真实首帧揭幕。state读取失败会重新关门、保留diagnostics和世界，不请求recover/previous存档。320×360深色减少动态及书屋同区域恢复均通过。脚本原6项均PASS。

目检额外发现门前右上透出底层HUD“继续”tooltip。这是产品CSS问题：`::after`的自身`visibility:visible`覆盖了父UI的隐藏继承值。主agent随后加入hidden entry-ui下HUD伪元素强制`visibility:hidden;opacity:0;transition:none`。本轮不能当最终视觉PASS。

开门截图采在最初几帧，metadata有非identity matrix3d（约3–5°），但静态图不足以清楚展示开门中途；第二轮增加约200ms采样和明显转角断言。

## integration-02：CSS门补验PASS，历史候选

重新完整运行6项，另外关门/加载时主动hover原暂停按钮坐标，断言全部HUD伪元素为hidden且opacity0。开门约200ms后，两门叶matrix3d的cos项分别为0.304794（首次）及0.405734（重试），sin项正负对称，真实图可见向两侧旋转；不是只检查data-opening或transition字符串。

本轮已结束且浏览器/Host已停。用户随后明确批准启用已有门庭美术，主agent接入现有manifest/layers；因此integration-01/02仅保留为之前CSS离线门候选证据，最终验收须绑定新门庭构建，不能用其包哈希冒充后续美术版本。

## 故障注入与测量边界

- 网络层只abort真实heartbeat/state请求；开门加载截图暂缓一次真实frame HTTP响应，期间验证7头像、blocking=true且firstFrame=false，再放行完整生产renderer验证首帧。没有伪造资源进度或首帧ACK。
- 记录的请求仅endpoint/method/相对时间/是否故障，不保存认证URL/token。所有写入都是真实Host隔离profile。
- 未重新进行原生Desktop安装、GPU/性能采样或全部历史玩法回归。本轮服务于故障时回门与再进入流程。

## integration-03：准备失败，未启动浏览器

新增逐字节PNG历史核对时，Node `execFileSync` 默认1MiB stdout缓冲小于1,240,220-byte背景PNG，git show抛ENOBUFS。完整说明保存在该label的`preparation-failure.json`；没有Host、浏览器或游戏操作。修正QA命令缓冲为8MiB，新label integration-04继续，图片/产品未因这一错误修改。

## integration-04：最终APPROVED门庭版本PASS

绑定源码34781135e25d34ba3a2fa4aea2070d289497f743，完整7项通过。八份PNG与98c5383逐字节相同，manifest为APPROVED，2,749,401bytes/1,773,738pixels/8layers均在既定预算内。门前等待8图decode完成再截图；约200ms开门实测matrix3d cos项0.312981和0.439796、方向对称，美术stage opacity=1。关门/加载故意hover原暂停坐标，HUD所有伪元素hidden/opacity0。

最后额外abort8个真实门庭PNG请求，decode失败后CSS双门仍可点击，7头像加载及真实首帧揭幕后回到原书屋，完整world不变。主输入草稿不变、recover请求0、页面异常0、外网请求0。浏览器、Host与runtime均已退出。最终完整结果/索引见RESULTS与EVIDENCE_INDEX。
