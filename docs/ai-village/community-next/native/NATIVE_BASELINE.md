# 原生 Desktop 验收与测量边界（2026-10-25）

## 导航示意包基线

- 包：`nidofy-dsh-ai-village-0.12.0-preview.1.tgz`。
- SHA-256：`0e87f00a22d7833f8180548cde1cab469c6a9623b78d6a070838ed6d0425bc6e`。
- 这是正式地图分层美术接入前的导航示意包，不能用这些截图代表后续正式地图包。
- 载体：缓存官方 Desktop `0.2.1-rc.2`；RunRoot 为 `.build/ai-village-life-qa-desktop-community`，CDP `127.0.0.1:18773`，独立 `home` 与 `electron-data`。
- 实际用户 DSH_HOME 未修改。启动采用 Hidden；仅启动/重启脚本在沙箱外运行，以避开沙箱令牌无法读取既有 Electron carrier 的问题。未修改 ACL、安全设置或系统 DPI。
- `scripts/ai-village-community-native.mjs` 所有世界修改均通过真实安装包 UI；状态接口、frame render 消息与诊断指标只读。源包与安装后的三个 bundle 逐字节核对。

## 已验证

| 证据目录 | 结果 | 范围 |
| --- | --- | --- |
| `native-target-ready` | PASS | 独立原生目标及设备只读核验 |
| `pinned-install` | PASS | 官方插件管理器本地安装和启用固定 SHA 包，随后完整重启 |
| `map-and-walk-recheck` | PASS | 五节点地图、规划节点不可进入、地图浏览不写暂停世界、庭院/书屋往返、单居民点击真实移动、暂停保留移动意图 |
| `cold-restored-walk` | PASS | 完整结束并重启专用进程树后，暂停世界逐字段一致；继续后沿原路线走至目标 |

功能运行有实际原生截图与 CDP screencast 录屏。`map-and-walk` 的第一次失败由 QA 脚本监听 `view` 而实际消息为 `render` 引起；该失败结果与录屏保留，修正后的独立 recheck 标签通过。未修改生产代码绕过验收。

## 硬件观测不能作为前台性能结论

`seven-hardware-baseline` 已通过 UI 入住七位原居民，并完成庭院20.76秒诊断，但旧的前台20–35 FPS门槛失败：

- 真正硬件后端：ANGLE / D3D11 / Intel Arc 140T GPU，驱动32.0.101.8243。
- 页面 `document.visibilityState` 返回 visible，DPR为1.75；进程采样 `mainWindowHandle=0`、`windowVisible=false`、`foreground=false`。没有抢占用户前台。
- 此运行无screencast/CPU profiler，约1.01 FPS；p95绘制1.2ms，128纹理，解码RGBA 67,346,784字节，完整进程树CPU约2.56%单核。
- 该环境受隐藏/遮挡节流影响；功能录屏可影响浏览器帧调度。这两者均不能代替正常前台帧率，也不能据约1 FPS宣称插件性能回退。
- 旧FAIL证据原样保留。后续脚本对刻意隐藏窗口的性能观察标为LIMITED，不执行或声称通过前台FPS门槛。

未验证：实际前台硬件FPS、物理休眠、实际原生最小化/还原、其他物理DPI、长时间内存浸泡。软件GPU浏览器数据与这里的硬件观测须分别报告。

## 正式美术包升级

第一轮正式地图包 SHA-256 为 `e888b399acffb173ed0c0c78ac27fd04ca9397c11d7cfe6bc6fcfb83861281ee`，48,895,063 字节、389 文件。只在同一隔离 profile 通过官方插件管理器卸载旧包再安装新包（官方不支持同名包直接覆盖），保留世界目录与暂停快照。

| 证据目录 | 结果 | 范围 |
| --- | --- | --- |
| `approved-map-upgrade-confirmed-list` | PASS | 官方管理器升级到上述固定 SHA 正式美术包 |
| `approved-map-native` | PASS | 完整重启后的七居民 world 与升级前逐字段相等；庭院/书屋地图往返、五节点和三规划区拒绝；六层正式 PNG 本地 blob 解码；地图打开前、中、后 iframe 纹理均为 121；关闭后六个 blob URL 均已撤销 |

第一次 `approved-map-upgrade` 遇到旧包在长期隐藏节流后显示 OWNER_LOST 恢复入口，未发生卸载。使用正常“再次入场”入口恢复，无回滚。第二次 `approved-map-upgrade-reentry` 因插件列表尚未异步显示而失败，也未发生卸载；脚本改为等待已观察到的真实列表项后，独立标签重跑通过。`upgrade-manager-observed` 只读诊断因隐藏动画等待而中断，没有生成完成结论；增加有界动画等待的 `upgrade-manager-observed-bounded` 通过。上述原始证据均保留。

随后生产补充“图片 decode 尚未完成时关闭地图”的精准取消处理。最终包 SHA-256 为 `64d20ca4a711655331bb57afeb0b7561330411f02d9296532f6f6b806064d857`，48,895,062 字节、389 文件。

| 证据目录 | 结果 | 范围 |
| --- | --- | --- |
| `final-map-upgrade` | PASS | 官方管理器安装最终固定 SHA 包 |
| `final-map-native` | PASS | 完整停止并重启专用原生进程树；三个已安装 bundle 与最终包逐字节一致；七居民暂停 world 与升级前逐字段一致；五节点、规划区拒绝、无副作用浏览、区域往返；六层正式图解码、iframe 纹理不增加、关闭撤销全部 blob URL |

最终截图为 `final-map-native/native-final-map.png`，安装与地图操作录屏均在各自证据目录。解码中取消的精确时序由生产对应单元测试覆盖，原生此次验证正常解码后的关闭和资源释放，不宣称在原生机器上确定性复现尚未完成的 decode。前台硬件 FPS 限制仍然适用。

## 测试环境清理

最终复验后，启动器核对专用 PID 26072 的可执行文件与独立 user-data 路径，随后仅结束该测试进程树。`cleanup.json` 记录根进程已退出、CDP 18773 无监听；保留隔离 profile 与所有原始证据，实际用户 DSH_HOME 未修改。
