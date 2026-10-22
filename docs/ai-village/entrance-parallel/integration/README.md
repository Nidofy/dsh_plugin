# 线程 A：入口候选美术集成

公共基线：`bc230e7f662f47efb497529a276d09aad90ad4ac`（AI Village 0.6.4）。集成分支 `codex/entrance-integration`。美术来源提交 `42ee9f46eb0b772fb556631b9a75669c9ea49edf`，两个源仓库只读；原仓库两份未跟踪文档未复制或修改。

## 接入内容

- 确定性导入器从已提交美术读取八层 2x 裁剪版，逐文件比对 Git blob、SHA-256、PNG/RGBA/ICC、尺寸和预算，保留原始 PNG 字节。默认 dry-run；`--write` 才写入本 worktree。来源、原母版 hash、裁剪 rect 和门轴见 `ART_IMPORT.json`。
- 候选保持 `ART_REVIEW`。生产 `entrance-art.ts` 始终调用只接受 APPROVED 的选择器。只有本地鉴权实验夹具的显式构建 alias 使用 `experiments/entrance-review-art.ts`；没有查询参数、localStorage 或运行时开关可以在发行入口中启用候选。
- 使用源美术的圆拱 polygon；数值坐标、凸性及整个安全矩形受校验，不接收任意 SVG/URL。门扇向内旋转，石框在门前，框/轴不做相对视差。画布按高度保比例，宽屏两侧氛围随穿门淡出。
- 一次入场只启动一次 approach。首帧回执只唤醒等待，不重启镜头；阶段边界重新读真实 readiness，动画期间失去 readiness 时转简版等待。隐藏/卸载取消动画和等待；迟到 ResizeObserver 回调不访问已卸载节点。
- 简版/减少动态/软件渲染/普通重开不挂载门庭图片节点。图片解码完成前整体进度不显示100%。世界、偏好 schema、CAS/lease、frame protocol4、原 iframe 和游戏相机保持既有语义。

## 可重复命令

在自己的隔离 worktree 中执行：

```powershell
node scripts/ai-village-entrance-import.mjs --source=<只读美术worktree> --dry-run
node scripts/ai-village-entrance-import.mjs --source=<只读美术worktree> --write
node scripts/ai-village-resources.mjs
node node_modules/vitest/vitest.mjs run --config scripts/ai-village-official.vitest.mjs
node scripts/ai-village-release.mjs
node scripts/ai-village-entrance-review.mjs
```

依赖准备按仓库 README；独立固定官方 runtime 与官方源码位于本 worktree 的 `.build`，仅安装的构建工具按项目 setup 约定引用宿主依赖。不得让 QA 在 A 的输出目录运行构建。

## 验证边界

`preview/validation.json` 记录实际结果，`logs/` 保存命令输出。关键帧截图在真实组件中通过测试夹具定位门角度；随后释放真实首帧消息队列，验证完整生产动画、首帧门控和同一个 iframe 揭幕。它们不是手工批准美术。

后端为 Chromium SwiftShader；夹具显式选择 DOM 动画用于审查，不能宣称真实 GPU 合格。尺寸/主题矩阵不作为性能基线。早期失败截图/日志保留，仅最终 validation 的 PASS 才表示本轮通过。A 的自检不替代 B 的独立 QA。真实 GPU/DPI、人工观感待验，一小时运行 DEFERRED。
