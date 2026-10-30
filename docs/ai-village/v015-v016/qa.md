# 0.15–0.16 隔离运行验收

日期：2026-10-29。基线 HEAD `37203e4bceb1dd9fd6573269104a8f97e2fcaecf`，AI Village `0.14.0-preview.6`，DSH `0.2.1-rc.3`。world15 / content11 / region2 / frame12。

所有运行使用真实插件 Host、生产渲染包和公开 UI 控件，浏览器夹具位于本机随机端口。未访问正式 DSH_HOME，未发送聊天、调用模型、注入世界或加速时钟。每轮源码、包及 build identity 哈希写入独立证据目录；失败轮次不覆盖。

## M0 基线实际试玩

| 运行 | 覆盖 | 结果 |
| --- | --- | --- |
| `baseline-fresh-dpr2-01` | 空 profile 首次打开；从公共入住控制加入 Claude；地图走访三地；场景点击完成找鲸；手账/收藏；隐藏与恢复；主动暂停保留；冷恢复；展开模式、英文/深色 | PASS |
| `baseline-pre6-dpr1-01` | 真实旧 world14 七居民存档迁移；茶香书签/倒影首次、取消、重玩、保存 ACK 丢失只读恢复；道具/收起；跨三地回忆、社交、收藏 | PASS |

固定 pre6 tgz SHA-256：`34d723b00831408c5b1d178806aeadef3184e54cd20c5abad96f18bf40cc7098`。这两次是本轮重新执行，不复用历史通过计数。`baseline-fresh-dpr2-01` 使用上一轮已冻结的源码和产物，避免并行开发污染基线。

### 真实截图审查发现

- 340px 浮卡中《茶香书签》纸签可以看见，但仅十余 CSS 像素，没有目标边框、动作提示或可点击反馈。玩家无法从场景辨别纸签能做什么。
- 七位居民在茶桌下方聚集时，居民抽屉遮挡主要手部操作。故事面板和气泡重复同一段台词，进一步挤占场景空间。
- 首次故事入口在居民/心愿页；旧版完成故事必须逐段点击文字按钮。角色确实走近和转向，非单纯文本伪装。
- 收藏、关系、纪念物来源可追溯，但分别散落在心愿的社区栏、手账回忆页和布置页；统一展示仍有明确价值。
- 空 profile 的三地区导航、找鲸场景点击、冷恢复可用；英文展开界面可读，主聊天草稿未被修改，隐藏不推进模拟。
- 此处截图已人工查看。软件 GPU、屏幕截图不能替代新正式美术签收或硬件 GPU 验收。

## 复现

```powershell
node scripts/ai-village-v015-qa.mjs <unique-label> 1 --mode=all --artifact=dist/nidofy-dsh-ai-village-0.14.0-preview.6.tgz
node scripts/ai-village-v015-qa.mjs <unique-label> 2 --mode=fresh --source-root=.build/ai-village-v015-qa/baseline-pre6-dpr1-01 --artifact=dist/nidofy-dsh-ai-village-0.14.0-preview.6.tgz
```

每次 label 必须全新；runner 的 `mkdir` 不覆盖旧证据。新 `scene` 模式用于 M1 真实鼠标链路，必须先构建与当前源码身份一致的 lib 后执行。

## M0阶段未覆盖

此M0检查点尚未执行原生 Desktop、真实硬件 GPU、物理睡眠、系统 IME、长期主任务并行性能。后续最终包原生范围已完成，见[原生报告](native/RESULTS.md)；其余范围仍未覆盖。当前浏览器使用已缓存 Chromium headless shell 和软件 GPU。M0 不视为 M1/M2 新增内容通过证明。

## M1 场景交互检查点

`0.15.0-preview.1` / world15 / frame13，源码及 lib 在 `m1-scene-dpr1-01` 独立冻结。后续使用 `--source-root` 对该冻结身份验证，避免 M2 并行变动混入本检查点。

| 运行 | 结果 | 说明 |
| --- | --- | --- |
| `m1-scene-dpr1-01` | FAIL，runner 时序 | iframe 鼠标操作经异步消息提交，旧 `settled()` 在消息抵达前返回；立即断言 active=null 导致误报。失败截图和状态已证明实际故事进入 approaching。修复 runner 为等待对应 command 结果，不改产品或放宽结果断言。 |
| `m1-scene-dpr1-02` | PASS | 实际点击发现→纸签→叶子→取消 held pointer→冷恢复→波纹→压平→角色实际到达→保存→纪念回访；倒影原图失败后镜像成功；未完成剧情不能旅行；340px 和展开模式。绑定最终 tgz 字节。 |
| `m1-scene-dpr2-01` | FAIL，runner 场景尺寸 | 完整两故事、缩放命中和英文深色已通过；564×596 宿主窗口触发正确的 insufficient-space 暂停，runner 仍等待场景物件，导致超时。保留证据。 |
| `m1-scene-dpr2-02` | PASS | 完整场景链路、剧情中缩放后的命中、英文深色；空间不足时冻结世界，再恢复到564×660短宿主窗口后可点击纪念。 |

M1 在 `.village-scene-story` 提供顶端短提示和取消入口，场景能直接完成两条已有故事。持久完成事实来自 Host 保存确认。scene 模式不调用 runtime 游戏动作方法，不通过注入世界跳过角色移动。

该检查点最终包 `nidofy-dsh-ai-village-0.15.0-preview.1.tgz`：53,695,306 bytes，SHA-256 `b08fd7355b2d85c4bd95dfcacdf751027b01ae7b319ba92a25a72e80389551b5`。DPR1/2 两轮均校验产物 lib/assets 与此包相同。七人茶区记录125张资源纹理（不含未统计的动态字形纹理），解码 RGBA 61,698,008 bytes；DPR1 稳态截图的 renderer paint p95约0.9–1.5ms，仅属于软件GPU现场采样，非完整性能结论。

