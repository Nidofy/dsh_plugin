# 0.11 书屋分层美术候选与签收边界

2026-10-24。源 HEAD：`fb47baa2d3a9366ceae95dfeab7c38d5bd37e939`，工作树与本轮功能工作并行。美术来源为内置 `image_gen`，原创资源按仓库 MIT 许可交付。**当前状态仍为 `LAYERED_REVIEW_CANDIDATE`，`approvedForRelease=false`、`runtimeEnabled=false`。** 这次已交付可合成的独立层，不再只有整幅概念图；尚不能将其写成正式书屋已签收。

## 可审阅入口

- [交互合成预览](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/preview.html)：可选十二居民、三处家具、前层开关、固定几何与主题示意。此简易 Canvas 页面用于快速看构图，正式候选对照使用下一项生产 PaperDoll 矩阵。
- [空场景合成](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/preview-empty.png)、[Llama 三处接触示意](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/preview-llama-activities.png)、[冻结几何](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/preview-llama-geometry.png)。
- [背景三版取样对照](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/background-registration-comparison.png)。
- 最新真实 PaperDoll 候选矩阵：[`matrix-v03/validation.json`](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v03/validation.json)。三处家具 × 日/暮 × 浅/深底色 × DPR1/2 = **24 张 contact sheet、288 位次**；每张包含全部十二人。另有 **8 张明确标注 REST PROPOSAL 的窗边坐姿提案，96 位次**，不混入实际姿态结论。
- [阅读桌／日／浅／DPR1](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v03/reading-desk-day-light-dpr1.png)、[书柜／日／浅／DPR2](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v03/bookcase-day-light-dpr2.png)、[窗座当前姿态／暮／深／DPR2](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v03/window-seat-dusk-dark-dpr2.png)、[窗座坐姿提案／日／浅／DPR1](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v03/window-seat-rest-proposal-day-light-dpr1.png)。

## 来源、分层和像素数据

[原始提示词集](../../../packages/ai-village/art/prompts/bookhouse-layered-v02.json)、[背景再次编辑提示词](../../../packages/ai-village/art/prompts/bookhouse-layered-v02-background-v03.json)、[完整 manifest](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/manifest.json) 保存生成路径、每张 SHA256、像素尺寸、字节、原始 alpha 外接框、实际 `sourceRect`、世界 `rect`、z 和批准状态。背景参考已批准庭院的绘本风格；家具和道具分别生成原生透明 PNG。没有程序抠图、补色或强制 alpha；保留工具原始 PNG 字节。

| 层 | 世界 rect：x/y/w/h | z | 用途 |
| --- | --- | --- | --- |
| background-v03 | 0/0/360/480 | -100 | 空墙、窗景、地板、灯和静态光，不含家具 |
| bookcase-back | 234/126/86/106 | 1259 | 背板、框、三层书架 |
| bookcase-front | 234/232/86/8 | 2400 | 独立前踢脚 |
| desk-back | 123/292/37/34 | 2919 | 椅背，完全在冻结桌子矩形内 |
| desk-front | 72/292/140/67 | 3590 | 桌面、桌沿、前腿；腿之间原生透明 |
| window-back | 44/198/116/29 | 1979 | 座背及软垫 |
| window-front | 44/222/116/18 | 2400 | 座缘和短腿；与后层重叠 5 世界像素 |
| prop-open-book | 258/230/36/21 | 2683 | 书柜活动打开的书 |
| prop-paper-pencil | 122/298/38/22 | 3598 | 桌面纸笔 |
| prop-window-book | 110/236/12/17 | 2703 | 窗边小书 |

家具冻结几何继续为书柜 `234/126/86/114`、阅读桌 `72/292/140/67`、窗座 `44/198/116/42`。碰撞、hotspot、split、世界坐标和生产绘制代码均未修改。这里前后层采用显式 rect，不能擅自改成用现有 split 比例裁图；窗座重叠及桌面覆盖区需要保留。

### 透明外接框修正

初次检查采用全部 `alpha>0` 外接框；发现生成图存在距离主体很远的 alpha1–7 离散像素。例如踢脚外接框高度 868 源像素，实际可见主体只有约 129 像素，直接缩放会把踢脚压扁。初次 [`matrix/`](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix/validation.json) 作为问题证据保留。

最终家具／道具的**取样框**采用 `alpha>=8` 外接框加四个源像素边缘。原始文件、原始 alpha 均不改写；取样框外略去的非零像素数量及最大 alpha 逐文件写入 manifest，断言最大略去 alpha `<8`。alpha240–255 内部像素与 alpha0 外部均存在；大量内部 alpha254 是生成原值，不伪造全不透明。所有源图仍可在签收时查看完整边缘。第二版 [`matrix-v02/`](../../../packages/ai-village/art/deliverables/bookhouse-layered-v02/matrix-v02/validation.json) 保留了取样框修正但尚未注册背景的状态。

