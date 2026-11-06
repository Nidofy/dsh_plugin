# 1106 诊断讲义交接

本批仅补充既有课程的诊断深度，不新增活动、runner、reference、数据集或学习数据库。基于当前 0.5.0 源码核对，交给主控 A 合并到既有 `lectures.json` 并统一升级内容版本；本分支不改目录索引和版本。

| 文件 | 接入位置 | 学习闭环与独立检查 |
| --- | --- | --- |
| `packages/neural-lab/content/diagnosis-1106/mlp-diagnosis.md` | L04 的既有讲义，关联 L04-train | 预测漏清零/更新 → 实现 → MSE/梯度/SGD/validation checks → 固定 seed 单变量比较 → 多输出及 dropout 迁移 → 间隔复习 |
| `packages/neural-lab/content/diagnosis-1106/transformer-diagnosis.md` | L12 的既有讲义，关联 L12-assembly、L12-variant | 预测硬编码/泄漏/detach → 组件实现 → shape/因果/参数梯度 checks → 数据 split 与归因 → 三头及非法整除迁移 → 间隔复习 |

## 核对依据与边界

- 已读仓库 AGENTS、README、architecture 和主工作树 `docs/neural-lab-1106/` 三份规划文档。已有完整 MLP 和十四组件 Transformer，不把规划里的条件性建议当作缺失功能。
- 数字与检查名称来源：`runtime/training.py`、`runtime/char_transformer.py`、`tests/training-real.ts`、`content/catalog.json`、`src/runner.ts`（以上均位于 `packages/neural-lab/`）。活动的现有 testVersion 为 1；不由本批升级。
- 讲义明确合成数据、真实切分方法、先切分再窗口化、验证集选参限制、不同指标计算时刻、单变量比较的身份核对、completed 与 passed 区分，以及真实小规模 CPU 预算。
- 手算例是教学计算，不是运行曲线或用户运行证据；仅使用可直接复算的数值。没有新增未经执行的 reference。
- 复用 A 已验证的现有基础参考、training-real 28 轮及反例证据；这些不是课程写者本轮重新执行的结果。本批只做静态源码核对、手算数字复算和 diff 空白检查，不声称重跑 Docker/PyTorch 或完成 UI 渲染验收。

## 集成建议

将两份讲义的正文纳入既有 L04/L12 body，保留原有入门内容和 summary/hints/commonErrors；不要新增 lessonId/activityId。已有 UI 若没有逐字段显示所有运行身份信息，可引导查看已有导出/详情；缺失字段必须标记缺失，讲义不承诺不存在的面板。

集成后由 A 运行目录加载、相关内容/UI 测试与包构建，确认公式、表格和代码标识显示正常、旧活动/草稿身份未变。学习记录仍使用既有系统；讲义中的记录表是学习建议，不构成新的 schema。内容版本升级后旧运行按原版本保留，不追认旧 run 为新代码成绩。