### M1历史视觉问题（pre2已修）

`m1-scene-dpr1-02/scene-wave-replaced.png` 显示：Claude 的气泡盖住了叶子/波纹物件，虽然 pointer-events 允许鼠标穿透，但目标识别受到影响。三个标签字约 9 CSS px，且标签背景连成一排。已向核心线程报告；本轮功能 PASS 不表示这一视觉问题已签收。

## M2/M3 最终包的实际游戏事实

最终候选 `0.16.0-preview.2` / world16 / content12 / frame13。包53,735,544 bytes，SHA-256 `db489226be230fa1b9fa68bacc2a5a13da73fb1124dd762f643efd4c7e9c09df`。

1. `m2-ab-dpr1-01` 在pre1完整通过《白米饭与下午茶》。继续B时，入住 Mistral 自动启动了旧版欢迎故事；runner 未处理此活动，等待卷轴热点超时，整轮保留FAIL。产品正确保持活动互斥。
2. `m2-b-dpr1-02` 在独立复制的前轮profile上，使用公开按钮明确取消欢迎故事，再完成《被风吹乱的长卷轴》：错误排序、正确排序、途中冷恢复、首次事实、纪念回访全部PASS。原profile字节不变。
3. `m2-rest-m3-pre2-dpr1-01` 升到pre2，从AB的profile独立副本继续。先验证AB在pre2的回访文案、原事实和冷恢复，再完整完成C/D/E/F四组故事。日记首章一次正确物件点击未推进而超时；该轮仍保留FAIL，不能把前半局部成功改称整轮PASS。
4. `m3-pre2-dpr1-02` 从上轮已保存的日记首章阶段继续，没有取消剧情或改世界。首章、茶会广场第二章、庭院第三章的错误/正确物件操作、真实参与者走近、部分阶段和章节完成后的冷恢复、最终纪念回访全部PASS。最终同一世界拥有9条真实首次事实，每项count=1；六组居民覆盖十二位居民。剧情期间最多3人在场，七人场景另由M0/M1覆盖。

上述延续均复制专用QA profile，并在结束后逐文件哈希确认来源profile没有变化。原profile从不重置。AB完整流程绑定pre1；pre2对AB做回访/冷恢复而非完整重玩。CDEF和三章完整流程绑定pre2，文档不混淆构建身份。

### 最终包M1与点击时序证据

- `m1-pre2-dpr2-01` 的茶香书签最终物件点击一次后没有推进，保留FAIL。界面和权威状态仍为ready，没有错误发奖。原轮缺少输入瞬时trace，无法追认是旧frame token、自动保存窗口还是其他原因。
- `m1-pre2-probe-01` 从失败存档的独立副本执行一次新的明确点击，成功完成；原profile不变。它证明状态可继续，不证明旧失败原因。
- `m1-pre2-dpr2-02` 完整PASS，覆盖两故事、缩放、取消手势、REGION_BUSY、冷恢复、回访、英文深色和短窗。`result.json` 的 `sceneClick` 和 `sceneInputs` 是只读输入证据，不包含iframe桥接认证token。
- runner原先仅等物件ID存在，未确保同阶段物件的frame token已追上owner的serial，也未在每次点击前等待可操作状态。这一同步缺口现已补上：只等待当前token/非暂停/已确认状态，不在未知保存结果时自动重试。未采集trace的旧失败仍属于未归因，不因后轮成功改判。

pre2已经将无面板时的活动台词放在顶部短提示，取消了遮物气泡；目标文字增大并开启中文逐字换行，长发现指令改为短“查看线索”。AB/pre2和三章实际截图确认目标可读；这些矢量道具仍是开发资源，不作为正式位图美术签收。

## M4最终包四页和真实相册

`m4-pre2-dpr2-01` **PASS**，从最终9事实profile的独立副本运行：

- 故事页切换全部区域，9项均为completed，逐条核对来源eventId。
- 居民关系包含12位居民；六组入口各自检查每页最多4对，并实际点击前/后页。未把未发现条目当作历史。
- 纪念收藏有7件有实物的故事纪念（两章中间线索无物件），逐项核对来源eventId与首次参与者。
- 归家日记牌明确收起后仍显示已解锁、原来源与参与者；冷恢复仍可查询。
- 从手账相册进入真实取景，拍摄、保存到相册、退出，保持原用户暂停状态；冷恢复后相册1张、9条首次事实完全保留。没有由图片编造新事件。

已人工检查`journal-stored-still-queryable.png`和`journal-real-photo-preview.png`，340px面板内来源文字可读，主聊天输入仍独立可用。

## 性能与清理

软件GPU对比见[performance.md](performance.md)：同场景同单人，基线与候选实际canvas重绘均约22.2–22.5fps，浏览器rAF约60fps。二者含义不同，不能用rAF60冒充可见重绘60。低重绘节奏在pre6基线已存在。

完整浏览器文件哈希、每轮状态、失败原文和构建身份见[browser-evidence-index.json](browser-evidence-index.json)。所有runner已经退出，均在finally等待插件dispose、context/browser/Host关闭；[browser-cleanup.json](browser-cleanup.json)记录终检无chrome-headless-shell进程。CIM命令行查询被沙箱拒绝，故不声称已用CIM枚举全部Node子树；各测试工具会话均已返回退出码。原A6档和各延续来源profile均按对应result的终检保持原字节。
