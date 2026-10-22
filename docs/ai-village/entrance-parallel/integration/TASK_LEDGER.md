# E00–E44 实际任务台账

代码提交：`b7018ee15173c79ad324a0b19b3446626c9eda98`。DONE 指 A 的工程实现/自检完成，不代表人工美术批准。B 基线 QA 专属提交已选择性合入，测试/报告保持原样；当前候选的 B 独立复验仍待完成。详见 B_ACCEPTANCE.json。

| ID | 内容 | 归属 | 状态 | 证据/边界 |
|---|---|---|---|---|
| E00 | HEAD/branch/status/remote差异 | A主基线 + B各自核对 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E01 | AGENTS/设计/已实现清单 | A + B独立阅读 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E02 | 独立worktree/ownership | 各自 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E03 | 原美术目录盘点/Alpha/来源 | **B主审计**，A仅做接入所需快速清单 | DONE | B已交付21 PNG来源/Alpha/完整性审计；A记录实际接入8张图hash。 |
| E04 | 初始测试/性能基线 | **B** | PARTIAL | B基线单测及12浏览器场景已交付；计时CONTENDED，正式性能基线未运行。 |
| E05 | 美术确定性导入脚本 | **A** | DONE | 导入器默认dry-run，重复write和生成器无tracked diff。 |
| E06 | PNG/sRGB/Alpha/压缩审计 | **B**独立工具；A做导入断言 | DONE | B独立PNG工具及源审计已交付；A使用未改动工具复核实际8图PASS，详见B_PNG_RECHECK.json。 |
| E07 | 无损裁切/压缩/rect/pivot | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E08 | layer mapping/manifest | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E09 | aperture/安全门洞/门轴 | **A**校准；**B**独立几何测量 | DONE | 凸polygon与安全矩形验证、16组候选构图。 |
| E10 | ART_REVIEW受限预览门禁 | **A** | DONE | 独立实验alias；生产15场景确认0候选资源请求。 |
| E11 | 入口协调器与状态机 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E12 | 真实加载进度/ACK追溯 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E13 | 冷热启动/隐藏重试生命周期 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E14 | 过期ACK/frame/revision竞态 | A修正式入口；**B写测试** | EXISTING_VERIFIED | 现有token/attempt/assets/view回归通过；未改协议。 |
| E15 | 暂停/保存/lease/skip安全 | A修生产；**B写对抗用例** | EXISTING_VERIFIED | 159行为测试、15入口场景及恢复回归；B测试原样合入。 |
| E16 | 资源异常/解码失败/渲染回退 | A修产品；**B写故障注入** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E17 | 正式门庭图层接入 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E18 | approach/wait/open/cross时序 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E19 | 双门透视/门轴/视差 | **A** | DONE | 内开角度/按高度构图/固定轴；人工观感仍待签收。 |
| E20 | 七头像真实进度上色 | **A** | EXISTING_VERIFIED | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E21 | reveal/HUD/关闭/跳过/来源 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E22 | 场景/入口/UI色系统一 | **A** | NEEDS_HUMAN_REVIEW | 浅深自动矩阵已完成；暖色协调与宽屏软边需人工意见。 |
| E23 | 窄/宽/短高/语言适配 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E24 | 设置/布置/相册/ESC衔接 | **A** | EXISTING_VERIFIED | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E25 | 慢加载/空态/用户文案 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E26 | 角色/小院微观视觉修复 | **A** | NEEDS_HUMAN_REVIEW | 没有擅自重绘角色或扩展玩法；整体观感待人工。 |
| E27 | 资源/像素/纹理预算测量 | **B**（独立度量） | PARTIAL | B确认compat预算通过；A复核2,749,401 bytes/1,773,738 pixels；峰值纹理/GPU内存待测。 |
| E28 | 冷热启动、耗时/CPU数据 | **B**采集；A基于证据优化 | PARTIAL | B记录10次冷启动/100次侧栏返回计时CONTENDED；正式可比数据未运行。 |
| E29 | 二次解码/监听器/WAAPI清理 | **A**修代码，**B**写资源泄漏用例 | DONE | 热恢复0新增门图请求；卸载取消通过；B基线100次侧栏循环监听器初增后稳定，归因/最终候选复验待完成。 |
| E30 | SwiftShader/真GPU对比 | **B**主执行 | NOT_RUN | SwiftShader已验证，真实GPU未运行。 |
| E31 | Host白名单/离线打包 | **A** | DONE | 空缓存offline安装、资源hash、预览不入包、临时Host smoke。 |
| E32 | 浏览器/协议专用QA harness | **B** | DONE | B专属浏览器/协议框架已接收，QA提交见B_ACCEPTANCE.json。 |
| E33 | 门洞/门扇/Alpha/边界机器断言 | **B** | PARTIAL | B源美术30关键帧/6双背景门洞检查通过；最终A候选独立复验待完成。 |
| E34 | 多次开启/隐藏/尺寸压力 | **B** | PARTIAL | B基线100次侧栏/尺寸恢复循环通过；100次真实关闭/重开及最终A候选待测。 |
| E35 | 错哈希/断网/旧ACK/unknown | **B** | PARTIAL | B基线故障注入已交付；A159测试通过；最终A独立浏览器注入待完成。 |
| E36 | 全面回归记录 | **B**独立出报告，A对自己的候选跑内检 | PARTIAL | A UI/恢复/入口自检通过；B基线报告已收，最终A独立报告待完成。 |
| E37 | 入口主题类型/验证接口 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E38 | 替换主题基础不造新场景 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E39 | 统一相机/门/动画常量 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E40 | 美术主题交接文档 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E41 | 状态机/保存/安全独立审查 | **B** | PARTIAL | B基线测试/审查已交付；DQ-ART-01在A用原样测试通过，待B独立复验。 |
| E42 | 视觉/资源/性能独立审查 | **B** | PARTIAL | B源视觉/资源审计已交付；性能样本CONTENDED，最终候选与真实GPU待测。 |
| E43 | P0/P1修复/正式候选构建 | **A** | BLOCKED | A内部离线候选及自检完成；独立QA/人工签收阻挡正式放行。 |
| E44 | ledger/交付/sha/下一步提示 | **A最终**，B输出QA分报告 | DONE | 本地提交、coord SHA、证据索引、内部tgz及SHA已交付。 |
