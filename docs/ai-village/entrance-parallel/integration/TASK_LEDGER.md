# E00–E44 实际任务台账

代码提交：`ea8708d458643d3360eb1e9783431ca1dd7fece7`。DONE 指 A 的工程实现/自检完成，不代表人工美术批准。B 最终 QA 已合入；独立评估到A123d169。门缝修复后A原样复跑B断言通过，但不冒称B已独立复测新提交。详见 B_ACCEPTANCE.json。

| ID | 内容 | 归属 | 状态 | 证据/边界 |
|---|---|---|---|---|
| E00 | HEAD/branch/status/remote差异 | A主基线 + B各自核对 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E01 | AGENTS/设计/已实现清单 | A + B独立阅读 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E02 | 独立worktree/ownership | 各自 | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E03 | 原美术目录盘点/Alpha/来源 | **B主审计**，A仅做接入所需快速清单 | DONE | B已交付21 PNG来源/Alpha/完整性审计；A记录实际接入8张图hash。 |
| E04 | 初始测试/性能基线 | **B** | PARTIAL | B独立初始基线已交付；A另采10次串行软件基线。硬件可比性能仍未签收。 |
| E05 | 美术确定性导入脚本 | **A** | DONE | 导入器默认dry-run，重复write和生成器无tracked diff。 |
| E06 | PNG/sRGB/Alpha/压缩审计 | **B**独立工具；A做导入断言 | DONE | B独立PNG工具及源审计已交付；A使用未改动工具复核实际8图PASS，详见B_PNG_RECHECK.json。 |
| E07 | 无损裁切/压缩/rect/pivot | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E08 | layer mapping/manifest | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E09 | aperture/安全门洞/门轴 | **A**校准；**B**独立几何测量 | DONE | 门轴固定，修复6px横向重叠；双色背景0透色像素，Alpha重建0漏光。 |
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
| E24 | 设置/布置/相册/ESC衔接 | **A** | EXISTING_VERIFIED | 当前final-product验证照片/相册413/冷恢复与插件组件共存；UI/ESC历史回归保留。 |
| E25 | 慢加载/空态/用户文案 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E26 | 角色/小院微观视觉修复 | **A** | NEEDS_HUMAN_REVIEW | 没有擅自重绘角色或扩展玩法；整体观感待人工。 |
| E27 | 资源/像素/纹理预算测量 | **B**（独立度量） | PARTIAL | B确认compat预算通过；A复核2,749,401 bytes/1,773,738 pixels；峰值纹理/GPU内存待测。 |
| E28 | 冷热启动、耗时/CPU数据 | **B**采集；A基于证据优化 | PARTIAL | A10次串行软件启动p50=753ms/p95=774ms，记录CPU/内存；不作硬件或独占机器结论。 |
| E29 | 二次解码/监听器/WAAPI清理 | **A**修代码，**B**写资源泄漏用例 | DONE | 最终100次sidebar及100次close/show热态监听器稳定，无运行中WAAPI；初增retaining-path归因未测。 |
| E30 | SwiftShader/真GPU对比 | **B**主执行 | NOT_RUN | SwiftShader已验证，真实GPU未运行。 |
| E31 | Host白名单/离线打包 | **A** | DONE | 空缓存offline安装、资源hash、预览不入包、临时Host smoke。 |
| E32 | 浏览器/协议专用QA harness | **B** | DONE | B专属浏览器/协议框架已接收，QA提交见B_ACCEPTANCE.json。 |
| E33 | 门洞/门扇/Alpha/边界机器断言 | **B** | DONE | B发现DQ-SEAM-01；A修复后原断言通过，26,700屏幕像素/86,991设计像素均0透色；B新SHA复验未冒称。 |
| E34 | 多次开启/隐藏/尺寸压力 | **B** | DONE | B独立旧候选200循环通过；A修复后再次100sidebar+100真实close/show通过。 |
| E35 | 错哈希/断网/旧ACK/unknown | **B** | DONE | B独立旧候选异常回归完成；A新候选13生产+15预览通过，并补413照片保留/不重放。 |
| E36 | 全面回归记录 | **B**独立出报告，A对自己的候选跑内检 | DONE | B独立报告已收；A修复后159测试/完整入口矩阵/照片相册/离线包通过，未测边界见FINAL_RESULTS。 |
| E37 | 入口主题类型/验证接口 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E38 | 替换主题基础不造新场景 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E39 | 统一相机/门/动画常量 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E40 | 美术主题交接文档 | **A** | DONE | A实现及证据见 FINAL_RESULTS.json、ART_IMPORT.json 和 THEME_AUTHORING.md。 |
| E41 | 状态机/保存/安全独立审查 | **B** | DONE | B独立评估DQ-ART-01已确认修复；状态机/保存相关代码本轮未变，A159测试通过。 |
| E42 | 视觉/资源/性能独立审查 | **B** | PARTIAL | B独立审查完成并发现门缝；A修复原断言通过；真实GPU与正式性能签收未完成。 |
| E43 | P0/P1修复/正式候选构建 | **A** | DONE | 无已确认P0/P1；P2门缝已修复、生成内部候选并离线验证；正式发布仍待美术/硬件及独立签收。 |
| E44 | ledger/交付/sha/下一步提示 | **A最终**，B输出QA分报告 | DONE | 本地提交、coord SHA、证据索引、内部tgz及SHA已交付。 |
