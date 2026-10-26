# DSH 0.2.1-rc.3 官方源码差异核对

核对日期：2026-10-26。AI Village 起点：`ead9a0fb97631bf651421ebac9e1e6ab78012950` / `0.13.0-preview.3`。本文是 A1 源码证据，不代表 Desktop / 浏览器验收已经通过；最终门禁由 `DSH_0.2.1_RC3_RESULTS.md` 记录。

## 固定来源

| 项目 | 身份 |
| --- | --- |
| rc.2 标签 | `dsh-v0.2.1-rc.2` |
| rc.2 完整提交 | `687f282e8625c6b8d11ff58211a90524be2e4317` |
| rc.3 标签 | `dsh-v0.2.1-rc.3` |
| rc.3 完整提交 | `1f81c047fc48fa190a683e469daa699857e9afe8` |
| rc.3 codeload 归档字节数 | `34809911` |
| rc.3 codeload SHA-256 | `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60` |
| rc.3 解压源码 | `.build/ai-village-rc3-source/official` |
| 原始下载 | `.build/ai-village-rc3-source/official-complete.tar.gz` |
| 独立 Git 对比副本 | `.build/ai-village-rc3-audit/official` |

使用官方 [发布页](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.3)、[完整提交](https://github.com/deepseek-ai/deepseek-harness/commit/1f81c047fc48fa190a683e469daa699857e9afe8) 和 `git ls-remote` 独立核实标签；实际下载 [固定提交源码归档](https://codeload.github.com/deepseek-ai/deepseek-harness/tar.gz/1f81c047fc48fa190a683e469daa699857e9afe8)，不是浮动分支。解压后的根 package.json 版本为 `0.2.1-rc.3`。对解压 tar 前 1024 字节执行 `git get-tar-commit-id`，再次得到完整 rc.3 提交 `1f81c047fc48fa190a683e469daa699857e9afe8`。

上表源码目录是审计副本；正式可重建准备脚本会生成独立的 `official-*` 目录，构建实际来源以 `.build/ai-village-rc3-source/baseline.json` 的 `source` 为准。

rc.2 的 `compatibility.json`、`.build/sandbox-enhanced/official`、原有 runtime 与冻结包未被本审计改写。首次无代理下载超时留下的 `.build/ai-village-rc3-source/official.tar.gz` 是不完整文件，不可作为构建来源；成功文件为上表 `official-complete.tar.gz`。

## 完整差异范围

对两个完整提交执行 `git diff`：**640 文件，5682 行新增、1021 行删除**；其中 349 个 package.json、61 个 `/src/` 文件。原始完整补丁和文件清单保存在 `.build/ai-village-rc3-audit/full.diff` 和 `changed-files.json`。共有六个提交：

- `5ff29190ed`：新增导航入口定制及 More 菜单。
- `675164957a`：导航入口、预设选择及消息提交的遥测。
- `39d2903841`：固定入口与当前选择解耦、菜单图标；包含新会话复用/草稿修复。
- `c48f8523f2`：DeepSeek API-key 路由跟随官方模型列表。
- `d02ea370ee`：版本发布元数据。
- `1f81c047fc`：发布合并。

因此不能把本次变更理解成只加三个菜单或只更新版本号。

## AI Village 接口追踪

| 接口/区域 | 实际变化与结论 |
| --- | --- |
| `shell.overlay`、主布局 | `ui-layout/src` 和 `ui-renderer/src` 两个目录在两个提交中的 Git tree 完全相等。`AppFrame.tsx` 中 `data-rightbar-col`、`data-rightbar-collapsed`、`data-rightbar-fullscreen`、`data-shell-overlay` 保持；不需要更换浮窗接入点。 |
| Slots 注册/撤销 | `ui-slots/src` 完全相等。新增的是业务区域 actions list 槽，不是引擎生命周期变更；`ctx.slots.inject`/`register` 使用保持。 |
| Conversation Header | `ConversationSession.tsx` 新增 View More，视图标签按宽度预算折叠/可取消固定。新 `conversation.session.header.views.actions` 是 root-scoped list；原 `conversation.session.header.corner` 仍是 session-scoped single。 |
| HeaderLauncher | 官方 `data-conversation-header-corner` 仍位于原 titleRow；More 在其后的独立 tabs 行。新增 list 仅用于视图菜单，不是更适合游戏浮窗的直接入口。不建议为此改写整个 Launcher 系统；须真实验证组件重建时 Portal 迁移、唯一性及释放。 |
| Header 尺寸 | `ConversationRoot.module.css` 允许 tab row 换行、header 高度超过 76px，标签间距和 tooltip 改变。Village 当前通过实际 content/composer bounding rect 和 ResizeObserver 定位，没有固定 76px 假设；须检查 More/长标签/窄窗下的实际几何。 |
| 左右 Sidebar | 左侧新增 `sidebar.panellist.actions`，右侧新增 `sidebar.right.tab.guide.actions`，并维护各自内存 pin 集合。Sidebar 右侧外壳和布局 marker 不变；Village不注册这些入口，也不应触碰其 pin 状态。 |
| More 的官方动作 | `ui-entry-customization` 提供浏览插件和创建插件动作；后者调用官方 `uiWorkspace.startSession`，`whenDraftExists: 'append'`，预设 `cordis`。Village不调用该 API，不重实现其草稿行为。 |
| 新会话/草稿 | `ui-workspace/navigation.ts` 的普通 `startSession()` 现经 `openWorkspace` 复用符合预设的 blank。Input `requestDraftInitialization` 增加 `whenDraftExists: keep/replace/append`；editor 增加 appendDraft。现有 clearPreviousDraft 兼容映射仍在。Village owner不依赖session ID，也不操作Input；验证应真实从草稿→另会话→新会话返回原blank。 |
| Client Connection / `connection/reset` | `packages/client/connection/src` 完全相等，包含 Host `connection/request` 和 Client reset 契约。无需增加第二owner或重连写入路径。 |
| Host `connection/request` | 同上；认证 waterfall 与 request bridge 源码相同。禁止用权限放宽掩盖安装/资源问题。 |
| Plugin 生命周期 | `boot/plugin-manager/src`、`boot/app-boot/src` 和 `vendor/cordis` 完全相等。Client 插件管理器仅新增浏览列表入口服务方法。Village继续用 ctx.effect/ctx.on 释放与单owner。 |
| UI Locale / Session | `client/locale/src`、`client/ui-session/src` 完全相等；More 新增中英文文案，不改变 Village locale 注册约定。 |
| Browser / Electron | `apps/desktop/src` 和 `apps/desktop-host/src` 完全相等。浏览器公共 Menu/Tooltip 有定位/图标/aria-current 改进，新增 More 使用 portal+autoFocus，因此仍须实际检查焦点和 Escape。 |
| 存储 | `util/atomic-write/src` 完全相等；本次没有依据改 world14/content10/region2/frame11、CAS、租约或冻结解码器。 |
| DeepSeek 模型 | LLM 包新增 listed catalog/cache/config 等，API-key 路由对齐账号列表。与离线游戏逻辑无依赖；测试不得为此调用收费模型。 |

### 完全相同目录的 Git tree 身份

以下对象在 rc.2 和 rc.3 分别执行 `git ls-tree` 得到相同值，证明比较了整个目录，而非仅搜索某些文件名：

| 目录 | 两个标签共同 tree SHA |
| --- | --- |
| `packages/client/connection/src` | `d37a89932e74ba83f5e93732f79e7edead123613` |
| `packages/client/ui-layout/src` | `65bbb7d45b94e6e7d921167543a3dab4062d3299` |
| `packages/client/ui-renderer/src` | `028317f9824fa1f384f495cfc73112ed1577ec81` |
| `packages/client/ui-slots/src` | `2128e31bd1252bd6b7e0aa1847efd76562d7af06` |
| `packages/client/locale/src` | `5a914588cff30afe1dda16252f9a57eabf9fdb54` |
| `packages/client/ui-session/src` | `2c17bd4af73110caa69544bf02de5c91ad2cef85` |
| `packages/boot/app-boot/src` | `14016c958ce4f6006933056a4863c5bebb348daf` |
| `packages/boot/plugin-manager/src` | `90ef58695a4ebc4a076c4688b36529124fdfcf11` |
| `packages/util/atomic-write/src` | `91ee2f2749252796d7aa62f272758c29ad67bf9d` |
| `apps/desktop/src` | `7ee812adf172a4f06e1da635cd63dd55884eab16` |
| `apps/desktop-host/src` | `407ebb6e2bdbf61f80ce4246f2975f912e1908b1` |
| `vendor/cordis` | `c4e609dedb77aa531776ddf71abd61aca062f46f` |

## 实施建议及验收边界

新增 AI Village 专属 rc.3 兼容配置、固定源码/runtime/锁文件与独立证据输出；不全仓替换 rc.2，不把其他插件自动声明为 rc.3。源码分析未发现必须修改 Village world 或 launcher 产品实现的接口破坏；新 Header 类型对直接渲染官方组件的测试 fixture 增加 entryPins/entryActions/setPinned 要求。

待实际门禁证明：rc.3 原生独立profile安装及启停、三场景/地图/七人、双语双DPR、More/草稿/输入法/焦点、Git与Live2D协调、断连与owner恢复、旧存档、离线包及包身份。相同源码接口不能替代这些运行证据。
