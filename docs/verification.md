# 验证记录

2026-10-16，本地 Node 24 环境：

- 严格 TypeScript Host/Client 检查通过，并生成公共声明。
- 固定原版 DSH 0.2.0-rc.2 源码：16 个测试文件，96 项通过。
- 当前 desktop 源码依赖环境：同样 16 个文件，96 项通过。
- 四个 tgz 已构建并校验导出、内嵌共享库、无本地依赖路径；SHA-256 见 `dist/manifest.json`。
- 解压后的包通过公开 Host 导出、设置持久化、代际保护、真实 verifier worker、浏览器 factory、Electron preload 路径和 TypeScript consumer 检查。
- 实际 DSH CLI 在临时 DSH_HOME 中组合插件，检查原 JSONL 禁用、新 provider 和 Notebook 预设存在。未向用户的实际 profile 安装。

重点回归：真实 Loader/AgentLoop 上的回合注入、修订冲突、连续三轮压缩与冷恢复、模型失败、无效输出回退、flush 拒绝、取消与设置变化、物理文件复制后的代际冲突、旧日志只读兼容、新日志由 stock provider 读取、界面会话选择与重连、桌宠路由与原生窗口模拟生命周期。

边界：模型调用使用测试适配器，不消耗真实模型额度；尚未进行真实 Electron GUI、多显示器缩放、签名分发、跨平台及其他 DSH 版本验收。安装 smoke 使用已安装的宿主 peer 依赖，不代表已从公共 registry 完成全新联网安装。
