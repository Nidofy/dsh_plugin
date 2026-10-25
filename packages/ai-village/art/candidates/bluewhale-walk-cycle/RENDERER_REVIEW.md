# 蓝鲸三朝向独立renderer评审

2026-10-25。结论：**工程预览可运行；视觉资格未通过，不注册生产，不请求本轮视觉批准。**

打开[preview.html](preview.html)，点击播放或真实路径。正面使用生产`PaperDoll/samplePose`的idle/walk，侧左使用四张独立帧，背面使用A→neutral→B→neutral；右侧仍显示原正面并标明fallback。没有任何镜像。0.18秒crossfade只是一种临时显示转接，没有新增转身原画。

## 实际运行与边界

命令：`node scripts/ai-village-bluewhale-cycle-review.mjs`。脚本检查独立renderer的严格TypeScript，构建本地自包含HTML，运行真实Pixi WebGL。最终证据是[renderer-qa-v03/validation.json](renderer-qa-v03/validation.json)：DPR1/2共38张截图、8组行为检查通过，0页面错误、0网络HTTP请求。GPU实际为SwiftShader，不能称真实硬件或系统DPI验收。

独立fixture导入实际`LivingController`与`requestManualMove`，从书屋入口(48,402)请求(300,310)，使用冻结书屋障碍、现有导航与17单位/秒步进。两DPR均在479个模拟tick到达，最大记录单步0.5666666666666681（17/30的浮点误差），没有注入居民坐标或跳阶段。在途暂停/模拟隐藏/减少动态保持tick、脚点和整条意图不变；停止在当前位置取消，新命令可继续。另检查真实RAF播放和UI暂停。

这是**没有Host/SaveStore/lease/CAS的独立确定性控制器fixture**，并非生产owner或安装包旅行验收；模拟tick循环不等于479帧真实墙钟运行。页面有真实`visibilitychange`/`document.hidden`保护；本轮测试明确覆盖“模拟隐藏”控制，未测试原生最小化/物理睡眠。

初轮`renderer-qa`发现DPR2 canvas没有autoDensity，CSS尺寸放大导致截图裁切。独立renderer已修正，v02/v03逐DPR断言CSS=1100×780、像素=CSS×DPR。初轮目录保留但不作为最终视觉尺寸证据。v03进一步验证了真实在途意图冻结和停止，不只在静止世界里检查时钟。

## 源图与注册

[registration.json](registration.json)记录人工观察的头顶、头部跨度、髋部、两鞋底和地面基准。读取精度约±10原图像素（约±0.9逻辑像素），必须继续人工复核，不能当精确解剖测量。每帧只做全画布等比缩小至256×256；未裁剪、拉伸、重画、改透明或镜像。原始8张PNG运行前后SHA一致。

世界脚点是控制器给出的合法位置，图像原点注册到髋部x与手工地面y；不会用亮度、alpha边界或鞋图推导世界碰撞。每张图将手工“头顶至地面”高度映射到108逻辑像素。缩图、源hash、原生alpha计数、尺寸与逐帧测量均在validation.json。两张跨格`left-cycle-*-unqualified.png`没有进入payload、缩图、纹理或循环。

| 测量范围（108尺度） | 侧左4帧 | 背面A/neutral/B |
| --- | --- | --- |
| 髋部高于地面 | 38.82–39.52px，差0.71px | 41.63–42.05px，差0.42px |
| 手工头部跨度 | 39.52–39.93px，差0.41px | 48.93–49.37px，差0.44px |
| 头跨度/下方身体跨度 | 0.705–0.719 | 1.034–1.051 |
| 接触或抬起的鞋底y | 地面0至约-5.0px | 地面0至约-6.2px |

背面的头部跨度包括可见后脑/发区，与侧脸不同，不能据这个比率直接断言解剖尺寸相同；跨方向头身比与原正面rig的观感仍需独立精修。图中绿色是人工地面/原点，橙点是髋，粉点是两鞋底，均为审阅标记。

## 视觉判断与资格缺口

- 左侧passing A/B能看出交替抬脚；contact A/B的领先脚/跨步轮廓仍很接近，不能仅因四文件不同就称完整交替接触循环合格。侧左仍偏三分之四侧面，应继续对照角色方向规范。
- 背面A/B能看出支撑腿交换，但两个相同neutral过渡带来停顿感；unused rear-passing只在逐帧栏展示，未偷偷替换既定循环。背面大块头发、围裙飘带与尾巴在相邻帧仍有轮廓变化。
- 髋和头部在同朝向的人工量测波动不到1px，但这不能证明无滑步。当前周期4×0.18=0.72秒，17单位/秒只前进12.24单位；鞋底横向偏移和接触更换没有足底锁定。下一轮需要逐接触相位检查支撑足相对世界的漂移，而不是继续移动世界脚点迁就素材。
- [转向中点截图](renderer-qa-v03/left-to-rear-crossfade-half-dpr2.png)出现明确双轮廓重影。它如实展示0.18秒工程crossfade的局限；不能叫做转身原画。停止可立即取消世界行走，侧左停在A、背面停在neutral，仍无独立减速/落脚停步原画。
- [背面帧](renderer-qa-v03/rear-frame2-dpr1.png)、[左passing帧](renderer-qa-v03/left-frame1-dpr1.png)及[真实路线到达](renderer-qa-v03/real-controller-arrived-dpr2.png)已目视。右向到达截图保留原正面fallback；不存在四方向完成或十二居民完成的结论。

## 纹理与内存预算

8张256×256独立缩图共680,171压缩字节，RGBA估算2,097,152字节（2MiB）。其中7张用于左/背循环，另一张只作审阅。正面20张既有纹理由三个原rig实例共享，RGBA估算17,371,468字节；本预览全部纹理RGBA估算19,468,620字节，不含framebuffer、驱动开销或JS/DOM。这个数字是尺寸×4的预算，不是实测显存常驻量。

预览、renderer、注册数据、缩图及QA仅位于本候选目录；构建验证脚本独立。没有修改生产src、definitions、原角色资源或安装包，未向生产地图/owner注册本样板。
