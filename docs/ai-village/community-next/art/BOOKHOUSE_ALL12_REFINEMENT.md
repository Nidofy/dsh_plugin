# 全十二角色书屋接触候选与图集

本轮已从蓝鲸样板扩展到十二角色实际 PaperDoll。用户已明确批准整场景和十二角色握书/坐姿，并要求验证通过后默认启用。正式资产已复制到 assets/bookhouse；普通活动与共读剧情已接入，同步进行正式运行验证。以下候选历史记录保留。背景/家具十层、十二人的各自可见双手握书与独立坐姿均已完成制作。

## 实际完成

新增九人的握书 PNG（GPT/Grok/Kimi/Qwen/Seedance/GLM/MiniMax/Llama/Mistral）使用各自已批准原休息姿态为服装身份参考；加上蓝鲸、Claude、Gemini 共十二种，不共享衣服。透明原 PNG、提示、参考和输出 hash、alpha 统计均在 `bookhouse-complete-manifest.json` 及对应 prompts 中。

窗座 Bluewhale/Claude 继续各自生成裙腿层，其余十人复用各自原 rest 纹理的明确 sourceRect。新部件加入原 PaperDoll，保留原头脸、头发、饰物和动画；不镜像、不画矩形遮罩，不动家具、world脚点、碰撞和路径。书桌沿用各自原书写臂。

| 角色 | 窗座处理 | 鞋底/投影区分 |
| --- | --- | --- |
| Bluewhale / Claude | 独立裙腿层 | 髋225，鞋底270 |
| Gemini / GPT / Grok / Qwen | 原坐姿下段，按自然比例悬腿 | 髋225，鞋底250，投影270 |
| Kimi | 原前伸左腿，不旋转 | 髋225，鞋底约(80.64,250)，投影(92,270) |
| Seedance | 原前伸左腿及科技衣摆 | 髋225，鞋底约(81.29,248)，投影(92,270) |
| GLM | 原坐姿下段；605高脸对应上身额外抬升 | 髋225，鞋底约(83.07,250)，投影(92,270) |
| MiniMax / Llama | 原休息鞋和衣摆 | 鞋底250，投影270；轻微横向自然偏移 |
| Mistral | 原盘腿，脚被裙子遮住 | 下摆239.4是衣摆标记，不能称为可见鞋底；投影270 |

Grok 独立取框排除原图右侧残片，原 PNG 保留。Gemini 首次孤立身体生成的输出被服务拒绝，未重试；v03过大鞋失败与v04自然悬腿成功均保留。Kimi 握书原图袖缘接近图边，当前配准未暴露明显断口，源图和近览继续供签收。

## 真实验证

原素材版 `bookhouse-roster-qa-v06` 与图集版 `bookhouse-roster-qa-v07` 均为真实生产 PaperDoll/samplePose/bookhouseScene。每版 34 状态样本、408角色站位、48张登记截图：三站位 × 340/580 × 昼暮的全12矩阵，另每站位0/1.4/3.25秒及原休息对照、逐行580近览、投影诊断。0.4秒为主矩阵时间。

十一位新扩展坐姿的实际 Sprite.toGlobal→content.toLocal 断言髋225、各自视觉底部目标和world投影270；蓝鲸此前独立v04已验证髋225/鞋底270。全十二world投影脚点在三站位多时刻断言不变。图集版与原版分别运行；零浏览器错误、零外网请求，ticker停止。真实 TextureSource 对象计数证实十场景Sprite共享1个图像源，十二握书和两套座姿部件共享1个图像源，仍为独立Sprite层。

这是软件 WebGL/DPR1 独立工程夹具，不等同生产world动作切换、宿主首帧、真实GPU/高DPI或最终包验收。尚未证明站立到坐下的动态过渡。暮色由真实Sprite tint模拟，未声称宿主主题端到端。

## 优化候选

`bookhouse-optimized-v01` 保留原PNG，通过固定 sourceRect、Lanczos3缩放和无调色板PNG图集合并；未重画，背景小数裁框和裙腰分割均保留。所有层仍按冻结 rect/z单独渲染。

| 图集 | 尺寸 | 压缩字节 | 基础RGBA字节 |
| --- | --- | ---: | ---: |
| 场景十层 | 1024×968 | 2,003,520 | 3,964,928 |
| 十二握书与两套坐姿 | 1024×640 | 464,708 | 2,621,440 |
| 合计 | 2图像源 | 2,468,228 | 6,586,368 |

以原七人121图像源为基准，保守把两张都视作新增也为123≤128；尚未扣除旧场景或可省略的14张eat活动图。地图须按现有生命周期卸载，不能把同时打开地图算入此预算。此为候选图集的预算与真实夹具共享源验证，最终资源白名单/加载器/包计数仍需主线程完成。

## 可复现入口与剩余资格

运行 `node scripts/ai-village-community-bookhouse-roster-v06.mjs`、`node scripts/ai-village-community-bookhouse-atlas.mjs`、`node scripts/ai-village-community-bookhouse-roster-v07.mjs`，然后 `node scripts/ai-village-community-bookhouse-complete-audit.mjs`。审阅 `bookhouse-complete-review.html`。原v01–v06样例、失败生成记录、拒绝记录均保留。

用户已批准包括深浅袖对比和Mistral盘腿遮脚在内的整套候选，无需再次请求美术批准。生产注册与动作接入已经实施；真实宿主/包验收结论以本轮主线程最终记录为准，候选夹具本身不替代这些验证。
