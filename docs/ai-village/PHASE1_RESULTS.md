# AI 小院：阶段 1 交付与验证

日期：2026-10-20。状态：视觉候选与技术试验已交付；用户随后明确确认视觉并授权阶段 2，后续见 [P2 记录](PHASE2_RESULTS.md)。以下保留阶段 1 的制作与验证结论。

开始实施前，P0 的三份文档已提交为 `0fb91a4`，同步 `origin/main` 后确认无需额外合并，并推送 GitHub main。P1 工作位于 `codex/ai-village-phase1`。

## 视觉交付

资源入口：[AI Village README](../../packages/ai-village/README.md)。

| 交付 | 规格与用途 |
| --- | --- |
| 蓝鲸角色基准 v01 | 1254 × 1254 RGBA，完整正面 Q 版、蓝白女仆装、鲸尾；候选，尚无分层 |
| 空小院 v01 | 1086 × 1448 RGB，3:4，暖色石地与绿植边缘；家具后续独立制作 |
| 合成预览 | 360 × 480 逻辑场景；300/340/360 CSS px 场景展示 |
| 小尺寸与透明检查 | 96/128 CSS px；白、灰、深色底 |
| 追溯记录 | 原始提示词、参考图哈希、原生尺寸、生成 ID、候选 SHA-256 |

两张原图使用内置 image_gen，保持生成器输出像素。截图来自实际浏览器/Pixi 渲染，不是画出的界面示意图。预览已提供中英文切换。

视觉检查结论：蓝发、头饰、白围裙、鞋和鲸尾在小尺寸下可辨认；三种底色下白色服装保留，无整块矩形背景。角色原图上下留白偏紧，细发丝较多，进入 P2 时需扩展统一画布并做干净的补绘/配准。当前站姿未加独立脚底阴影，地面接触感仍待处理。

透明度并非严格的二值遮罩：角色多数非透明像素的 alpha 为 253/255，边缘有更低 alpha。已保留原图并记录直方图；不能将当前候选称为已通过生产级透明边缘验收。P2 应在白/灰/深色背景及实际动作中复查。

小院主地面连贯；上缘门口有台阶，周边有绿植。后续可行走区域必须避开这些背景边缘，不能把整张矩形图片当作合法落点。角色与偏绘本风格的小院是否足够协调，仍以用户的视觉确认作为取舍。

## 技术结论

**保留 PixiJS 单渲染器路线，精确固定 8.22.0。** 依赖只在构建端准备，runtime 无 CDN。浏览器 IIFE bundle 为 537,065 bytes，不能套用现有 Live2D 的 256 KiB 限额；正式限制应按 P2/P3 实测制定。

Pixi 默认路径触发 CSP 的动态求值限制。使用其官方 `pixi.js/unsafe-eval` 模块提供的静态替代函数后可通过；这个入口名称不代表允许 `unsafe-eval`，实际 CSP 中没有该权限。iframe 仅允许脚本，保持不透明来源，不能访问 parent DOM/cookies，`connect-src 'none'`。角色与场景由父页传递 ArrayBuffer，再在 frame 内创建 Blob URL。

固定官方 DSH 0.2.1-rc.2 源码中已核实 `ProfileContext.dir`，试验使用真实 profile 目录身份，存档候选路径为 `<profile.dir>/nidofy-ai-village/world.json`。只操作 `.build` 内临时 profile。

存档试验使用官方 `withFileLock` 验证跨进程 owner 互斥，并用独立事务锁保护 CAS。Windows 文件发布复用共享库 `writeFileDurable` 的同步写入与 MoveFileEx 路径，保留 `.previous`。官方普通 atomic-write 文件写入路径尚不足以替代同步发布，本轮没有将其用于实际数据写入。

该实现是少数字段的最小试验，**不能直接升级为生产存档服务**。正式方案仍需不可变快照/current 发布机制、受控路径检查、客户端 owner epoch/租约、operationId、重连协调、状态校验和恢复界面。没有为了这个试验引入 notebook/runtime-adapter 插件。

## 已运行验证

命令：`node scripts/ai-village-phase1.mjs check`。结构化摘要见 [validation.json](../../packages/ai-village/art/QA/validation.json)。

- 严格 TypeScript 检查三份试验源码；frame 与存档试验构建。
- 候选原图 SHA-256、锁定依赖、12 个已安装依赖的许可证清单及预览归档内容。
- Chromium 软件 WebGL，DPR 1/2，360 × 480 backing store 随 DPR 正确变化；场景 CSS 宽度 300/340/360。
- 两个 iframe 实际渲染成功，ticker 停止；页面异常 0，外部网络请求 0；中文/English 切换。
- profile 隔离；持有 owner 时独立子进程被拒绝，释放后新子进程可以重新获取并读取 revision 2。
- 同一 revision 的两个并发保存只成功一个；前一版 revision 1 保留。
- NaN、损坏 JSON、未来 schema、超大文件被拒绝，原始内容不被覆盖。

未运行真实 DSH Desktop 安装/认证通信、多窗口 UI、硬件 GPU 性能、拔电/磁盘故障注入和完整迁移测试。阶段 1 预览归档不是插件安装包，也没有承诺游戏动作已完成。

## 下一检查点

原交接文件 `02_Codex_Start_Prompt.md` 第 29 行要求：“到这里先请用户确认视觉，再继续批量美术。”因此本次先交付可审阅的真实样板。

确认后，以这张角色作为身份基准制作补绘拆件、统一画布/锚点、表情以及 idle/walk/drag/put_down 动作；每批都检查配准、关节和 96/128px 观感。家具、地点动作、独立可玩场景和 DSH 接入仍按 P3/P4 顺序实施。
