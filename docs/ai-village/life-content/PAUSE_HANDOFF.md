# 安全暂停交接 · 2026-10-23

用户明确要求“请在安全的地方暂停任务”。本记录是暂停点，不是完成或发行验收。全部工作保留在独立插件仓库 `D:/Documents/FeiyangChen/devApps/dsh_plugin`。

## Git 与包身份

- 分支：`codex/feature-ai-village-entrance`；HEAD仍为 `6a254cd2b0e7afdaeeb02ca1723402872078b3d7`。本轮未提交、未推送、未发布。
- 用户确认任务A的“0.9.2”实际指已交付 `0.9.0-preview.2`；基线包SHA256 `929d5be8cb72a2ad0c1e9a32b30fc90181c3ceab2d4a6755fd6e884ff19d5638`。
- 新工作树候选版本 `0.10.0-preview.1`，world11/content8/frame8；scene3/rules4/region1/preferences3保持。
- 暂停时已在运行的pack自然完成：`dist/nidofy-dsh-ai-village-0.10.0-preview.1.tgz`，381文件、47,025,664 bytes，SHA256 `2b922a25199608c8443544f125b2d0ac174df66b980780320d1ca9cee3310305`。
- **该包仅为未完成验收候选**：未执行本轮最终smoke/offline install、原生候选安装/性能、最终完整矩阵，不可称最终交付包。

## 已实现但未提交

1. 五位新角色Seedance/GLM/MiniMax/Llama/Mistral生产部件、头像、资源闭包、居民偏好/台词/微动作；十二位可选，仍最多七人同时在场；原批准七头像入场不改。
2. `roster-policy.ts`显式legacy/current范围，历史1–10默认旧七人，新schema11先验证旧态再补五配饰none和空书屋剧情；v10独立冻结。当前engine投影显式current，历史decoder默认legacy，48KiB与7人上限不放宽。仅旧七人时社交轮换仍原七人目录。
3. `bookhouse-state.ts` / `bookhouse-engine.ts`独立三段故事“夹在书里的微光”：书柜选主题→阅读桌写句子→窗边收书签；两居民实际寻路/90tick观察/阶段令牌；首次参与者/完成tick/主题保留，重玩count，取消不奖励。进行中拒绝旅行/普通活动，仍不允许庭院play进入书屋。
4. 四入口BookhouseStoryPanel、收藏目标/纪念物、确认消息和两区书签绘制；同世界CAS与未知结果只读核对。
5. 正式书屋概念候选与独立门禁已制作，`art/deliverables/bookhouse-scene-candidate/`和`docs/ai-village/BOOKHOUSE_SCENE_ART_REVIEW.md`。仍CONCEPT_CANDIDATE/approvedForRelease=false，不进入运行资源，不能替代批准场景。门庭PNG未改。
6. 新README/architecture/version说明已写，README当前链接的 `life-content/RESULTS.md` 尚待恢复后完成，不应把该链接当现有验收结论。

## 实际验证与限制

- 全量官方vitest：56文件281测试PASS（此轮之后新增3个bookhouse测试及跨活动eventId命令拒绝修复，尚未再次完整跑全套）。
- 最新bookhouse专项：10测试PASS，包括三段真实路线/7人拥挤无碰撞/冷恢复/取消/重玩/迁移原字节42次保存保护/legacy历史字段新ID拒绝/跨active事件ID冲突。
- 运行时新增lost-ACK书屋完成回归已在281全量内PASS：未确认不发布memory，核对后只完成一次，不重放写。
- `node scripts/typecheck.mjs` PASS（exit0）；之后的共享小改已由最终release严格Host/Client编译通过。
- `node scripts/ai-village-release.mjs`最终运行PASS；pack自然结束PASS，未继续新检查。
- B角色专属7文件20测试PASS；真实浏览器first-run PASS（5位逐一入住/选中/独住23纹理、12名册双语/7容量、混合7庭院128/书屋121纹理、精确暂停冷恢复）。证据 `packages/ai-village/art/QA/roster-production/first-run/`；activities-run状态以子代理暂停补记为准。
- C真实浏览器 `story-qa/integration-01`：实际UI两位入场、三段走到位与停留、stage1精确暂停冷恢复、完成首次事实/书签、带回庭院、最终精确冷恢复均PASS；随后544×596窄窗找不到“心愿”tab超时，**整体FAIL**，截图/视频/build哈希/validation保留。需先诊断尺寸/布局与脚本导航，不放宽断言。
- A固定基线原生：Intel Arc140T、真实GetDpiForWindow168/DPR1.75、七居民硬件庭院25.967FPS/书屋26.076FPS；JS p95 1.0/1.2ms；CDP已列进程CPU19.978%/20.157%单核，缺独立Host所以不是全应用CPU。隐藏20s零绘制/零ticks/world相同。详见 `QA_STABILITY.md` 与 `QA-native/`。
- A一小时基线soak收到暂停命令后要求安全中止，必须标INTERRUPTED和真实时长，不能PASS；以子代理收尾记录为准。硬件物理休眠未测，不能以最小化或renderer freeze替代。

