# AI 小院：七角色美术交付

用户要求沿用已经完成的 DeepSeek 拟人形象风格，完成其余角色的视觉、基础动作和场景动作，并委托实施中直接检查，不增加中途验收门槛。美术制作使用内置 image_gen；裁切、配准和验证图组合使用 Sharp，未用代码绘制替代人物。

## 交付范围

| 角色 ID | 角色识别 | 基础与场景资源 |
| --- | --- | --- |
| bluewhale | 蓝发鲸尾、蓝白女仆服 | 已批准的 20 张部件及场景配套 |
| claude | 铜橙长发、雏菊、学者风衣裙 | 16 张独立透明部件 |
| gemini | 蓝紫猫耳、异色眼、星形头饰 | 16 张独立透明部件 |
| gpt | 白发龙角、银紫衣裙、龙尾 | 16 张独立透明部件 |
| grok | 金色双马尾、小皇冠、黑红裙 | 16 张独立透明部件 |
| kimi | 银白长发、月亮与音符、蓝白裙 | 16 张独立透明部件 |
| qwen | 紫蓝发辫、小贝雷帽、中式衣裙 | 16 张独立透明部件 |

六名新增角色每套包括四张表情头部、躯干、左右常规手臂、左右腿脚、两只工作手臂、两只用餐手臂、完整坐姿、后发和尾巴/饰物。每位提供 idle、walk、pickup、dragging、put_down 五段 JSON 关键帧；工作写字、吃饭抬勺与休息呼吸由场景状态驱动。动作会带动头部、身体、左右腿、头发和饰物，不是整体图像平移。

实际渲染采用正面纸娃娃，保留不对称饰品的位置；没有宣称提供额外侧面/背面转身图或独立 Cubism 模型。方向用于世界移动，立绘不会整张镜像。

## 生成、修正与验收

风格输入为 `art/approved/bluewhale-neutral-v01.png`，角色身份来自用户 `live2d_assets/Character-reference`。六套初稿均为 1254×1254 RGBA 图集；Claude、Gemini 使用第二版修正格间留白、躯干残留手臂及重复手部，Kimi 持碗手臂独立重绘。后发替换试稿因带不透明底被拒收，未进入运行包；实际采用原图集的原生透明后发，经裁切排除邻格碎片。

制作脚本保留原生 RGBA，仅进行明确矩形裁切和骨架尺寸/锚点配准。GPT、千问左右常规手臂按实际朝向重新分配，不通过镜像整个人物修正。Gemini 尾巴裁切排除了相邻格的持碗碎片。

逐项检查了透明底、头身比例、独立肢体连接、四种表情及家具遮挡；随后在实际游戏的 108 逻辑像素角色尺寸下检查七角色的工作、吃饭和坐姿。资源清单的 `approvedForRelease` 表示执行用户委托后的代理检查，`approval.source=delegated-agent-review`，没有将其冒记为用户逐图批准。

## 复现与证据

- [结构化提示词](../../packages/ai-village/art/prompts/roster.json)与[完整生成和修正记录](../../packages/ai-village/art/prompts/roster-generation-record.json)。
- 原始图集：`packages/ai-village/art/work/roster/`；运行部件：`assets/characters/<id>/parts/`。
- 每位 `manifest.json` 记录来源、裁切矩形、原生尺寸、字节数与 SHA-256，`character.json` 记录骨架，`animations.json` 记录动作。
- [拼装总览](../../packages/ai-village/art/QA/roster/assembled-contact.png)、[场景动作总览](../../packages/ai-village/art/QA/roster/activity-contact.png)和 `art/QA/phase5/` 的 21 张真实 Desktop 动作截图。

```powershell
node scripts/ai-village-roster-assets.mjs
node scripts/ai-village-roster-preview.mjs
node scripts/ai-village-phase4.mjs check
```

素材裁切发生变化时制作脚本不会沿用旧检查结论，须重新核对后更新清单。构建会校验所有资源的哈希与发布状态。正式包只含运行图像、定义、代码和许可证，不含生成源图、截图、临时 profile 或用户参考原图。
