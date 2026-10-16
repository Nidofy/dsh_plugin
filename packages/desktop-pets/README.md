# @nidofy/dsh-desktop-pets

面向标准 DSH Web profile 的独立 Cordis bundle。提供 Session 状态投影、桌宠设置、最多三个实例、本地资源包预检/导入/删除/导出，以及浏览器内动画预览。它不依赖旧 desktop-extras、notebook、模型调用或私有 Desktop Host。停用插件移除路由与事件订阅，保留设置和资源。

安装 dist 中此插件的 tgz（已内嵌共享库），用 DSH Plugin Manager 启用 bundle。Settings → 桌宠打开设置和预览。HTTP 路由位于 `/api/nidofy-pets/`，依赖 DSH connection 的认证保护，不应直接暴露到公网。默认不开启 Session 观察；打开桌宠总开关后启用。

数据继续位于 `$DSH_HOME/nidofy-extras/preferences.json` 和 `pet-resources`，兼容既有桌宠设置。不能在同一 DSH_HOME 同时挂载旧 desktop-extras 和此插件，因为旧实现拥有相同的设置文件；当前 desktop 应先停用旧实现再选择新包。独立 notebook 位于子目录，不争用此文件。

可选 `@nidofy/dsh-desktop-pets/electron` 导出 `installPetDesktop`，`@nidofy/dsh-desktop-pets/preload` 提供沙箱预加载脚本。载体负责 `dsh-app://app` 协议、向认证 Host 转发请求、主会话导航及应用退出清理，详见仓库 docs/electron-adapter.md。浏览器预览不提供桌面拖动、穿透点击或原生窗口，也不伪造导航结果。

兼容基线：DSH 0.2.0-rc.2 的本地源码接口与 Cordis 4.0.4；尚未验证其他发行版本。桌宠只读取 Session 事件，不添加 prompt、工具或模型请求。单元测试覆盖原生窗口生命周期、设置和协调命令；真实 Electron GUI 仍需在接入载体后验证。