## 保护与进程

用户日常DSH_HOME/DSH_Official实例未操作。所有新QA使用 `.build` 隔离profile。已有旧历史资料和已批准入口资源保留。

主代理持有的story QA session自然以exit1结束，finally关闭自己的Playwright context/browser与Host；pack session自然exit0结束。主代理无活跃构建/测试进程。A/B已收到停止新工作及安全关闭自己隔离实例的命令，进程收尾以子代理补记为准；不要停止用户DSH。

未跟踪的 `docs/ai-village/NEXT_FEATURES_2026-10-21.md`、`UI_VISUAL_DIRECTION_REVIEW_2026-10-22.md` 和整个 `output/` 是既有内容，禁止整目录提交/删除。已完成角色原画/QA/提示词等也是用户既有未跟踪成果，必须保留；恢复后只选择本轮相关路径提交。

## 恢复顺序（仅在用户要求继续后）

1. 读本记录、AGENTS/README/architecture、`QA_STABILITY.md`、B活动验收收尾；先确认本轮测试进程已退出、Git状态和包哈希，勿重置数据。
2. 修复或说明C窄窗真实UI失败并使用新label运行 `node scripts/ai-village-bookhouse-story-qa.mjs integration-02`；旧FAIL证据不覆盖。补320×360/340×720/580×720、双语/减少动态与照片实际验收。不要注入时钟或世界伪造完成。
3. 最新代码全量 `node scripts/test.mjs --config scripts/ai-village-official.vitest.mjs`，`node scripts/typecheck.mjs`，`node scripts/ai-village-release.mjs`；有代码改变再按最终bundle重跑必要角色/故事验收。
4. `node scripts/pack.mjs --only=ai-village`；记录新SHA而不覆盖历史身份；`node scripts/smoke-packed.mjs --exclude-sandbox`、`node scripts/offline-install-check.mjs --exclude-sandbox`。候选原生安装/实际GPU/DPI/切换/门控/冷恢复与长时验证仍需完成。
5. A软件书屋CPU诊断尚未补完，需证据驱动，不凭历史SwiftShader低FPS推断修改renderer；1h耐久和真实OS休眠按用户授权/可用环境准确列未测边界。
6. 完成RESULTS/迁移与包身份记录，`git diff --check`，检查只纳入本轮文件再按用户原授权提交，不推送/npm发布。

## 子代理最终收尾确认

- A：soak driver已退出；通过产品UI保存userPaused=true和checkpoint后，仅停止本次隔离载体PID38600及其children，18769无监听，用户日常PID40100仍在。`soak-60min-01/result.json`为INTERRUPTED：7个一分钟有效样本，共420.685s；记录时wall486.942s。软件诊断、原生完整冷恢复、minimize/freeze、完整1h和新候选原生复验尚未运行。
- B：activities-run在停止检查时已自然exit0，finally关闭自己的browser/Host，无遗留进程。五位×三个实际家具拖动及目录/跨区/冷恢复自动检查完成，27PNG与validation保留，但尚未目视复核/最终包比对；`activities-run/pause-status.json`明确PAUSED_BY_USER。两轮旧证据有实际bundle SHA，但新增sourceHashes/HEAD/dirty build记录写法是在第二轮进行中才补入，恢复后应统一final build再新label复验，不补造旧build.json。
- 本轮所有子代理已停止；未执行任何提交或推送。
