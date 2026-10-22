# 线程 A 内部候选交接

代码提交 `b7018ee15173c79ad324a0b19b3446626c9eda98`；公共基线 `bc230e7f662f47efb497529a276d09aad90ad4ac`。

- 候选入口：**ART_REVIEW**，可进入人工美术审查，未批准正式启用。
- 代码与包：A 自检通过的内部候选；B 独立 QA、可比性能/压力和真实 GPU 待完成。
- 包：`dist/nidofy-dsh-ai-village-0.6.4.tgz`，32,114,558 bytes。
- SHA-256：`93d7b3d7c0ce5d59622043e15f51925714e9188d3352961454087b38c33fe027`。
- 0.6.4 为保留的包版本；通过上述 SHA 区分本内部候选，不等同原0.6.4发布产物。

## 证据

- `FINAL_RESULTS.json`：代码、bundle hash 和真实验证结果。
- `ART_IMPORT.json`：源提交、原母版/图层hash、裁剪/pivot、资源预算。
- `preview/validation.json`：16组尺寸×主题×语言；真实小院透过门洞，门态0/25/50/100%截图，动态完整揭幕；热恢复0新增门图请求。
- `preview-missing-art/validation.json`：候选门图404后安全降级。
- `regression/validation.json`：15组生产入口场景；ART_REVIEW没有生产资源请求。
- `ui-regression/validation.json`、`recovery-regression/recovery-validation.json`：9项交互、4项恢复与事务检查。
- `logs/tests-with-b.txt`：合入 B 测试后33文件/159测试；`logs/b-png-validator.txt`：独立 PNG 校验器2测试；`logs/build-final.txt`：严格类型和正式构建。
- `PACKAGE_CHECK.json`：空缓存、不可达registry、禁生命周期脚本的离线安装与临时Host smoke。pnpm的“downloaded 1”计数是本地tgz导入，不是联网下载；DSH/React仅在安装后作为已有宿主peer提供。
- `TASK_LEDGER.md`：完整45项归属/状态；`THEME_AUTHORING.md`：未来主题替换契约。

早期 `*-failure` 文件是修复前/夹具调试证据，最终结论以对应 validation.json 为准。所有性能与真实 GPU 指标须由独立实验补充，当前没有声称“性能改善百分比”。

## B 接收方法

从共享 `coord/A_CHECKPOINT.json` 取已提交 SHA，在自己创建的独立 eval worktree 运行。先按 README 初始化隔离依赖，再运行候选预览/常规测试。不要在 A 工作树安装依赖、生成截图或运行构建。已有 `entranceArt` 和 `entranceArtStatus` 的选择导出现在位于 `src/client/entrance-art.ts`；几何验证函数仍在 `entrance-theme.ts`。

已收到 B 的 QA_HARNESS_READY，核对106个文件均属于 QA 后，将 `75abafdab896f7728d6c8bc23722fe0750c48440` cherry-pick 为 `d1e56d091269bd1d3c612503b3dd2dd386d3dd94`。B 测试保持原样，A 重跑159测试全过，旧基线 DQ-ART-01 空图层异常在当前 A 不再复现。`B_ACCEPTANCE.json` 与 `B_PNG_RECHECK.json` 记录接收和8张接入图的复核。B 的历史报告保留原始基线结果；仍需 B 在独立 eval worktree 复测最终 A 候选。B 已交付100次侧栏/尺寸循环证据，10次冷启动计时为 CONTENDED，不能用作正式性能结论。用户批准美术以后，才可记录批准依据并改APPROVED，重新构建与验收。一小时真实运行继续DEFERRED。未推送、合并main或安装实际用户profile。
