# A checkpoint 3bd04fa 独立评估

A_SHA: 3bd04fae1d859b5acc38ed4348a9b11a45c12184
QA code commits: 75abafdab896f7728d6c8bc23722fe0750c48440, 5ca6e8f, 8c8361c263c7b251e16105ac34d84beb53d3badc。
隔离 checkout: dsh_plugin-entrance-eval-3bd04fae1d85-75abafda。生产文件与 A_SHA 完全一致。

- 58 单测 PASS；包括 DQ-ART-01，null 图层回退已修复。
- QA 严格类型与生产/受限预览夹具构建 PASS。
- 12 生产浏览器场景 PASS，含 100 次 sidebar/尺寸轮转。
- 8 组候选关键帧、approach/open/cross 隐藏、open resize、open 断连、美术404，共 14 场景 PASS。
- 最终8张 PNG逐字节等于源compat；2,749,401 bytes / 1,773,738 pixels，预算 PASS。
- 新发现 DQ-SEAM-01：闭门中心透出底色，P2 FAIL。

## DQ-SEAM-01

环境：Windows x64 / Chromium headless SwiftShader，使用 A 自带受限 reviewMotion 开启 DOM 动画。不是硬件 GPU 签收。

复现（在 eval）：

    node scripts/ai-village-dualqa-build.mjs --review
    node scripts/ai-village-dualqa-review.mjs seam-probe

期望：门关闭且真实首帧 ACK 仍被保留时，改变入口后方诊断底色，不应改变安全门洞内部像素。
实际：26,522 个采样像素中 298 个变化超过 RGB 2，最大通道差 56。此批名义580×720，实际 card 截图580×718（最终复测将精确校准到580×720）。
证据：[浏览器量化](integrated-review-seam-probe.json)；截图在 packages/ai-village/art/QA/entrance-dual/qa/evaluation-3bd04fa/integrated-review/seam-probe-*，全图差异在 compare/candidate-closed-seam-*。

独立 Alpha 重建：安全区内 86,991 个设计像素中 1,084 个透过率 >1%；集中在设计 x=538..541，最大3.9216%。门轴与源几何一致，外景层在安全区不遮挡。浏览器额外存在子像素/插值影响，不能把3.9%直接等同于最终屏幕透过率。

严重度 P2：一条很细的闭门视觉缝隙，不绕过协议门控，不导致存档或交互提前释放。正式 ART04 “关闭无缝隙”尚不能签收。

建议 A：调整派生门扇边缘 Alpha/闭合重叠或提供随门扇运动消失的受控封缝，保留原始源hash与开门后真实透显。不要改预算、不要把诊断底色测试放宽成通过。修复后原样重放探针。
