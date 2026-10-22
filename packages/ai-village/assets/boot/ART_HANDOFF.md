# AI Village Entrance V1 · 梦境庭院前厅

状态：**ART_REVIEW**。已制作真实插画、透明分层、遮罩、动画数据和可调本地预览；没有把几何占位图当成成品。尚未获得人工美术签收，也未接入真实游戏。日期：2026-10-22（Asia/Shanghai）。

## 交付位置与隔离

- 独立分支：`art/ai-village-entrance-v1`。
- worktree：`D:/Documents/FeiyangChen/devApps/dsh_plugin-entrance-art`。
- 分支创建及代码审阅 HEAD：`2fd86dafaf771060cbef2074486ad10465d0a317`。
- 交付提交 HEAD：在该 worktree 运行 `git log -1 --format=%H -- packages/ai-village/assets/boot/ART_HANDOFF.md`；最终回复亦提供提交短 hash。文档不写入自身提交 hash，避免自引用。
- 正式资源：`packages/ai-village/assets/boot/`。
- 可编辑源文件、工具及预览：`packages/ai-village/art/entrance-v1/`。

开始时主工作树位于 `main`，有启动逻辑、测试及资源脚本的未提交修改。只读审阅了主工作树的 AGENTS、README、architecture、场景配置、既有美术、角色头像，以及当时未提交的 `EntranceOverlay.tsx`、`entrance-theme.ts`、`entrance-motion.ts`、`entrance-manifest.ts` 和资源校验脚本。`docs/ai-village/entrance-v1/` 当时仅有基线 JSON 与日志，没有独立设计正文；以用户任务书和实际接口为依据。

本分支仅新增上述两个目录。未修改任何运行时、场景逻辑、角色、存档、配置或构建脚本；未合并、cherry-pick、推送、发布，未联系其他聊天。主线程的后续修改可能改变接口，应集成前再次核对。

## 已完成资源

| 文件 | 内容 | 默认使用 |
|---|---|---|
| entrance-bg-far.png | 同母版补绘的天空、远树和隐藏环境底板 | 是 |
| entrance-bg-mid.png | 院墙、灯、藤蔓与中景植被 | 是 |
| entrance-path.png | 石板道路和地面光影 | 是 |
| entrance-gate-frame.png | 石拱、顶部鲸尾、附着绿植、门槛 | 是 |
| entrance-gate-left.png | 左雕花木门，独立 Alpha | 是 |
| entrance-gate-right.png | 右雕花木门，独立 Alpha | 是 |
| entrance-fg-left.png | 左前景枝叶与白花 | 是 |
| entrance-fg-right.png | 右前景枝叶与白花 | 是 |
| entrance-portal-mask.png | 弧形门洞，白 RGB + Alpha 覆盖度 | 遮罩，不当图片叠加 |
| entrance-glow.png | 可关闭的门内柔光，最高约 20% Alpha | 关闭 |
| entrance-ambient.png | 极少量可关闭的散光点 | 关闭 |

11 张标准 PNG 均为 **1080×1440 RGBA、sRGB、straight alpha**，对应 360×480、3 倍像素。透明处无黑色背景填充。合计约 **5.48 MiB**（精确值见 validation.json）。效果层为正常技术美术层，不是缺失场景的占位。主要 8 个绘画层均来自同一母版及其补绘，没有拼接无关构图。

补绘保留了大体环境，但并非所有未修改像素都由模型逐字节保留。其用途是远景和遮挡处的底板；门体、门框、道路和中近景的主像素从闭门母版直接选取。前景边界保留插画的柔边，只允许小幅视差。

源文件：`source/master-closed-original.png`、`source/environment-clean-original.png`（原始 1086×1448）；`source/entrance-layered.ora`（Krita/GIMP 可编辑层）；`source/editable-selections.svg`、`source/traced-geometry.json`、`tools/build.py`。图像模型的内部生成过程不可逐位复现；保存的源 PNG 到各项导出可复现。提示词完整保存于 `source/prompts.json`。

## 实测坐标与动画约定

所有下列坐标为 **1080×1440 母版像素**；除以 3 得逻辑坐标。门洞逐点轮廓、图层内容边界及裁剪偏移在 `entrance-art-manifest.json` 中，不应从本表近似数值反推。

