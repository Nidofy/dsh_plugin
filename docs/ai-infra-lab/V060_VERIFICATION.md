# AI Infra Lab v0.6.0 验收记录

2026-11-20 在 `codex/ai-infra-lab-v0.1` 分支从 `f88bad2` 验收。M1–M4 已完成。在 `packages/ai-infra-lab` 执行 `node scripts/check.mjs --full`，北京时间 15:02:39 至 15:07:05，八项退出码均为 0。

## 可核对的产物

- 本地 npm 安装包 `dsh-plugin-ai-infra-lab-0.6.0.tgz`，267,106 字节，26 个打包文件。SHA-256 为 `1abbe95a8f683855cedebc75c893710fadd3346c67617cbd415b82b7d89752f1`，已用 PowerShell `Get-FileHash -Algorithm SHA256` 独立复核。
- Windows 11 x64，Node.js 24.16.0，Docker 客户端与服务端 29.9.2。容器镜像 `dsh-ai-infra-lab-cpu:0.1` 为 linux/amd64，镜像 ID 为 `sha256:cd7be85023d4c08ca949ad9f43f8b2276ffb580597ce9f68bc954d4c43fd275b`。
- 本地机器可读记录在包目录的 `.build/gate-v0.6.0.json`、`.build/browser-v0.6.0.json` 和 `.build/coexistence-v0.6.0.json`。Git 保存源码、门禁和本文，安装包位于同一包目录。

| 门禁 | 耗时（秒） | 退出码 |
| --- | ---: | ---: |
| 严格 TypeScript、构建、单元测试与 SSR | 5.55 | 0 |
| npm pack 本地打包 | 0.80 | 0 |
| rc.2 和 rc.5 空缓存离线安装及生命周期 | 1.76 | 0 |
| 累计 22 道容器题、边界输入与隔离 | 160.35 | 0 |
| 分布式资源配额、死锁、输出与热卸载 | 51.20 | 0 |
| 六代同库打开及六份归档的幂等导入 | 2.79 | 0 |
| 真实 Edge 页面、图表与八种显示组合 | 25.84 | 0 |
| 官方 rc.5 七插件离线共存 | 17.77 | 0 |

## 课程、评分与运行对照

- 26 节课共 52 篇讲义均通过五段式结构、图解或表格、预测段、小结和长度检查。新扩充的 18 节扣除标题和围栏图解后，中文为 658–985 个字符，英文为 1,721–2,640 个字符。57 道练习共 456 条单语提示，依次引导概念、步骤、公式或边界、局部伪代码。按归一化四字符片段计算，各级提示与题干、同题先前提示的重合率均不超过 70%。
- B03–X01 的 14 道容器题覆盖 28 个函数签名，每个微步骤提供双语输入、边界和递推说明。真实 Docker 中，累计 22 道代码题的参考解 22/22 通过，原样 starter 22/22 均执行至完成并判定 failed。B03/B05 的边缘线程与额外搬运反例，以及 C04 分配整张注意力矩阵的反例均被识别。A04/A05 产生 5 个 CPU 实测 Roofline 点。
- 28 项 Node 行为和单元测试全部通过，跳过 0 项。测试逐课对中英文讲义与图表进行 SSR 并检查不可信文本转义，核对浏览器依赖白名单。对照台按步骤、指标名、单位和同名样本序号匹配，测试覆盖单侧缺值、基线为零、16 倍缩减、跨题记录过滤和预测文本转义。导师测试检查选中失败步骤、该次 Gloo 诊断以及拒绝成功步骤和无关步骤。
- Gloo 在回环网卡运行 2、3、4 个降权 rank。检查实际 UID 65534、无网络、只读挂载，以及 `pids.max=256` 的内核拒绝计数。单 rank 漏调在 25 秒超时后返回每个 rank 的最后原语，输出超限和长睡眠均触发回收。在观察到四个活动 worker 后卸载，路由返回 404，重开数据库可读到 cancelled。

## 真实浏览器尺寸与提交

Microsoft Edge 157.0.4341.60 以真实的 React 生产运行时加载 `lib/client.js`。独立页面使用测试插槽外壳，HTTP 请求经 Cordis 访问实际 Host，答案与运行存入临时 SQLite。视口为 1280 × 800 CSS 像素，DPR 1 与 2、亮与暗、中与英交叉成八种组合。每组都操作语言开关、打开七个组件，五个 B–E/X 探索器还切换教学预设。各主要图形和容量条均有实际尺寸。

| 可视化所在课 | 测量次数 | 宽度（CSS px） | 高度范围（CSS px） |
| --- | ---: | ---: | ---: |
| A03 浮点布局 | 8 | 718 | 673.91–673.91 |
| A07 Roofline | 8 | 718 | 777.66–868.44 |
| B04 合并访存与 Bank | 8 | 718 | 604.09–624.89 |
| C02 显存账本 | 8 | 718 | 487.14–519.14 |
| D05 流水线时序 | 8 | 718 | 464.95–506.55 |
| E02 请求调度与 KV | 8 | 718 | 853.67–895.27 |
| X01 八卡容量规划 | 8 | 718 | 706.75–793.14 |

