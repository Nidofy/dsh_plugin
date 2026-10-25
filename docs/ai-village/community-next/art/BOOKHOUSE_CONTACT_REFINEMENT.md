# 书屋蓝鲸动作精修：真实 PaperDoll 样板

2026-10-25。状态 **ENGINEERING_REVIEW_NOT_APPROVED**，仅独立候选；未修改生产源代码、世界几何或正式资源清单。地图批准不覆盖本记录。

## 实际修正

书柜旧预览只有一个放在角色前方的书本道具，两只原站姿手没有稳定接触书角。本轮使用内置 image_gen 生成 `bluewhale-held-book-arms-v01.png`：两只带蓝鲸专属袖口的手与书本同时绘制，书角握持在同一透明层内。原 PaperDoll 只隐藏旧两臂，保留头、脸、发、身体、腿和尾巴；新活动层挂在 body 下，与身体同一姿态变换，替换旧悬浮道具。实际读书图明显改善手书接触。

窗座的固定脚点是 `(92,270)`；候选座面取 y225，因此目标座面至鞋底为45逻辑像素。前一张完整坐姿按108px渲染时这一距离目视约27px（人工估计，并非碰撞数据），缺约18px，造成身体停在座前。没有修改场景家具 `(44,198,116,42)`、互动脚点或合法空间。

针对差值先生成 `bluewhale-seat-body-v02.png`，再精确去掉上身重绘为 `bluewhale-seat-lower-v03.png`。原生透明裙腿层在生产 PaperDoll 内作为独立 part；保留原角色头/表情/头发/尾巴。前三轮暴露了肩袖过高、上身和裙腰重叠问题，故逐轮保留 QA，而非隐藏不合格结果。

最终 v04 使用明确的角色美术配准：源图 `(628,600)` 是本样板采用的裙部座面注册点，鞋底注册点 `(628,1232)`。裙腿下段等比映射为45px；腰部源 y315–600 独立映射为7px，并与下段共用边界。此处是可审阅的角色姿态纹理映射，不是更改世界碰撞。上身抬高70 rig px（8.4逻辑px），裙腿反向补偿70 rig px，故真实脚底、座面保持原位。原 torso 缩短到85 rig px，恢复蓝鲸领口而不产生多余袖口。没有水平镜像、整块矩形遮挡或背景烘焙。

## 真实渲染验证

命令：`node scripts/ai-village-community-bookhouse-contact.mjs`。

入口是 `packages/ai-village/art/candidates/community-next/bookhouse-contact-renderer.ts`，直接导入生产 `PaperDoll`、`samplePose` 和 `bookhouseScene`。既有 v02 十张书屋层按原 SHA 校验后复用。严格 TypeScript、离线 Pixi 构建通过。

最新证据在 `packages/ai-village/art/candidates/community-next/bookhouse-contact-qa-v04/`，32张图：时间0/.4/1.4/3.25（包含眨眼）×昼暮×明暗×DPR1/2。每张四格对照旧/新书柜及旧/新窗座。页面错误与外部网络请求均为零，ticker未启动。

验证不是只比较预填公式：使用真实 Sprite `toGlobal()` 再经 content `toLocal()` 回算座面和鞋底，在全部32组样本中分别得到 `(92,225)` 和 `(92,270)`，误差 <0.001；书柜脚点始终 `(276,268)`。头部旋转和眨眼继续使用原 `samplePose`，坐姿支撑部位固定，不能被呼吸 bob 推离座面。

已目视 `contact-t0.4-day-light-dpr1.png` 和 `contact-t3.25-dusk-dark-dpr2.png`。当前蓝鲸握书与窗座姿态足以单独提交视觉审阅；完整书屋仍未获得批准。

源提示词、两项最终PNG尺寸/字节/原生alpha/SHA、实际使用的生产渲染实现SHA及全部截图SHA均记录在 `bookhouse-contact-prompts.json` 和 `bookhouse-contact-qa-v04/validation.json`。图片为内置 image_gen 原创资源，MIT；原始PNG字节未通过脚本重绘。早期 v01/v02/v03 QA 保留。

## 剩余资格门禁

目前只精修蓝鲸，不能把其专属袖口或裙腿用于其余十一位居民。新的裙腰压缩和上身姿态属于可见设计选择，仍须用户视觉签收。软件 WebGL/浏览器 DPR 不等于硬件GPU或系统DPI。当前样板没有运行完整世界故事、七人寻路、存档冷恢复、生产纹理生命周期；这些以及资源尺寸优化和最终包身份均需在正式接入前完成。

下一项可执行工作：以本样板的固定脚点、透明活动层接口为基础，分别为其余居民制作身份一致的握书/窗座动作，并复用此矩阵验证。已完成蓝鲸的配准和代码入口不需重新调查。
