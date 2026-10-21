# 可选 Electron 载体

桌宠 Host 和客户端 bundle 可安装到标准 DSH Web profile。浏览器里提供预览和设置；原生透明悬浮窗由载体显式接入，插件不启动第二个 DSH 进程。

载体在 Electron 主进程中导入 `@nidofy/dsh-desktop-pets/electron`，在自己的受信协议和认证 Host 就绪后调用：

```ts
import { createRequire } from 'node:module'
import { installPetDesktop } from '@nidofy/dsh-desktop-pets/electron'

const require = createRequire(import.meta.url)
const disposePets = installPetDesktop(
  require.resolve('@nidofy/dsh-desktop-pets/preload'),
  () => ({ url: authenticatedHostUrl, cookie: hostCookie }),
  sessionId => openSessionInMainWindow(sessionId),
)
// 用户提交设置后可立即刷新；适配器也会定期读取状态。
disposePets.refresh()
// 载体退出或替换 Host 时清理窗口、定时器和 IPC。
disposePets()
```

示例中的 URL、cookie 和导航函数必须由载体提供，不能来自网页参数。载体需要注册 `dsh-app://app` 协议，将 `/api/nidofy-pets/*` 转发给认证 Host；响应 MIME 和资源相对路径必须保留。载体的 API 转发继续执行原有身份检查，不把 cookie 暴露给 Renderer。

提供的 preload 是 CJS，适合 `sandbox: true` 和 `contextIsolation: true`。它只向专用桌宠路径暴露有限 IPC。主进程再次检查 WebContents、主 frame 与页面地址；网页预览使用 HTTP bridge，不获得原生窗口权限。窗口关闭后其 IPC 身份失效。

第四参数可选地提供现有 Companion 命令的 scope 准入函数；未提供时协调 IPC 拒绝请求。第五参数可提供 `suppressTerminalBubbles(signal)`，用于载体已发送系统通知时抑制重复气泡。默认不依赖旧 workbench 通知路由。

当前 dsh desktop 的既有适配器使用 `/api/nidofy-extras/`；接入本包时改用上述导出和 `/api/nidofy-pets/`。同一进程不要同时安装两份原生适配器，同一 DSH_HOME 不要同时启用旧 extras 与新桌宠设置 owner。现有 desktop 源码工作区不自动切换。本仓库通过 `node scripts/build-pet-carrier.mjs` 对固定官方发行文件生成独立适配包，以校验 SHA-256 的方式限定基线；安装脚本复制完整载体到新目录，不覆盖原安装。说明见 [独立桌宠发行记录](releases/native-pets-tall-village-2026-10-21.md)。

已验证：模拟 Electron 下的权限检查、拖动保存、断开重连、加载失败和卸载；Windows 真实适配 Desktop 中，官方总开关创建独立置顶无父窗口、渲染真实图像，主窗口最小化后桌宠仍可见，关闭和连续三轮启停无残留。验证脚本为 scripts/pet-native-check.mjs，临时 profile 位于 .build/pet-native-qa。尚未验证多显示器切换、签名分发和其他平台原生表现。
