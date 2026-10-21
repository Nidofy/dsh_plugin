# @nidofy/dsh-plugin-shared

共享库，不是可启用的 DSH bundle。`/state` 保留既有桌宠设置校验、修订和原子写入；`/storage` 提供可选的已有桌面配额服务接口及实现；`/client` 只导出 optional Companion 类型和 Notebook slot 声明。导入这些模块不会自动挂载配额服务、Companion、桌宠或 notebook。

两个功能插件的发布 tgz 内嵌本库，不需要预先把此私有版本发布到 npm。DSH 和 Cordis 仍由运行 profile 提供，避免打包第二份服务运行时。原版 DSH 未提供 nidofyStorage 时，功能插件使用自身的有界原子文件写入；既有 Desktop 提供该服务时可接入配额保护。

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
