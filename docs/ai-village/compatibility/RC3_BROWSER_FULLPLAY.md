# rc.3 / 0.13.0-preview.4 双 DPR 玩法回归

2026-10-26，基线 HEAD `ead9a0fb97631bf651421ebac9e1e6ab78012950`，使用该 HEAD 上的本轮 rc.3 适配工作树。两轮均为 **PASS**；没有修改游戏状态或模拟时钟来加速玩法，没有访问日常 DSH_HOME。

## 构建与环境

- 官方 DSH `0.2.1-rc.3`，源码 `1f81c047fc48fa190a683e469daa699857e9afe8`，固定归档 SHA-256 `fc671f856222bef95c7f6bd65b5adfb6c09770ffd5b1f3f61b7b1e1cbe582c60`。
- 独立运行依赖：`tools/official-runtime-rc3/package-lock.json`，SHA-256 `cb921ac43ecb67ddf6a9aea667b362848a7b8d5795a1bc2d7686db1eee7c6ba9`。`npm ci --ignore-scripts` 安装619包，相关11个 DSH Host/Client/slots/atomic-write 包的实际解析路径和版本均验证为独立 rc.3。`dsh-client-ui-slots` 为显式依赖，避免回落到仓库 rc.2 包。Cordis 4.0.5 / React 18.3.1。
- Node v24.16.0，Chromium headless，ANGLE / SwiftShader 软件渲染，DPR 1 与 2 顺序执行。
- 游戏版本 `0.13.0-preview.4`，world14 / content10 / region2 / frame11。两轮129份游戏源码与三个 bundle 的 SHA-256 完全一致。
- 保留 rc.2 的配置、runtime、测试目录、冻结包和历史证据；本报告不声明其他插件通过 rc.3 验收。

| Bundle | SHA-256 |
| --- | --- |
| index.js | `bfbf33296bce528d9f95420ece38796bb25cdfb8d4570cd4ded7e94f886719ab` |
| client.js | `4182fe1253bb6c8d7212b750baeb90259fd3763feb5b70aaba9d2f8a771ced25` |
| frame.js | `7bd7bd0b1eed6e8f59c9bdc60ce659629fff4638abba36cb1ba8860b556553ed` |

## 实际结果

| 轮次 | 结果 | 检查记录 | PNG | 真实旅行 | 页面错误 / 外网请求 |
| --- | --- | ---: | ---: | ---: | --- |
| [DPR1](../community-next/tea-square/browser/rc3-pre4-dpr1-01/result.json) | PASS | 32 | 30 | 19 | 0 / 0 |
| [DPR2](../community-next/tea-square/browser/rc3-pre4-dpr2-01/result.json) | PASS | 32 | 30 | 19 | 0 / 0 |

每轮覆盖：

- 公开地图入住七人、庭院/书屋/茶区旅行、非邻接旅行拒绝、共享长期回忆保持。
- 书屋书柜阅读、书桌写字、窗边坐下的真实移动与对应渲染姿态；三阶段共读到齐后逐步操作，首次事实保留。
- 茶会三人真实接近、暂停/侧栏隐藏、取消不发奖、错排/重排杯垫、部分杯垫进度的客户端冷恢复、收尾到齐。
- 最终保存已由隔离 Host 提交后丢弃 ACK，并暂时阻断读取：界面呈现未知结果，恢复仅只读核对，一次 operationId 只产生一次首次回忆/纪念物，没有写重放。
- 不同三人重玩只增加次数，首次参与者与日期保留，收起的茶签不被自动挂回；显式摆放可恢复留言树装饰。
- 普通挑茶经历 counter / choosing / seat / waiting，真实坐姿与脚点匹配，结束和取消保持已有回忆。
- 书屋窗座、书屋共读、茶签各导出一张真实720×960照片，拍照前后世界一致；此项不冒充相册保存/删除全流程。
- 书屋与茶区各自覆盖320×360、340×720、580×720卡片尺寸、浅深色、英文、200%文字与减少动态。外观操作不改变世界。
- 书屋等长损坏资源与茶区503在世界写入前拒绝，经真实门庭重试恢复。
- 每轮包含12次额外公共旅行；每个区域的 Texture / TextureSource / Blob URL 数量在往返后严格恒定：庭院128、书屋123、茶区125。地图资源和非活动区域纹理不进入当前 iframe owner。

## 视觉检查与证据边界

已目视书屋普通窗座、茶区七人入场、普通茶座以及 DPR2 英文200%截图。获批场景与角色正常显示；七人近距离自然遮挡保留。英文200%时底部导航长词分行、时间省略仍存在；对照历史 `approved-play-final-dpr2-01/tea-square-english-large-reduced.png` 可见相同表现。本次自动化 PASS 证明所列行为与宽度断言，不表示大字布局没有改善空间。

这里使用 **rc.3 官方 Connection 鉴权/请求分发 + 真实插件 Host/Client/iframe + 自有布局夹具**。`phase4-client` 的示例会话和侧栏不是完整官方 Client，因此本报告不能替代 rc.3 Desktop 的新增 More 菜单、真实会话草稿、官方布局和安装生命周期验收。

“客户端冷恢复”指销毁客户端 owner 并重载页面，Host 仍运行；完整 Host/Desktop 进程重启、旧 rc.2 profile 升级、安装/卸载另需独立证据。未覆盖原生 GPU、物理睡眠/最小化、长期内存浸泡或新方向动画资格。资源库存恒定不等于证明长期零泄漏；软件渲染短样本不作为硬件性能承诺。

## 重现与保留

已执行命令（重跑必须换新 label，脚本拒绝覆盖同名 QA 目录）：

```powershell
$env:DSH_VILLAGE_COMPAT = 'rc3'
node scripts/ai-village-tea-square-qa.mjs rc3-pre4-dpr1-01 1 --mode=play --approved-scenes
node scripts/ai-village-tea-square-qa.mjs rc3-pre4-dpr2-01 2 --mode=play --approved-scenes
```

日志分别为 `.build/rc3-pre4-dpr1-01.log`、`.build/rc3-pre4-dpr2-01.log`。各轮报告目录保存 `runner.mjs`、`build.json`、`result.json` 与30张PNG；独立profile保留在 `.build/ai-village-tea-square/<label>/profile`。两轮进程均退出0并经过runner的browser/context/Host清理。历史QA目录及历史包身份未被覆盖。
