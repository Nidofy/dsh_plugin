# 可复现问题与观察记录

共同生产 SHA（当前 A_SHA 替代基线）：bc230e7f662f47efb497529a276d09aad90ad4ac。
QA_SHA：本文件所在 QA_HARNESS_READY 提交，完整 SHA 由 coord/B_CHECKPOINT.json 指明。
环境：Windows x64 / 本机 Node（精确版本见 BASELINE.json）；本地固定依赖，离线。

## DQ-ART-01 — P2 / FAIL / 未修复

范围：src/client/entrance-theme.ts 的 validateEntranceArt(value: unknown)。

命令：

    node scripts/ai-village-dualqa-test.mjs packages/ai-village/tests/dualqa-art-contract.spec.ts

输入：测试内合成 metadata，具有合法 designSize / aperture / safe rect / 四种必需层，但 layers 数组首项为 null。合成 status 只用于函数测试，不改任何资源清单或审批状态。

期望：拒绝异常 metadata，返回 null，使上层保留安全 fallback。
实际：TypeError: Cannot read properties of null (reading 'kind')，在必需图层的 some() 回调先抛出异常。
证据：unit-latest.json，dualqa-art-contract.spec.ts 第 8 行。

影响：当前静态合法候选不触发；损坏/未来外部主题输入经过此 unknown 验证接口时不能可靠降级。不是已经发生的用户数据损坏或已批准资产故障。

建议 A：在访问任何 layer.kind/key/rect/pivot 前校验每项为非 null 普通对象，并维持原预算、路径和人工批准门槛。由 A 修复，B 在已提交 checkpoint 的 eval worktree 原样复测。

## DQ-BUDGET-01 — 资源导入约束 / raw FAIL，compat PASS

命令：

    node scripts/ai-village-dualqa-art.mjs --read-only --masters ../dsh_plugin-entrance-art/packages/ai-village/art/entrance-v1/source

期望：正式运行资源总计 ≤4 MiB、≤8,000,000 pixels、≤8 层。
实际：原始全画布 11 PNG 为 5,747,338 bytes、17,107,200 pixels（包含可选 mask/effect）；8 层 compat 为 2,749,401 bytes、1,773,738 pixels，满足预算。
严重度：集成约束，不是当前已集成产品 P1。不能直接将 raw 全集当作正式资产导入。
证据：art/RESOURCE_BUDGET.json。A 应以最终运行清单重新核验，保留母版源 hash；不能通过抬高预算绕过。

## DQ-MEM-01 — NEEDS_REVIEW / 非已证实泄漏

100 次 sidebar + resize，在相同尺寸稳定并 GC 后：20 至 100 次 listeners 恒定 640；初始 602，存在一次性 +38。nodes 初始 173，热态 249；documents 恒定 2。

证据：PERFORMANCE.json / browser-full.json。首版 harness 使用未经产品定义的 +20 绝对阈值而失败，已保留校准记录；之后依据同尺寸时间序列验证热态是否继续增长。不能把该改动解释成修改产品断言使产品变绿，也不能把稳定计数解释为完全没有内存保留。

下一步：在真实 GPU、独占测量窗口与最终 A candidate 上采 heap retaining paths，对一次性增长归因；目前没有 P0/P1 已证实产品缺陷。