| 参数 | 值 |
|---|---|
| 左轴 | (304.31, 611.60)，逻辑 (101.44, 203.87) |
| 右轴 | (778.67, 611.60)，逻辑 (259.56, 203.87) |
| 门缝 | x = 540 |
| 门洞顶部 | 约 y = 331 |
| 门底 | 约 y = 862 |
| 已验证的穿门安全矩形 | x=380, y=550, width=325, height=275 |
| CSS 向内开门 | 左 rotateY(0→+82deg)，右 rotateY(0→−82deg) |
| 透视距离 | 母版 2100 px；布局缩放后同步乘比例 |
| perspective-origin | 整个 stage 的 50% 50% |

门轴沿整条竖边，不是以贴图中心旋转。完整画布门图使用 manifest 的 `transformOriginFullCanvas`；裁剪版使用其兼容 manifest 的 `pivot`，不可混用。

40% 预览是 32.8°。82° 全开仍保留合理的两侧窄门片；**安全矩形内全透明**，不是宣称整个门洞每一像素都没有门片。要显示无门扇的完整门洞，可在穿门结束后隐藏门扇；此时环境/门框在整个 mask 内均为零 Alpha。门边有 1 px 的石框下搭接，防止闭门抗锯齿缝；建议门框/门槛最终画在门扇上方。门扇没有独立背面、厚度和动态投影，不可绕到背面观察。

相对视差系数：远景 .12、中景 .35、地面 .5、门框与门扇 0、前景 1.15。驱动上限是 **母版 ±5 px**，最大前景位移 5.75 px（逻辑约 1.92 px）。环境平移后必须再次使用固定的门洞 knockout，防止位移后的像素侵入透明口。大幅移动需要更多补绘，不在本轮保证范围。

## 响应式镜头

入口 stage 高度取视口高度，宽度为其 0.75 倍，居中；窄窗裁两侧，宽窗使用同环境底板模糊延展，显示边缘轻微羽化。没有横向拉伸门体。门框和阈值始终在头像区域上方。

基础比例 `s = viewportHeight / 1440`。对任意镜头比例 z 和焦点 (fx, fy)：

```text
stageWidth = 1080 * s
stageHeight = 1440 * s
offsetX = viewportWidth/2 - fx*s*z
offsetY = viewportHeight/2 - fy*s*z
stageTransform = translate(offsetX, offsetY) scale(z)
```

远景 z=1，焦点(540,720)；接近 z=1.12，焦点(540,675)；门前 z=1.45，焦点(540,650)。穿门时焦点(542.5,687.5)，终点比例：

```text
zCross = 1.06 * max(viewportWidth/(325*s), viewportHeight/(275*s))
```

穿门终点为视口完全落入已验证安全矩形，过程中关闭光效并淡出外部氛围延展。UI 单独固定在视口，保留逻辑 y≈365–480 的底部区域；头像、进度和文字不随入口镜头缩放。预览的七头像顺序与当前 roster 一致，但进度文案是固定示例。

## Reveal 合成

底层直接保持真实运行中的 AI Village。上层依次为外部氛围、远中景/道路、门扇、门框、前景，特效默认关闭。`entrance-portal-mask.png` 的 **Alpha=255 表示允许露出底层**；外部美术用反向 mask knockout，门扇不使用此 knockout。不要在门洞背后再填静态庭院插画、主题纯色或者不透明容器。

素材预览只将既有 `assets/scenes/courtyard/background.png` 放在下面展示合成，不能作为真实世界 readiness、iframe 生命周期或真实游戏切换已通过的证据。浏览器还使用两种纯诊断底色验证门洞透出，颜色仅存在于 QA 截图。

## 与当时主线程接口的差异

交付提供 `compat/entrance/`：8 张 **2 倍裁剪优化 PNG** + manifest。合计约 **2.62 MiB**、像素数小于 8M，满足当时脚本的 ≤4 MiB / ≤8M / 8 层限制。`rect` 相对全母版归一化，`pivot` 相对各自裁剪矩形。正式命名保持用户要求，兼容版用相同文件名；没有静默替换主工作区 `assets/entrance/`。

