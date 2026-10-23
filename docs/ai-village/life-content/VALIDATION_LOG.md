# 0.10 复验日志

本文件记录实际执行；尚未结束的项目不表示通过。旧 FAIL/INTERRUPTED 证据保留。

- 2026-10-23 恢复后官方 `node scripts/ai-village-release.mjs`：PASS，Host/Client 严格类型与三个 bundle 完成。前一次 definitions.ts 写入出现 Windows UNKNOWN open，重试原命令成功，没有改权限或测试门槛。
- `node scripts/typecheck.mjs`：PASS（exit 0），包括固定官方 Host/Client/public declaration 及 Git/Live2D 严格类型。
- 官方 vitest 默认并发首轮：57 files / 287 tests，284 PASS，3 FAIL（30,000ms timeout）：roster-expansion 完整资源字节闭包 33,445ms；retention 历史保护与有界快照 30,022ms；home 全 21 对居民五种双人活动 30,611ms。总耗时44.14s。执行时另有真实浏览器 QA 和类型检查，本条不将超时断言归为产品逻辑失败，也不将其算通过。下一轮减少 worker 并发，保持原 30s 门槛与全部断言。
- `story-qa/integration-01`：旧 FAIL 保留。故事/中途冷恢复/首次事实/跨区书签已通过，末尾测试把冷恢复后的浮卡直接置于544px宿主，命中原有最小宽度隐藏保护；没有先重新展开。修复 QA 为显式展开并量测实际 card 的320×360、340×720、580×720，未修改产品最小宽度。
- 暂停候选 SHA256 `2b922a25199608c8443544f125b2d0ac174df66b980780320d1ca9cee3310305` 在新包覆盖前已按哈希验证并复制到 `.build/package-history/pause-2026-10-23/`，连同当时 manifest。它仍为未完成验收候选。

- 同一源码官方 vitest `--maxWorkers=2`：57文件287测试全部PASS，38.65s，原timeout和断言保持。测试文件/产品代码均未因首轮timeout改变。
- 生产实现提交 `dd85524cbfeb64b8151a1653e252780459df9b90`，原画与独立美术门禁提交 `7e77aab`。完整源文件在最终 QA build.json 中逐一记录 SHA256。
- 以7e77aab重新执行release构建PASS；pack生成 `0.10.0-preview.1`，381文件，47,026,400 bytes，SHA256 `2a44566285875f40dbda18371b9384e634c43a821f9e65ac5556fc401caa9d11`。生产源码树在两次构建间未变。
- `node scripts/smoke-packed.mjs --exclude-sandbox`：PASS。解包Host导入/持久化/代际保护、browser factory/declarations/TS consumer、官方CLI全插件组合与单JSONL provider均在隔离profile通过。
- `node scripts/offline-install-check.mjs --exclude-sandbox`：PASS，空pnpm store安装8个离线插件并执行runtime检查。pnpm peer提示保留；运行时宿主提供其公开依赖，实际检查通过。未改实际DSH_HOME。
- `integration-02`全实际交互自动检查PASS。目视发现部分截图抓到面板出现动画中间帧，新增450ms视觉稳定等待及小窗滚动到“再读一次”操作的截图，使用新final标签再次取证，不覆盖02。
- 原画保全提交的 `art/deliverables/roster-expansion/preview.html` 在原生成输出第46、444、459行有尾空白；保留其交付证据原字节。生产源码和其余新增文本diff检查无该问题，不改变原画验收hash。

- 历史 v08/v09/table 等人工QA脚本仍有旧“全员入住”selector，适用于其原版本记录；0.10十二选七已移除该含糊按钮，本轮B/C/A脚本通过逐一入住验证容量和混合七人。未声称所有历史人工浏览器脚本已在0.10逐套重跑；原故事/小游戏/迁移行为由当前57文件回归覆盖，不为旧selector恢复产品按钮。
