# AI 小院：阶段 3 独立场景

阶段 3 已由用户确认：“阶段3验收通过，继续推进”。本阶段交付独立可玩预览，资源清单已记录批准；后续接入见 [阶段 4 结果](PHASE4_RESULTS.md)。本阶段未修改 Desktop 宿主。

## 体验

执行 `node scripts/ai-village-phase3.mjs serve`，打开 <http://127.0.0.1:18748>。角色高度约 108 逻辑 px，场景为 360 × 480，支持 300/360/480 CSS px 与等比留边。

- 左侧书桌：写字手型、铅笔与落在纸面的循环动作。
- 右侧餐桌：托碗、举勺及开心表情循环。
- 右下坐垫：另行绘制的完整坐姿，轻微呼吸。
- 普通地面：落地缓冲后自主漫步，精确线段碰撞避免穿过桌子占地。
- 拎起时保留抓取偏移，先播放 pickup 再进入 dragging；五 CSS px 阈值避免误触。非法落点、Esc、失焦、隐藏和捕获取消保留原位置。

热点活动持续到再次拖动，不模拟饥饿或生产收益。记录移动方向，但已批准的正面角色不做整体镜像，保留非对称头饰和尾巴方位。

## 分层与美术

继续使用内置 image_gen，输入为阶段 1 已批准原图。新增三张源图集：家具、写字/吃饭整臂、完整坐姿。原生源文件保存在 `packages/ai-village/art/work/phase3/`，完整提示词与引用链在 `art/prompts/phase3.json`。

运行资产含 14 张 PNG：背景、书桌与餐桌完整图及前后片、坐垫、饭碗、四种活动手臂、坐姿。制作脚本只做实测边界裁切和桌子前后分片，不重绘或放大像素；哈希、尺寸、源裁切和分片重建误差写入 `assets/scenes/courtyard/manifest.json`。

桌前片遮住角色下半身，活动手臂在桌面上层绘制。休息使用独立脚底锚点。家具和本阶段新图仍标记待场景验收，未因阶段 2 批准自动视为可发行资源。

## 状态和边界

`src/core/world.ts` 是无渲染依赖的固定步长、种子随机模拟。`WorldController` 拥有世界与暂停原因集合；iframe 只持有渲染资源和临时指针状态。关闭/隐藏销毁 iframe 并停止 RAF；重新打开使用内存世界，隐藏时间不会追赶。拖动只修改草稿，悬空状态不会进入存档。

帧使用不透明来源 sandbox iframe，CSP 禁止联网及 eval。父子校验 source、origin、协议、实例 token、序列和受限数值。纹理通过白名单及 SHA-256 校验的本地字节传入。Pixi 独立 ticker 不启动，由父页面至多 30 次/秒请求绘制。

开发服务只监听 127.0.0.1，使用随机页面令牌、Host/Origin 校验、固定资源路由和 64 KiB 请求限制。这是独立预览专用适配器；不能替代 P4 的 DSH connection/request 认证。

## 存档

开发 profile 为 `.build/ai-village-phase3/profile`；测试 profile 随机创建在同一构建目录，均不写实际 DSH_HOME。每个 profile 一个世界，Host 持有跨进程 owner 文件锁；客户端有 15 秒租约，每 4 秒续约。所有权切换与存档事务共享锁，第二窗口不能启动另一份模拟。

保存字段包括 schema、稳定世界/角色 ID、场景与角色定义版本、逻辑 tick、RNG、位置、安全点、移动方向、行为、剩余时长和用户暂停偏好。成功放置、暂停偏好变化立即保存；运行中每 300 tick 检查点保存。页面/进程销毁恢复最近成功版，不依赖退出回调。

`src/host/save-store.ts` 使用不可变快照、SHA-256、原子 current 指针和 previous 指针。借用已验证的 durable-file Windows MoveFileExW 同步发布及官方跨进程锁；没有引入 notebook/runtime provider。CAS 和 operationId 拒绝冲突并支持 ACK 判定；响应不确定时读取，不自动重放写请求。保存失败保留内存并暂停。

坏档、未来版本、过大文件、非法路径/链接拒绝覆盖。显式恢复保留 current 原始字节到 `recovery-<uuid>.json` 后发布上一成功快照。快照目前保留全部历史、不自动清理；长期开启前应在后续阶段加入受控保留策略。未承诺断电故障恢复。

## 验证和证据

运行 `node scripts/ai-village-phase3.mjs check`，结果保存在 `art/QA/phase3/validation.json`：

- 严格 TypeScript、离线 browser/node bundle、资源哈希、预览打包和解包 smoke。
- 种子固定的 10 分钟模拟、碰撞角点、非法目标、拖动阈值/偏移、全部热点、取消和独立暂停原因。
- 真实磁盘 CAS 竞争、同 operationId ACK、过期 owner、重开读取、坏档与未来/过大指针拒绝、显式恢复原档保留。
- 同进程及独立子进程 owner 抢锁拒绝；打包服务的鉴权、跨来源和未知资源拒绝。
- Chromium 软件 WebGL，DPR 1/2 的真实鼠标拖放、Esc、跨画布捕获、隐藏中取消、暂停重挂载、刷新恢复、第二窗口占用。
- 300/480 px 与横向留边坐标、保存成功后丢弃响应的读回处理、中英文界面、10 次销毁/重建以及暂停时绘制计数不增长。
- 外部请求和 pageerror 均须为零。纹理数、ticker 状态与 CPU 侧渲染提交耗时记录于 JSON；这些不是硬件 GPU 性能指标。

[完整页面](../../packages/ai-village/art/QA/phase3/work-dpr1.png)、[吃饭](../../packages/ai-village/art/QA/phase3/eat-scene-dpr2.png)、[坐姿](../../packages/ai-village/art/QA/phase3/rest-scene-dpr2.png)、[实际操作录屏](../../packages/ai-village/art/QA/phase3/scene-demo.webm)。

## 下一阶段

P4 才接入 DSH 浮卡与 profile 服务，验证 Git/Live2D 协调、sidebar/会话/连接切换、真实卸载、IME 和主对话交互。P5 再做正式插件包、临时 Desktop profile 安装及硬件环境性能验收。本阶段的 `.tgz` 仅为预览归档，不可当作 DSH 插件安装。
