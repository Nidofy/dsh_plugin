# 独立桌宠与小院竖向背景

本次提供桌宠 **0.2.1**、AI 小院 **0.3.2**，基线为 Windows x64 / DSH **0.2.1-rc.2**。

## AI 小院

背景独立于交互世界绘制，按窗口宽高等比铺满并裁切多余边缘。人物、家具、行走与拖动仍使用相同的世界坐标，保持比例与完整可见。竖向扩展不再产生纯色空白带；沿用 2–3 倍画布采样及像素预算。

直接在 DSH 中导入 `nidofy-dsh-ai-village-0.3.2.tgz`，完整退出并重启即可，不需要桌宠载体。

## 独立桌宠

移除主窗口内的桌宠浮层。「设置 → 桌宠」仍是唯一管理入口，总开关在配套载体中创建或销毁独立透明、置顶、无父窗口的桌宠，可在 DSH 窗口外拖动；主窗口最小化不隐藏桌宠。最多三个实例。插件停用导致路由消失时关闭窗口；短暂断连保留断线状态并禁止过期会话操作。

官方公开插件接口不能创建原生窗口，**仅更新 tgz 不足以实现独立桌宠**。未接入的官方客户端会明确提示缺少窗口支持，并保留设置。

配套载体是本仓库对固定官方 Windows 发行文件的本地适配，**不是官方签名发行版**。仅增加原生桌宠适配器、专用 preload、应用页的只读导航通知桥，以及设置保存后的状态刷新；Host 认证信息保留在主进程。没有加载用户安装目录中的任意主进程脚本，也没有关闭 Chromium 沙箱。官方更新可能替换这份适配；升级其他版本后须重新验证。

## 使用载体适配包

1. 解压 `dsh-desktop-pets-carrier-0.2.1-rc.2-win32-x64.zip`。其中包含 `app.asar`、校验清单、安装脚本和本说明。
2. 准备已解压/安装的官方 Windows 0.2.1-rc.2 程序目录，里面应有 `DeepSeek Harness.exe` 和 `resources`。脚本会校验原版 `app.asar` 的 SHA-256，版本不匹配时拒绝处理。
3. 在 PowerShell 运行以下命令，把路径改为实际位置。目标目录必须不存在，建议选择普通用户可写目录；脚本复制完整程序，不覆盖原安装，也不操作 DSH 数据目录。

```powershell
.\Install-PetCarrier.ps1 -SourceDirectory 'D:\Apps\DeepSeek Harness' -DestinationDirectory 'D:\Apps\DeepSeek Harness Pets'
```

4. 完整退出其他 DSH 进程，运行新目录中的 `DeepSeek Harness.exe`。导入 `nidofy-dsh-desktop-pets-0.2.1.tgz` 并启用，在官方「设置 → 桌宠」打开“显示桌宠”。

若机器禁止执行 PowerShell 脚本，不修改执行策略：可在资源管理器中复制整个官方程序目录到新目录，使用 `Get-FileHash` 核对原包与适配包清单后，只在**副本**中替换 `resources\app.asar`。保留副本原有 `app.asar.unpacked` 和 runtime 目录。回退时关闭适配载体、重新启动原官方程序即可，设置和资源不删除。

## 验证边界

测试使用仓库 `.build` 下的临时 profile 和独立 Electron 数据目录，没有读取或修改实际用户 DSH_HOME，也没有调用模型。验证记录随构建生成，见 `.build/ai-village-v0.3-qa/browser/validation.json` 与 `.build/pet-native-qa/validation.json`。

已通过：相关单测 33 项；小院固定官方夹具 28 项及真实浏览器角色、拖动、共存、1440/2160 竖向铺满；真实 Windows Desktop 的原生桌宠像素、主窗口最小化后可见、官方开关关闭与三轮重建；类型检查、构建、解包 smoke、全部十包离线安装及 pnpm 11.28.5 非管理员重装回归。多显示器切换、其他平台及签名分发尚未验证。

Runtime Adapter 的内网 EPERM 问题仍未在本机复现，本次不将其标记为已修复；安装与诊断记录见 `ui-fixes-2026-10-21.md`。
