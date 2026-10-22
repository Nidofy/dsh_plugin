# AI Village 独立 QA 工具

本工具属于线程 B。只改 QA 文件，不写正式 manifest，不批准艺术，不接触真实 DSH_HOME，不联网安装依赖。

## 环境与输出

Node 24+；从相邻 dsh_plugin 只读复用现有 TypeScript / Vitest / tsdown / sharp / Playwright / Chromium 缓存。可用 DUALQA_DEPS 指定已准备好的依赖仓库。源版本以当前 QA/evaluation checkout 为准，绝不使用 donor 的生产代码代替被测代码。

tools/ai-village-dualqa/.generated 是唯一构建/cache/profile 目录，已忽略。该目录中的 node_modules junction 只提供读取现有依赖。已有 retention 测试的 .build/ai-village-phase4 临时路径由 QA Vitest 适配器重定向至本目录；不改变其断言。仅测试夹具 bundle 暴露 preferences/hide/show 控制，不发布至产品。

## 直接执行

在本 QA worktree 根目录：

    node --test tools/ai-village-dualqa/png.test.mjs
    node scripts/ai-village-dualqa-test.mjs
    node scripts/ai-village-dualqa-typecheck.mjs
    node scripts/ai-village-dualqa-art.mjs --read-only --masters ../dsh_plugin-entrance-art/packages/ai-village/art/entrance-v1/source
    node scripts/ai-village-dualqa-build.mjs
    node scripts/ai-village-dualqa-browser.mjs
    node scripts/ai-village-dualqa-art-browser.mjs

基线的单测预期 52 PASS / 1 FAIL：DQ-ART-01 是保留的生产校验器复现，未使用 skip、todo 或 expected-failure 隐藏。资源审计退出 1 表示 raw 母版超预算；兼容候选单独 PASS，不代表可以发布 raw 资源。

浏览器可指定场景：normal、late-paint、decode-reject、wrong-hash、truncated-png、missing-core、slow-skip、disconnect、reduced-motion、reduced-transparency、matrix、stress、close-stress。缺浏览器时应记录 NOT_RUN，不安装在线依赖。每场景使用独立临时 profile，外网请求拒绝。stress 默认 100 次 sidebar 隐藏/恢复和尺寸轮转；close-stress 另跑100次真正关闭/重开；两类结果分开记录。

截图对比：

    node scripts/ai-village-dualqa-compare.mjs before.png after.png label

要求相同像素尺寸，输出逐通道差值、变化比例与三联图；不自动给视觉批准。原美术预览输出标记为 source preview，不代表生产集成已通过。

性能采集示例：

    node scripts/ai-village-dualqa-browser.mjs normal normal normal normal normal normal normal normal normal normal
    node tools/ai-village-dualqa/report.mjs

这些样本默认 CONTENDED，不提供正式基线结论。暖启数字测的是 sidebar 返回，包含尺寸轮转，不直接与冷启简单相减。真实 GPU / DPI、一小时运行仍分别 NOT_RUN / DEFERRED。

## 已提交 A checkpoint 的隔离评估

    node scripts/ai-village-dualqa-evaluate.mjs --qa <完整QA提交SHA>
    node scripts/ai-village-dualqa-evaluate.mjs --qa <完整QA提交SHA> --create

默认读取任务包 coord/A_CHECKPOINT.json，可用 --checkpoint 指定。检查 A SHA 为真实 commit 且属于 A 集成分支；逐提交审核 QA 文件白名单；新建带 A/QA SHA 的 detached evaluation worktree，只 cherry-pick --no-commit QA 提交。已有目录绝不覆盖。然后在该 eval 根目录运行本工具的 test/build/browser，使用其自身 .generated/profile。

A 未提供 checkpoint 时只报告缺失，不轮询、不读取其 dirty 生产文件、不在 A worktree 构建。首次交接 commit 不包含共享协调文件；coord/B_CHECKPOINT.json 由 B 单独写入，引用已提交 SHA。

## 范围限制

PNG 检测包括 CRC、截断/多余字节、解压长度、滤波标记、尺寸上限、Alpha 边界、ICC 元数据及逐文件哈希。Adam7 的像素解码交给 sharp，不能将本工具作为通用安全 PNG 解码器。门洞闭合检查使用原始 full-canvas Alpha；兼容裁剪图层和最终产品的透视/门轴仍需 A checkpoint 集成验证。联系图不修改原图。

## A候选受限预览

    node scripts/ai-village-dualqa-build.mjs --review
    node scripts/ai-village-dualqa-review.mjs
    node scripts/ai-village-dualqa-review.mjs seam-probe

仅在具有A已提交review接口的eval中执行。沿用A的受限模块alias；不改APPROVED门槛。默认14项预览/中断测试加1项闭门透色探针；当前候选探针FAIL应保留。最终精确SHA、已修问题与未运行范围见QA目录LATEST_EVALUATION.md。