| 当时接口 | 本包差异 / 主线程接入事项 |
|---|---|
| 路径只允许 `entrance/*.png` | 经人工签收后，将兼容目录内容复制到主线程的 `assets/entrance/`；标准资源仍保留在 boot 供编辑 |
| 仅 `APPROVED` 会启用，现值 ART_PENDING | 本包 ART_REVIEW；人工签收后由主线程显式改 APPROVED，不绕过门禁 |
| 1536×1536 占位母版 | 1080×1440 实际画布；优化 PNG 为 2x 裁剪，但 rect 仍相对同一构图 |
| 矩形 aperture / evenodd 矩形 knockout | 实际是圆拱形；aperture 只提供外包矩形，**不可直接作为最终裁切**。采用本包 polygon 或 alpha mask；否则会切掉拱内角 |
| `entranceLayout` 宽度 cover 后再乘1.25 | 宽屏会把竖画布过度裁切；采用上述按高度布局和独立侧面氛围 |
| 左 -82° / 右 +82° | 当前 CSS 坐标下是向外；本包采用左 +82° / 右 -82° 向内 |
| 固定各层12×系数 px视差 | 本包门框/门扇同步锁定，相对驱动上限母版5 px；别按视口12px直接套用 |
| 环境容器有背景色、门框和背景同容器 | 背景容器同样挖空弧形门洞；门框最好在门扇前绘制 |
| mask/effect 不在现有八层类型中 | 优先用 manifest polygon 做裁切；光效关闭即可完整运行，不必增加资源白名单 |

本包没有运行会改写 `src/entrance-manifest.ts` 的主仓库资源生成器，也没有修改这些业务接口。兼容版满足资源格式和预算，不等于零代码适配。

## 预览与验证

- `art/entrance-v1/preview.html`：可直接本地打开；切换三个窗口、开门角度、镜头、视差、棋盘格、明暗宿主和头像条；可播放约6秒美术动画。
- `previews/contact-sheet.png`：12格总览。
- `previews/layer-atlas.png`：逐层透明底联系表。
- `previews/window-*.png`：三个尺寸各明/暗版本。
- `previews/door-*.png`：关闭、40%、100%，透明 PNG / 棋盘格 / 静态庭院样例。
- `previews/camera-*.png`：远、接近、门前、穿门前。
- `previews/hinges-and-safe-aperture.png`、`portal-alpha.png`、`parallax-max-open-check.png`：门轴与透明检查。
- `previews/browser/`：实际 headless Chromium DPR1 截图与报告。

已运行：47 项资源检查（文件名/读取/尺寸/RGBA/sRGB/哈希/门洞透明/闭门覆盖/开门安全区/7档门扇扫掠无碰撞/UI区域/两套预算）；独立 Chromium 图片解码、三个窗口布局、0/40/100% 门态及完整动画播放；六张底色切换截图的150个 reveal 像素采样。结果分别见本目录 `validation.json`、浏览器 `validation.json` 与 `pixel-validation.json`。首次校验曾发现原安全矩形过宽，已缩小为实测有效区域并重跑通过。首次浏览器尝试缺少默认版本，随后使用本机已缓存 Chromium 1228 完成，没有下载浏览器。

```powershell
# 独立 worktree 内；Python 需 Pillow、NumPy
python packages/ai-village/art/entrance-v1/tools/build.py --validate-only
python packages/ai-village/art/entrance-v1/tools/build.py
# Node 需 Playwright；可用环境变量指定已安装模块和本机浏览器
node packages/ai-village/art/entrance-v1/tools/check-preview.cjs
python packages/ai-village/art/entrance-v1/tools/check-browser-pixels.py
```

完整重建后重新跑浏览器验证，再运行 `tools/finalize.py` 更新 SHA-256 清单并验证清单完整性。`SHA256SUMS.txt` 路径相对 `packages/ai-village/`，覆盖本次资源、源文件、预览、工具和文档；清单自身不自哈希。

未运行：真实 Desktop GPU/DPR、多屏、游戏运行中揭幕、业务状态机、加载恢复、全插件 typecheck/build/pack。没有业务代码变更，不以这些未执行项目作为资产验收已完成的依据。

## 来源与剩余签收

入口绘画使用内置 image_gen 原创生成，环境底板以同一母版作定向补绘；未下载第三方游戏截图、角色或门的插画。仅在预览中复用本仓库既有庭院和头像，未重绘或更改它们。生成、裁切、缩放、遮罩和来源提示词已记录。新文件按本项目既有许可证随项目使用；AI 生成内容的独占性不作额外保证。

**没有待替换的几何占位资产。** ART_READY/APPROVED 尚未宣告。需要用户人工签收：整体二次元插画观感、与居民及现有小院的一致性、宽屏柔化侧景、前景软边、门轴开合视觉及从入口到小院的过渡。门厚度/背面、大幅视差、新主题以及真实运行时集成不在本次交付内。主线程从该分支或两个交付目录接收，保留原游戏就绪判定，不把预览状态当成业务完成。