- 56 次测量的页面级横向溢出都是 0 px。流水线的宽甘特图使用组件内滚动。正文前景与页面背景对比度实测亮色 15.05∶1、暗色 15.64∶1。实际页面的 `console.error` 和 `pageerror` 各为 0。浏览器检查中英文标题、讲义、摘要、控件与图例。
- 各组合均通过页面提交 X01-design 并收到 `inconclusive`。共 8 次显示 `.ail-feedback-neutral`，随后从服务端归档查到相应的 8 条开放题答复。
- 在真实 B05 容器运行结果中读取到下表字节数。输入形状为 [32,48] 和 [48,16]，FP32，块边长为 16。第二次运行从浏览器启动，对照台在运行结束后自动出现。D05 的实测时间线绘出 Rank 0、Rank 1、Rank 2、Rank 3，可互换双运行选择器，表中 world_size 随两次运行对调。

| B05 模拟缓冲区计数 | 朴素实现（B） | 分块实现（B） |
| --- | ---: | ---: |
| HBM 读 | 196,608 | 12,288 |
| HBM 写 | 2,048 | 2,048 |
| SRAM 读 | 0 | 196,608 |
| SRAM 写 | 0 | 12,288 |

## 安装、共存和学习数据

- 官方 0.2.1-rc.2 与 0.2.1-rc.5 分别使用新建临时 profile、空 pnpm store、禁用安装脚本和不可用的 registry，离线安装同一 tarball。两个宿主都通过官方兼容检查、构建指纹、发布依赖和浏览器三项外部依赖检查。每个宿主重复装载与卸载两轮，挂载时可读 26 节课，卸载后同一路径返回 404。
- 七插件共存另外使用独立 `DSH_HOME` 和空 store。核对主仓 `dist/desktop-rc5-manifest.json` 的六份 SHA-256，再与本包一同离线安装。Learn 的四个传递依赖 argparse 2.0.1、js-yaml 4.3.2、nodemailer 7.0.13 和 zod 4.4.3 使用通过 SHA-512 校验的本地 npm 缓存对象，也支持用 `OFFLINE_REGISTRY_TARBALLS` 指定同字节的离线包目录。所有临时覆盖只写入验收 profile。
- 官方 rc.5 的 `runProfile` 同时装载 8 个业务 Host 注册项（Learn 占两项），五个声明 Web 入口的客户端均在真实浏览器的 Cordis Loader 中激活。Lab、Notebook、Source Control 和 Village 四条 HTTP 路由均返回各自的业务数据。Notebook 为 enhanced，VCS 发现 0 个仓库。Lab 的 main 注册唯一，sidebar 顺序为 plugins 0、schedules 10、learn 15、ai-infra-lab 17。原 JSONL writer 已停用。共存测试在子进程释放原生 DLL 后回收 profile。

| 同 profile 交付包 | 版本 | 浏览器入口 |
| --- | --- | --- |
| `@nidofy/dsh-runtime-adapter` | 0.1.3 | 仅 Host |
| `@nidofy/dsh-working-notebook` | 0.2.2 | 已激活 |
| `@nidofy/dsh-source-control` | 0.1.5 | 已激活 |
| `@nidofy/dsh-ai-village` | 0.16.0-preview.3 | 已激活 |
| `@local/dsh-doc-pipeline` | 0.1.1 | 仅 Host |
| `dsh-plugin-learn` | 0.5.2 | 已激活 |
| `dsh-plugin-ai-infra-lab` | 0.6.0 | 已激活 |

- 升级链使用 0.1.0 `145f85e`、0.2.0 `58492c3`、0.3.0 `3d0f63b`、0.4.0 `e689c13`、0.5.0 `f88bad2` 和本候选。由 0.1.0 创建实际数据库并写入草稿、笔记、阅读、快进、估算答复、证据和一次 Docker 运行。六版依次打开同一路径，逐行比较 kv、drafts、runs、history，校验 application_id 为 1229734210 和原有修订号。
- 六版各导出一份归档，由候选分别恢复至全新的目标库并重复导入。每份保留 1 条运行、6 条证据及源档的阅读/快进状态。0.1.0–0.4.0 的档案保有证据绑定 ID，格式中没有答复正文。0.5.0 和 0.6.0 的档案各恢复 2 条正文。重复导入的新增数均为 0。结构、字节、数量上限、错误关联、内容版本、哈希与冲突回滚测试均通过。

## 范围与复验条件

复验需要本地 CPU 镜像、两套官方宿主、所列六份 Desktop tarball 及 Learn 的四个离线依赖，并需要本机 Playwright 与 Edge/Chromium。浏览器支持用 `PLAYWRIGHT_MODULE` 和 `CHROMIUM_PATH` 选择本机安装。测试使用合成学习档案。门禁末尾 `docker ps -a --filter "name=ai-infra-lab-"` 的匹配数为 0。提交前的 `git diff --cached --check` 退出码为 0。

本次覆盖单机 CPU、回环 Gloo 与 rc.5 官方 Web 运行时。验收范围外包括原生 Electron 窗口、移动视口、逐像素视觉快照、在线模型生成、跨节点通信、真实 CUDA/NCCL 及 70B/13B 部署。亮暗主题对比度数据针对正文前景与背景。Node 的开发模式 SSR 会提示 useLayoutEffect 在服务端无效，Node 24 也会报告实验类型转换和 npm Windows 启动器提示。浏览器错误数单独取自真实页面。
