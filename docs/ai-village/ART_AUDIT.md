# AI 小院：资源审计

审阅日期：2026-10-20。状态：实施前审阅；未制作新美术、未实现游戏。

## 审阅范围与证据

源目录仅只读访问：

- `D:\Documents\FeiyangChen\devApps\dsh_docs\plugin_game`
- `D:\Documents\FeiyangChen\devApps\dsh_docs\live2d_assets`

逐份阅读游戏讨论稿、交接包、历史角色设定、拆层规格、各包 README、制作边界、接入说明、验证说明和 SDK 来源说明。进一步核对正式版 manifest、QA 报告、模型引用、部件定义、制作提示词及关键组装/动作脚本。第三方编译运行库、模型二进制采用格式/清单检查，未逐行反编译；图片全量解码，主参考和 DeepSeek Child 合成图做了目视检查，并非逐张完成美术验收。

| 范围 | 文件数 | 用途与结论 |
| --- | ---: | --- |
| plugin_game | 7 | 5 份 Markdown、manifest 和参考拼图；这是制作交接包 |
| archived | 6 | 历史 Live2D 人设、详细层表与概念图；不覆盖新游戏范围 |
| Character-reference | 8 | 七角色参考及 DeepSeek 拼图 |
| DSH_BlueWhale_Art_v0.1.1 | 248 | 旧静态立绘、47 层可见像素拆件及参考工单 |
| DSH_Characters_Live2D_v0.1 | 700 | 14 套桌面角色模型、PNG/PSD、动画及制作记录 |
| DSH_Characters_Live2D_v0.1_WIP | 743 | 制作历史、旧版本与恢复记录 |
| live2d_assets 根目录其他文件 | 4 | 两个 ZIP、总览 PNG、重复 README |

总计 1,716 个文件，源文件总字节数约 1.72 GB，含压缩包和重复版本。并非游戏包所需体积。

本轮实际执行：

- 全量生成路径、大小及 SHA-256 清单。
- 解码 993 张 PNG/JPG，记录真实尺寸、色彩模式，以及有 alpha 图像的透明范围和内容边界。
- 解析 488 个 JSON、2 个 JSONL，未出现解析错误。
- 35 个 PSD 的像素图层全部通过 Pillow 解码。此项不等同于 Photoshop/Cubism 原生工程验收。
- 两个 ZIP 和一个 ORA 通过 CRC 检查，未解压覆盖源目录。
- 游戏交接 manifest：5/5 匹配。
- 旧蓝鲸包 SHA256SUMS：247/247 匹配。
- 正式多角色包 SHA256SUMS：699/699 匹配。
- 正式版 14 个 model3 的 moc3、贴图、physics、display info 和 84 个动作引用均存在。
- 正式版与 WIP 共有的 699 个同路径文件哈希完全相同；正式版额外包含 SHA256SUMS.json。WIP 的额外历史文件不是新增生产能力。

本地可复核输出位于仓库忽略目录：

- `.build/ai-village-review/audit.py`
- `.build/ai-village-review/inventory.json`
- `.build/ai-village-review/summary.json`
- `.build/ai-village-review/psd-check.json`

本轮未重新运行 Cubism、84 条动作的 Framework 动态检查、全部模型的浏览器检查或官方 Desktop 安装验收。已有 QA 中的这些结果是原资源包记录，不能记为本轮实测。

## 资料版本取舍

游戏交接包是本轮产品规格。历史文档中的主人格助手、真实任务状态、桌宠协作、15 种表情、上百层 Live2D 和 6000px 画布都不属于游戏首版必须项。

WIP 的早期诊断记载过“0/14”、中途 checkpoint 记载过“4/14”；正式 manifest 与 2026-10-20 QA 已记录完成 14/14。本轮文件检查支持运行文件齐全的结论，不能用旧日志认定全部模型仍未制作。

两个 `deepseek_ref.jpg` 都为 2000×1887，目视构图相同，但文件哈希不同：

- 交接包版本：`e98f4c7349378206d2383d1a7d8ddbc58acf6ca2839f4d95a75c7f4dd59846a3`
- Character-reference 版本：`6f5a62d542c6a29f6b512b454687a7e640e5591fb6b3b4353abe909b6727cf21`

后续以交接包版本固定主参考来源，避免只凭同名认定完全相同。主形象具体取拼图**中央下方大 Q 版及右上 Q 版**；顶部中央较修长人物只作细节参考。

## 各资源的实际可用性

### 旧蓝鲸包

- 透明全身画布为 680×1152；适合服饰、色彩和静态参考。
- PSD、ORA、47 张同坐标 PNG 是真实像素分层，但多数仅含可见部分，缺少活动时露出的补绘区域。
- 18 张表情为 107×106 的带底色参考裁图，不是同脸配准的透明替换件。
- 动作、道具和桌宠互动图为单帧参考，不能当作动画序列或成品家具。
- 原说明明确缺失脸底、眼部、肘部、尾根等补绘；不把层数或文件格式通过视为游戏动作就绪。

### 正式多角色包

实际包含 Claude、DeepSeek、Gemini、GPT、Grok、Kimi、Qwen 各 Adult/Child 两版。它们可供未来角色扩展参考，本轮只关注 DeepSeek 的设计。

DeepSeek Child：

- 组装画布 1024×1536；贴图集 2048×2048；PNG 有真实 alpha。
- 20 个部件涵盖头发、脸、眼眉嘴、脖子、左右手臂、服装整体和尾巴。
- 没有独立腿、脚、鞋、坐姿、抓取手型或吃饭手型。`Dress` 同时包含躯干、裙子和腿鞋；不能直接实现迈步。
- `assembly.json` 的 `place` 和 joint 提供已有配准/枢轴参考；新游戏比例改变后需要重做，不能直接套用。
- 制作脚本将不同来源部件裁切后按 `place` 缩放组装。输出画布尺寸不代表每个部件拥有相同原生细节密度。
- `Idle/Working/Waiting/Success/Error/Sleep` 是六种小幅状态动作。Working 主要改变视线和摆动，Sleep 为闭眼与倾头，不能等同于桌边工作、端碗吃饭或坐垫坐下。
- 本轮目视的合成图明显比交接包目标更修长。目录名 Child 不代表已达到游戏要求的 2–2.5 头身。
- alpha 的中间值很多；这是检查透明边缘与主体覆盖的理由，单凭“不完全不透明”不能断言图像错误。正式复用前仍需黑/灰/白底、动作接缝和实际小尺寸检查。

**建议：保留全部既有模型，复用角色设计和制作经验；游戏基准重新制作。**现有模型不作为必须返工的对象，也不作为游戏的强制运行依赖。

### 场景缺口

没有发现符合交接规格的可直接使用的小院场景包：连通地面、独立工作桌/米饭桌/坐垫、前后遮挡、交互 anchor 和场景 JSON 均需制作。休闲人物插画中的房间只能作为氛围参考。

## 制作工具与来源

当前会话提供内置 `image_gen`，并已读取本地 imagegen 技能。后续角色基准、补绘与场景使用内置生成/编辑工作流；本轮没有发起图像生成。

正式素材保留 source、实际 prompt、reference hash、native resolution、编辑链与 candidate/approved/final 状态。代码用于校验、配准、图集和动画，不能将几何占位计入完成美术。

旧包明确未确认角色公开分发权；SDK 与第三方辅助代码有各自来源及许可文本。这里只记录资源自带声明，不作新的法律结论。纸娃娃路线不需要把 Cubism SDK 或 stretchystudio 制作工具打入游戏包。
