# 茶会广场门禁验收

2026-10-25。阶段为内部玩法开发与美术候选审核；未运行生产地图入场后的完整可玩流程。

命令：`node scripts/ai-village-tea-square-qa.mjs gate-world14-dpr1-01 1 --mode=gate`。

结果 **PASS**。隔离鉴权Host实际读到world14 / region2；社区地图的茶会广场为建设中，前往按钮禁用。打开、选择、关闭地图前后world及revision完全相同。记录有3次启动、暂停及显式flush相关保存；不能将本轮说成全过程零保存，零写入结论仅限地图浏览区间。页面错误0，外网请求0。

证据：[result.json](browser/gate-world14-dpr1-01/result.json)、[构建身份](browser/gate-world14-dpr1-01/build.json)、[截图](browser/gate-world14-dpr1-01/tea-square-map-gate.png)。截图可见规划状态；禁用的前往按钮在可滚动预览下方，按钮状态由真实DOM断言验证。

| Bundle | SHA-256 |
| --- | --- |
| index.js | `7cfc0a7ecadd5e03f2e86aa6305720bbf78fe74bc5c1c0a2bc9c826ef55ba5a2` |
| client.js | `a764809de579699877ba98acaee20ee73a19ece594df1e998f64caa1594b53f5` |
| frame.js | `709748b70a16718b3e428b677f1260799779eb056d564c2448c3f819fc1ee805` |

这是该次门禁构建证据，后续核心或美术集成改变身份时不得当作最终包验收。

只读检查确认纯核心`tests/tea-square.fixture.ts`只创建局部世界，没有改写communityPlaces；组件渲染接收该世界不改变生产目录，也不写入浏览器Host或日常DSH_HOME。组件用例结果由主线程持有的`tea-square-panel.client.spec.tsx`记录。组件fixture不是正式资源渲染、浏览器路径、相机或生产旅行证据。

完整play、DPR2、语言主题尺寸、正式场景纹理/内存及冷安装仍待后续门禁开放与最终构建。

## 0.13最终门禁包：双DPR复核

新增可选图层注入、收尾择位等代码后，对统一构建的`0.13.0-preview.1`重新执行：

- `node scripts/ai-village-tea-square-qa.mjs gate-final-dpr1-01 1 --mode=gate`：**PASS**，[结果](browser/gate-final-dpr1-01/result.json)、[逐源及bundle身份](browser/gate-final-dpr1-01/build.json)、[截图](browser/gate-final-dpr1-01/tea-square-map-gate.png)。
- `node scripts/ai-village-tea-square-qa.mjs gate-final-dpr2-01 2 --mode=gate`：**PASS**，[结果](browser/gate-final-dpr2-01/result.json)、[逐源及bundle身份](browser/gate-final-dpr2-01/build.json)、[截图](browser/gate-final-dpr2-01/tea-square-map-gate.png)。

两轮均实际读到world14/region2，茶会planned禁入，地图浏览区间world/revision完全不变，页面错误0、外网请求0。126份src哈希与三个bundle在两轮间逐项一致，运行后再与当前src/lib逐项核对，差异0。没有修改正式源码，也没有执行play或加载茶会候选场景PNG。

| Bundle | 本次SHA-256 |
| --- | --- |
| index.js | `f298bc2dc63655380a884bcee881bd3c4fb3032c33e02f42a92450ba795d78f3` |
| client.js | `c515a6572d0956c15f7a7948dd951b34d79d2f405af05777977df7269578dddd` |
| frame.js | `62e45c8dceb145fae5115b79faf438f50c79a53e051c3eaf2ba4cc4b6933719d` |

前面的0.12门禁记录保留为历史批次；不得与本次身份混用。本次补齐的是门禁界面DPR1/2，不是茶会真实场景的双DPR、美术签收、故事路径或性能验收；后者仍待正式开放后执行。
