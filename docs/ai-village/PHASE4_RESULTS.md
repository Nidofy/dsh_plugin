# AI 小院：阶段 4 DSH 接入

用户已确认“阶段3验收通过，继续推进”。本阶段沿用获批角色、动作和场景，新增 DSH 接入与生命周期处理；没有修改 dshWinUi/electron、实际 DSH_HOME 或正式安装。

## 实现

- Host `src/index.ts` 注入官方 connection 与 profileContext，通过已认证 `connection/request` 提供固定资源、状态、客户端所有权、保存和恢复。
- Client `src/client/index.ts` 注册 `shell.overlay` 和会话工具栏。每次插件启用只有一个 `VillageRuntime`；世界不按 sessionId 或 connection generation 建 React key。
- Git 和 Live2D 各修改现有互斥判断，接受 `ai-village`；游戏接受另两个已知面板 ID。事件只传面板身份，不传世界、路径或模型数据。
- 浮卡保留原版主对话的局部宽度标记；侧栏展开、空间不足、主面板切换时隐藏并撤销标记，恢复时沿用同一世界。其他卡片抢占后不会因 sidebar 恢复而自动抢回。
- 隐藏销毁 iframe 并停止模拟与绘制；帧实例拥有独立 token、单调消息序列、固定资源、pointer capture 和 Esc 取消拖动。主对话不注册游戏键盘处理器。

官方客户端采用 `window.__ModuleLoader__.load` 的模块工厂，而不是直接把普通 ESM 放入客户端入口。候选归档包含正确的工厂、Host 导出、patch 和 package 元数据，仍保持 private。

## 存档和重连

一个可信 profile 对应一个世界。持久 UUID 区分 profile；每次 Host 启动生成新 epoch。跨进程 owner 文件锁与客户端 15 秒租约共同防止重复模拟；所有权切换与保存事务共享锁。

连接丢失立即暂停并保留内存。重连先取得独占租约，再读取当前 Host 状态；profile、修订或 pending operationId 不一致时停止，不把内存自动写回。会话切换不重新载入世界。未知 ACK 先读取确定结果，不自动重放写请求。

坏档不会初始化成新世界。客户端在取得租约后读取状态，坏档仍能显式恢复上一成功版；恢复前保存损坏原件。修复了重复恢复可能复用 revision 的边界，使恢复也递增修订。写入/恢复不并发发起，卸载等待已接受请求完成，未完成请求体被取消。

页面退出使用有界 keepalive 释放请求；Host 仍以租约过期作为非正常退出的兜底。刷新/进程重启恢复最近成功存档，不承诺恢复未保存的逻辑时间。

Windows 同步原子发布继续使用已有 durable-file 的 Koffi / MoveFileExW 路径。Koffi 固定 3.1.1；没有引入 notebook 或 runtime-adapter provider。历史快照尚未自动清理，长期保留策略仍待后续处理。

## 验证

命令：`node scripts/ai-village-phase4.mjs check`。

固定官方源码 revision：`687f282e8625c6b8d11ff58211a90524be2e4317`（DSH 0.2.1-rc.2）。Host 与 Client 分开进行严格 TypeScript 检查，避免 Connection 服务类型相互覆盖。

回归使用真实 Cordis、官方 Connection cookie/Host/Origin 准入，以及实际插件入口。覆盖未认证 401、跨来源 403、白名单资源、CAS、客户端争用、坏档恢复、Host 重启持久身份/新 epoch、旧租约拒绝、反复停启及在途请求体取消。客户端测试补充不同 profile、外部修订变化与丢失 ACK。

浏览器夹具使用三个插件的实际客户端注册和组件；仅用受控布局及示例会话数据替代整个 DSH Shell。Host 使用真实插件与官方 Connection 准入。Chromium 软件 WebGL 实测：

1. 50 次 sidebar 开合，始终最多一个游戏 iframe 和一份游戏留白；用户暂停后的世界完全一致。
2. 会话切换保留同一世界和渲染器实例；Git、Live2D、小院按最后一次显式打开互斥。
3. Host 禁用/重启后 connection reset 重新核对 epoch 和修订，保留内存与用户暂停。
4. 窄窗口、主面板显示、拖动中隐藏、草稿与主输入框 Esc、刷新恢复、第二窗口占用和完整卸载。
5. 外部请求与 pageerror 为零。

[截图](../../packages/ai-village/art/QA/phase4/integrated-courtyard.png)与[机器验证结果](../../packages/ai-village/art/QA/phase4/validation.json)位于仓库 QA 目录。共享场景的阶段 3 检查继续作为回归命令。

候选归档解包后检查 Host owner、ModuleLoader 客户端工厂及 DSH patch 元数据；不包含测试 profile、认证入口或制作源图。实际宿主依赖安装、完整 Loader 组合、真实 Desktop UI 和系统 IME/审批流程尚未在本阶段验收。

## 交付与下一步

`node scripts/ai-village-phase4.mjs serve` 启动本机 18749 验收夹具。首次使用 `.build/ai-village-phase4/preview-entry.json` 中的认证入口；该文件被忽略，不提交。

候选包：`.build/ai-village-phase4/phase4-integration.tgz`。三浮卡互斥需要同步使用本仓库当前 Git/Live2D 客户端源码；仅替换游戏包不足以让旧版伙伴卡片主动让位。

P5 需要统一正式构建与打包清单、声明文件、依赖与安装 smoke、临时 Desktop profile 真实安装、三包协调升级及硬件性能/输入验收。当前不宣称完整产品安装已通过。
