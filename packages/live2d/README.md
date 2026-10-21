# DSH Live2D 伙伴

`@nidofy/dsh-live2d` 是用于官方 DSH Desktop / Web 的独立插件，默认从会话工具栏打开右侧浮动卡片，使用公开 `shell.overlay` 插槽。**不注册 sidebar 标签，不替换 rightbar，不依赖 desktop-extras，也不创建 Electron 桌宠窗口。**

## 使用

构建后将 `dist/nidofy-dsh-live2d-0.1.0.tgz` 通过目标 Desktop profile 的官方插件管理入口安装；启停由该 profile 的插件管理器负责。不要把 Web/CLI profile 的安装当作 Desktop 安装。本仓库不会修改实际 DSH_HOME，也不会自动发布 npm。

进入已有会话，点击工具栏的 Live2D 按钮打开/关闭。卡片与 Git 面板使用相同的右侧位置；最后显式打开的面板显示，另一个关闭。官方 sidebar 展开、主对话宽度不足 764px 或进入全局页面时隐藏。关闭后不会因状态更新自动打开。关闭/Escape 将焦点还给打开按钮。

外观提供全身/半身/头像、连续取景缩放、水平/垂直位置、动画开关及重置。设置保存在浏览器本地，只有展示参数。取景直接作用于角色，不重载模型；静态立绘只有上半身，因此全身取景回退到半身。系统减少动态效果开启时默认关闭动画，可手动开启。

读取当前会话已公开的工作/等待/空闲状态与连接状态。不读取会话原文、不调用模型、不新增权限或工作流。状态未知时明确显示未知；目前固定模型只有待机动画，工作/等待状态不会伪装成尚不存在的动作。

## 资源与隔离

自带固定 Bluewhale 模型、立绘、Cubism Web 5-r.5 Core 与适配器，运行时无需 CDN。来源和 SDK 授权文本保存在 assets/live2d 中；现有资源记录仅用于个人本地开发，未证明具有公开分发授权。代码的 MIT 授权不覆盖第三方 SDK/角色资源。

通过已认证的 `/api/nidofy-live2d/` 提供固定白名单资源，拒绝任意路径、路径穿越和包外符号链接。父文档校验模型引用、限制资源大小，将字节传入 `sandbox="allow-scripts"` 的不透明来源 iframe。Core 以经典脚本加载，适配器以 Blob ESM 加载；不授予 allow-same-origin，iframe 无法访问父文档、Host cookie、存储或网络。CSP 的 `connect-src 'none'` 禁止网络请求。通信只允许固定初始化、展示参数与能力状态。

最高 30FPS、400 万像素；隐藏时移除 iframe，释放整个渲染上下文；关闭、切换会话、连接代际变化、卸载时取消加载并移除监听器。加载超时、SDK/模型错误或 WebGL context lost 回退静态立绘。失败不会因普通布局变化自动重试，用户可以明确重试。

## 开发与兼容

兼容范围限定 DSH `0.2.1-rc.2`。布局适配仅使用 `data-shell-overlay`、`data-rightbar-col`、`data-conversation-content` 与 frame 展示标记，为主对话预留 364px；上游升级需要复验。找不到兼容布局时不修改宿主。

运行仓库 `typecheck`、`test`、`build`、`pack`、`smoke:packed`。官方基线测试及浏览器验收见仓库 `docs/live2d.md`。`lib/frame.js` 必须与 Host/Client bundle 一并打包。

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