### 背景墙脚注册

背景经过两次独立 image_gen 定向编辑：旧 `background.png` 墙脚约世界 y235，`background-v03.png` 原图横向墙脚／地板明暗跳变为源像素 y682（约世界 y226.08），没有把这两张宣称为模型精确绘制到 y220。

最终仅使用背景取样框注册：求解 `(682-top)/(1448-top)×480=220`，得到 `top=33.846153846`。`sourceRect=[0,33.846153846,1086,1414.153846154]` 保持全宽和底边，将测得的墙脚映射到世界 y220。原图不修改，冻结几何不修改；顶部少量裁去、纵向比例略变，是明确需要签收的美术取舍。中央木柱基座的自然凸起不属于水平墙脚测量线。三栏对照保留原图和注册后的实画，不能将裁框说成模型本身满足了精确坐标。

## 遮挡检查与尚未通过项

矩阵直接调用生产 `PaperDoll`、`samplePose`，从 `bookhouseScene` 读取脚点，体高108、固定0.4秒 neutral。身体 z=脚点 y×10；桌活动隐藏站立手臂/腿，使用生产工作手臂尺寸175×200与现有锚点。桌前层3590、纸笔3598、工作手臂3600；无额外世界状态或第二套运行执行器。

| 检查对象 | 当前观察 | 判定 |
| --- | --- | --- |
| 阅读桌 | 十二人身体位于桌面后，前手臂与纸笔可见，前腿间真实透明，头发未被矩形遮罩截断 | 静态候选接触可审阅；完整动画周期、移动入座及运行照片仍待验收 |
| 书柜 | 书在脚点 `(276,268)` 相对 `(-18,-38)` 处，尺寸36×21；身前遮挡符合现有 prop z；没有新增 read 专用握书姿态 | **未通过手部贴合签收**。当前 idle 手臂与书边并非所有人双手稳定相握，需独立调整表现并跑动画相位，不能改脚点迁就道具 |
| 窗座当前姿态 | 现有 `sit` 使用 idle 纸偶，脚点 `(92,270)`，居民站在窗座前 | **未通过坐下表现签收**；真实矩阵保留这个问题 |
| 窗座 REST PROPOSAL | 不移动脚点，仅使用现有 rest-pose、底部锚点和高度96；画面明确标注提案 | 现有图闭眼抱膝，结果更接近坐在窗座前的地板，仍非读书坐上凳面；小书会浮在手侧。**不应自动启用** |
| 背景 | 取样框注册后测得墙脚y220；与三家具分层合成不再漂浮于错误墙脚 | 裁框及整体构图仍需用户视觉签收 |

浅/深仅表示审阅页面底色，暮色使用当前背景 tint `0x9eaccd`、内容 tint `0xd2dcf0`。这是候选图层叠加生产着色规则，不是已经接入正式 UI、专门绘制夜间背景或真实 Desktop 截图。矩阵采用软件 WebGL 和浏览器 DPR，不声称覆盖真实 GPU、系统 DPI、休眠/恢复或最小化。

## 验证与资源成本

```powershell
node scripts/ai-village-bookhouse-art-preview.mjs --capture
node scripts/ai-village-bookhouse-art-matrix.mjs
```

专用矩阵入口通过严格 TypeScript 检查与浏览器 bundle 构建；PNG 源 hash 对照已批准角色 manifest；32张最终候选图均检查十二人脚点、ticker停止、无浏览器错误、无外部网络。输入的实现文件 hash、源图 hash、截图 SHA256 和每个采样条件保存在 `matrix-v03/validation.json`。历史 matrix 与 matrix-v02 没有覆盖。

选中十张候选主图总计 **15,885,839 bytes（约15.15 MiB）**；未裁图主纹理解码 **62,903,752 bytes（约59.99 MiB）**。sourceRect 不会减少底层图片解码成本。这些是原尺寸美术母图，不是已优化发行纹理；不扩大既有预算来容纳它们，也不计入本轮正式离线包的资源表现。`art/` 不在当前 npm 资源白名单中。

仍需完成：精确手部握书表现、窗座正式坐姿及书本接触；必要的透明边缘精修与按使用尺寸生成运行资源；正式渲染器完整活动/七人绕行/取消/往返/冷恢复和照片；320×360、340×720、580×720及宽屏实运行 UI；最终包资源预算、加载/释放和真实 GPU；原生系统 DPI、最小化、休眠恢复；独立用户视觉签收。以上均不能由这组静态候选测试替代。
