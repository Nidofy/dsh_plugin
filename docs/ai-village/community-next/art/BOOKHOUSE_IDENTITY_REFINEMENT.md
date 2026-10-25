# Claude / Gemini 独立接触层续作

本轮继续实际制作，未改生产资源、核心代码或家具几何。资格为 **ENGINEERING_CANDIDATE_NOT_APPROVED**。背景和家具十层已可独立评审；角色接触的缺口不等于背景未制作，也不能反过来由背景观感替整场景签收。

## 交付与检验

生成 Claude 自己的橙花奶油袖握书层、橙黑裙与靴坐姿下半身，以及 Gemini 自己的紫星喇叭袖握书层。原头脸、头发、服饰参考均来自各自原身份，不复用蓝鲸服装。三个原始 PNG、原提示、源/参考 SHA-256、尺寸、alpha 统计、MIT 项目资产策略与未批准标志见 `packages/ai-village/art/candidates/community-next/bookhouse-identity-manifest.json`。

`bookhouse-roster-renderer-v03.ts` 直接使用生产 PaperDoll / samplePose / bookhouseScene。12 人 × 三站位 × 昼暮 × 340/580 的原矩阵继续生成；另保留原休息动作提案，22 张登记截图加 12 张三人焦点图。窗口新坐姿在 0、0.4、1.4、3.25 秒检查，ticker 停止，零页面错误、零外网请求。软件 WebGL DPR1，不等同宿主、真实 GPU 或最终包验收。验证入口：`node scripts/ai-village-community-bookhouse-roster-v03.mjs`；源审计：`node scripts/ai-village-community-bookhouse-identity-audit.mjs`。

## 配准与迭代

Claude 裙腿原图 1230×1278，坐面源 y500，鞋底基线 y1185，源差 685px。目标坐面 y225、冻结 feet y270，差 45 逻辑 px；原站姿的头部最下沿约 y230，使新握书层被头遮住。v02 保存了这个失败；v03 握书层移到 rig y620、z9，使书和双手位于胸前，世界脚点仍不动。

坐姿下段框 `[84,500,1068,685]` 以 `45/685/.12` 缩放；上段 `[84,87,1068,413]` 压入 y218–225 的裙腰区域。原 torso 只取上部 115px 的原纹理，仍保留原领花、胸衣。身体上移 130 rig px，裙腿反向补偿，原头脸和头发继续动画。实际 Sprite.toGlobal 再 content.toLocal 的髋点为 (92,225)，鞋底为 (92,270)，0/1.4/3.25 秒在两种宽度均断言通过，0.4 秒记录在主矩阵。不是只校验公式。

Gemini 独立坐姿生成在输出阶段被图像服务安全系统拒绝（HTTP400, moderation_blocked, other；request ID 60983d11-b4c3-4877-b947-5b4d0a3b456b）。没有输出资产，也没有重试规避。另以原批准 rest-pose 下半部作真实 PaperDoll 可行性测试：源 hip-to-sole 99px 强制映射45px后，原前伸鞋过大、裙侧截线明显。**此提案 FAIL**，保留截图但不能进入生产或算作已合格坐姿。

## 当前结论与其他九位评估

| 范围 | 资格 |
| --- | --- |
| Claude 书柜握书 / 窗边坐姿 | 已有真实工程样板，可进一步视觉评审；未获用户批准 |
| Gemini 书柜握书 | 已有真实工程样板，可进一步视觉评审；未获用户批准 |
| Gemini 窗边 | 不合格；原 rest 纹理不能自动推广为高窗座腿层 |
| 两位书桌 | 沿用各自原活动臂，未套用他人衣装 |
| GPT/Grok/Kimi/Qwen/Seedance/GLM/MiniMax/Llama/Mistral | 仍沿用原角色，书柜手书接触和窗座支持关系待逐个制作验证 |

方法复用结论：共享 PaperDoll 配准与双手持书策略可复用；服装像素必须逐人生成。坐姿无法只套同一剪裁与缩放参数，Gemini 的失败已证明这一点。因此不把剩余九位批量标为完成。整书屋仍未通过全12角色接触门禁，且未进行此候选的最终资源预算、生产接入、宿主和包验收。

快速评审：`packages/ai-village/art/candidates/community-next/bookhouse-identity-review.html`。v02 / v03 与此前蓝鲸 v01–v04 均保留。

## v04：区分坐姿鞋底与世界投影脚点

主线程指出“冻结合法交互脚点”不要求高窗座的小个子鞋底必须接地。本轮据此新增 v04 表现层实验，修正了上面 v03 对 Gemini 的过严几何假设，未删除失败记录，也未重试被拒绝的生成请求。

Gemini 继续使用各自批准 rest 原纹理 `[50,245,196,115]`，改为等比 `25/99/.12`。髋点 (92,225)、视觉鞋底 (92,250)、世界投影脚点 (92,270)。新的鞋/腿与头身比已自然，不再出现强拉到地面的巨大鞋；坐姿体现悬空双腿。原角色脸、头发、星袖、尾巴保持，站立、行走、书桌、书柜仍使用原脚底契约。世界 root、家具 rect、碰撞、深度、路径均未改。不能把新的视觉鞋底250称为通过旧鞋底270断言。

真实 Sprite.toGlobal / content.toLocal 分别断言髋225、鞋底250，独立断言世界投影270。Claude 仍为髋225/鞋底270。两种宽度 × 0/1.4/3.25秒均通过，0.4秒同时记录于主矩阵。`projection-debug-340.png` 与 `projection-debug-580.png` 显示 Gemini 橙色髋点、绿色视觉鞋底、洋红地面投影；普通焦点图没有诊断标记。22 张登记截图 + 12 张焦点截图 + 2 张投影诊断图，零页面错误、零外网请求。

最新入口为 `node scripts/ai-village-community-bookhouse-roster-v04.mjs`，最新矩阵 `bookhouse-roster-qa-v04`。Gemini 窗边资格现为 **可继续视觉评审的原资产派生工程候选**，不是新生成坐姿，也未获用户批准。此前表格 FAIL 指 v03；整书屋其他九位接触门禁仍未通过。这个成功说明可先按每人原 rest 的自然姿态与悬腿位置逐个评估，不能据此假定九位自动合格。
