# Live2D：接入方案与验证

依据用户补充的交互要求，采用与现有 Git 插件一致的 **右侧浮动卡片（shell.overlay）**。这是应用内非模态卡片，不是 sidebar 标签，也不是操作系统桌宠窗口。

| 接入方式 | 优点 | 代价 | 本次选择 |
| --- | --- | --- | --- |
| 原生 Dock 标签页 | 原生调宽、标签、分栏、停靠；宿主管理生命周期 | 角色与文件/终端共享导航，打开其他内容可能切走角色 | 不采用 |
| 原生 Dock float | 自带拖动、浮动、重新停靠；收起侧栏后浮窗仍可显示 | 仍属于会话 Dock，openTab 会展开侧栏，默认浮动需额外转换，不等同于现有 Git 卡片 | 以后需要拖动停靠时可单独增加 |
| shell.overlay 独立卡片 | 与 Git 体验一致，工具栏单独开关，不占 Dock 标签 | 必须自己维护几何、留白、焦点和隐藏生命周期；布局标记需随 DSH 升级复验 | **采用** |

这些判断依据本地固定官方 `0.2.1-rc.2`（`687f282e8625c6b8d11ff58211a90524be2e4317`）的 `ui-layout` AppFrame/插槽声明、`ui-sidebar-right` 的 service/slot contracts，以及本仓库 Git 插件实现。

## 已实现

- 新包 `packages/live2d`，Host/Client 入口、Cordis patch、包依赖和引擎范围、类型检查、构建及打包接入。
- 340px 浮动卡片，为主对话预留 364px；不移动工具栏，不覆盖输入框。官方右侧栏展开或空间不足时暂时隐藏；与 Git 卡片互斥，最后显式打开的面板优先。
- 角色当前会话状态：空闲、工作、待处理交互、断连、未知。只读公开状态，不读取原文，不调用模型。
- 全身/半身/头像、连续缩放、位置、动画开关与重置；浏览器本地只保存展示设置；系统减少动态效果首次默认静态。
- 固定离线模型闭包、资源体积上限、路径白名单、包外符号链接拒绝；保留资产版本、来源和 SHA-256。
- sandbox iframe 不授予 same-origin；主文档不执行 Core。经典 script + 动态 ESM 加载都在 iframe 内；CSP 禁止网络；只传固定资产与展示参数。
- 30FPS/400 万像素限制；隐藏、关闭、切会话、卸载释放。20 秒加载超时、WebGL context lost、缺失 SDK/模型时静态回退，用户明确重试。
- 插件缺席时原 desktop-extras 不受影响；本插件完全不依赖它，因此没有等待 nidofy.companion 的永久 PENDING。官方插件管理器管理本包启停。

## 运行验证

```powershell
node scripts/typecheck.mjs
node node_modules/vitest/vitest.mjs run packages/live2d/tests packages/source-control/tests
node scripts/build.mjs
node scripts/pack.mjs
node scripts/smoke-packed.mjs
node scripts/preview-live2d.mjs
```

官方源码回归沿用仓库已校验 SHA-256 的 `.build/sandbox-enhanced/official` 基线。准备方式见 `scripts/sandbox-enhanced.mjs prepare`；补齐该版本 UI renderer 的精确测试依赖后运行：

```powershell
npm install --prefix .build/live2d-official-deps --ignore-scripts --no-audit --no-fund --package-lock=false --legacy-peer-deps use-sync-external-store@1.6.0 @types/use-sync-external-store@1.5.0
node node_modules/vitest/vitest.mjs run --config scripts/live2d-official.vitest.mjs
node scripts/typecheck-live2d-official.mjs
```

浏览器验收运行真实 Chromium 与真实 Cubism/WebGL，通过临时本地 HTTP 服务调用已构建 Host 路由，渲染真实浮动组件。覆盖主页面无 SDK 全局、iframe 无父文档/cookie 访问、取景不重载、丢失上下文回退、明确重试、隐藏移除 iframe、关闭撤销留白、窄窗口、无外部网络请求、无页面错误。

测试报告与真实模型截图位于 `.build/live2d-preview/result.json`、`floating.png`、`full-body.png`、`portrait.png`。截图的外围会话是布局验收夹具，**不是已安装官方 Desktop 的截图**。

## 交付边界

本地安装包：`dist/nidofy-dsh-live2d-0.1.0.tgz`，校验值记录在 `dist/manifest.json`。打包 smoke 将 tgz 解压到临时安装树，验证导出、浏览器模块工厂、资产闭包及 CLI profile 配置组合；没有改用户的实际 DSH_HOME。

尚未在用户实际官方 Desktop 安装中完成插件管理 UI 点击安装/禁用验收，也没有进行真实 Electron GPU/多显示器验收。浏览器与官方源码测试不替代这些环境验收。当前卡片与 Git 一样固定在右侧，不承诺可任意拖动、原生停靠或脱离主窗口。

SDK 和角色来自用户现有素材。随附来源记录限定个人本地开发、公开分发授权未认证；本次未发布公共包。原桌面内置 Live2D 也未删除，避免改变既有发行版行为。
