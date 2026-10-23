# 错误回门再进入：真实浏览器验收

**最终已有门庭美术版 PASS。** 实际流程为：错误回到闭门画面并卸载iframe → 用户点击、双门真实旋转 → 七头像加载 → 当前区域真实首帧后揭幕。自动只读核对成功不会绕过用户点击。再次读取失败会回到闭门状态，未自动恢复上一版本或重放保存。

最终运行：[integration-04/validation.json](integration-04/validation.json)，source `34781135e25d34ba3a2fa4aea2070d289497f743`，0.9.0-preview.2。包32,199,675bytes /276files，SHA-256 `929d5be8cb72a2ad0c1e9a32b30fc90181c3ceab2d4a6755fd6e884ff19d5638`。103份生产源码、3份bundle、门庭PNG及最终包核对见[FINAL_HASH_CHECK](FINAL_HASH_CHECK.json)。

## 最终真实覆盖

1. abort真实heartbeat请求，产生CONNECTION_TEMPORARY；闭门画面可操作，旧iframe为0。解除网络故障、等待自动只读核对成功后，仍闭门且不揭幕，世界和保存次数不变。
2. 正常点击门按钮，约200ms后采集中途图及computed transform。两扇美术门叶matrix3d的cos项分别为0.312981、第二次重试0.439796，sin项正负对称；明显非identity。美术stage opacity=1，未因按钮disabled整体褪色。可直接查看[开门中途图](integration-04/courtyard-reentry-opening.png)及录像。
3. 暂缓一次真实frame HTTP响应，确认7头像、blocking=true、firstFrame=false；放行后由真实renderer首帧ACK完成揭幕。没有伪造进度/ACK/world/ticks。加载是已有头像顺序填色组件。
4. 第二次故障使state读取失败；点击后再次关门，diagnostics保留，完整world与用户暂停不变。最终恢复前后无重复save，无recover或preferences-recover请求。全流程3次save来自初次初始化、正常暂停和正常前往书屋。
5. 实际320×360卡片、深色、减少动态重复闭门→加载→恢复；按钮、说明和诊断入口清晰。减少动态时跳过门动画，仍保留点击与真实首帧门禁。
6. 通过正常布置UI前往书屋，再触发真实故障，最终恢复同一书屋及完整world，没有回庭院或重置。
7. abort八个真实门庭PNG请求，浏览器图片decode失败后显示CSS备用双门；仍可正常点击、七头像加载并回到原书屋。见[图片失败备用门](integration-04/art-decode-failed-css-fallback.png)。

闭门、开门和加载时均故意hover旧HUD暂停按钮坐标，检查 `.village-entry-ui` 为hidden，所有HUD `::after`伪元素visibility=hidden、opacity=0，修复此前“继续”提示穿透。主输入草稿不变；零页面异常、零外网/模型请求。所有证据在独立profile生成，未访问日常DSH_HOME。

## 已有美术与预算

manifest状态为APPROVED，来自用户明确授权启用已有资源。八张PNG分别核对hash、字节数、宽高，并与启用前commit `98c5383471781443176a73f21abb246053ecdcd2` 的Git blob逐字节相同，没有重画、替换或重压缩。

| 指标 | 实测 | 原预算 |
| --- | ---: | ---: |
| 层数 | 8 | ≤8 |
| PNG总字节 | 2,749,401 | ≤4MiB |
| 解码像素合计 | 1,773,738 | ≤8,000,000 |
| RGBA像素存储估算 | 7,094,952bytes | 像素×4，仅估算 |

闭门截图等待data-art-ready=true，metadata记录八张图的自然尺寸与complete。此处是资源静态预算核对，不是GPU内存或帧率实测。

## 保留的历史运行

| label | 结论 |
| --- | --- |
| integration-01 | 首候选功能6项PASS；后续目检发现真实HUD tooltip泄露，不能当最终视觉通过；开门图采样过早 |
| integration-02 | 修复tooltip后CSS门完整6项PASS，含约200ms明显门叶旋转；后续用户批准既有美术，故只作历史候选 |
| integration-03 | QA准备阶段git show默认缓冲不足，ENOBUFS；未启动Host/浏览器，修脚本缓冲后用新label |
| integration-04 | 最终APPROVED美术版完整7项PASS，含图片decode失败备用门 |

旧记录未覆盖或改写，详细根因见[RUN_NOTES](RUN_NOTES.md)。此前0.9数据与性能证据保持冻结。

## 边界与结束状态

本轮为真实组件和官方鉴权Host的隔离Chromium/SwiftShader验收，没有重新测试原生Desktop安装、GPU/性能预算、全部历史玩法或长时耐久。已批准的是现有门庭美术，不等于批准书屋等其他预览美术。父进程的全量268项、strict types/release/pack/offline结果另行记录。

最终所有本轮runtime、Host、浏览器和exec会话已退出，无并发写证据；当前headless进程数0。脚本和证据冻结，供主agent统一提交。
