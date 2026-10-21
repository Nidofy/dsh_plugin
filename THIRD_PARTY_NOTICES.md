# 来源与许可

2026-10-21 的全插件兼容基线统一为官方 DSH `0.2.1-rc.2`，源码 revision `687f282e8625c6b8d11ff58211a90524be2e4317`。下文的旧 revision 是原始提取来源；本次 worker 的上游部分改为该新版固定官方源码。

Windows x64 离线包内嵌 Koffi、Sharp 等运行依赖及各自许可证，准确版本见各包 `OFFLINE-DEPENDENCIES.json`。sandbox-enhanced 的自包含 .NET 运行时保留 `native/runtime/DOTNET-LICENSE.TXT` 与 `DOTNET-THIRD-PARTY-NOTICES.TXT`；宿主 DSH/Cordis 不随插件重复分发。

`packages/live2d`：构图与模型引用校验提取自 2026-10-18 本地 desktop-extras，浮层几何适配来自本仓库 source-control；隔离 iframe、消息桥接、独立路由与插件注册为新增实现。Bluewhale 立绘和模型沿用用户现有资源。Cubism SDK for Web 5-r.5 Core 原样复制，Framework 使用原有离线适配器，相关许可与 SDK 版本保存在该包 assets/live2d 中；这些资源不受本仓库 MIT 许可证覆盖，原始来源记录未认证公开分发授权。assets/manifest.json 记录所有复制资产的 SHA-256。仅生成本地验证包，未发布 npm。

`packages/source-control` 为新增实现，参考 Codex/Zcode 截图的交互风格、MIT 的 VS Code Git 扩展及 vscode-hg 的功能设计；没有复制它们的源码、图标或品牌素材。调查链接见 `docs/source-control.md`。Git 与 Mercurial 为宿主外部可执行程序，不打入插件包。

本仓库抽离自 Nidofy/dsh_desktop 的本地工作区，源代码基线为 `f3008a67f74e290ebd8fd61fc70ef870ca9493dc`，包含 2026-10-16 当时尚未提交的功能和修复。上游为 deepseek-ai/deepseek-harness，保存的原版基线为 `639ed01539`（0.2.0-rc.2）。原仓库 MIT 许可已保留在根目录及各包 LICENSE 中。

- `packages/desktop-pets`：来自 desktop-extras 的 pets、pet-coordination、资源管理、桌宠 assets、设置 UI，以及 apps/desktop/src/pet.ts；增加独立 Host/Client 入口、浏览器桥接和可选 preload。
- `packages/working-notebook`：来自 working-notebook，以及 desktop-extras 的 notebook/context/compaction/history 依赖闭包。
- `packages/plugin-shared`：来自 desktop-extras 的设置、配额接口和 optional Companion 类型。
- `packages/runtime-adapter`：来自 session-persistence-jsonl 的 provider、锁、格式与验证 worker，以及 compaction-basic 的 summarizer/config/types；Notebook 预设来自原版 web-app Standard 预设。保留 MIT 许可；新增持久化契约、可忽略插件日志标记和摘要子类。
- `tests/setup-dom.ts` 与迁移测试保留上游测试行为和快照；新增测试覆盖抽离后独立启停及打包。

DSH/Cordis 通过 peerDependencies 由安装环境提供。React、sharp、TypeScript、tsdown、Vitest 等依赖保留各自许可证，不在本仓库声明其版权。桌宠素材沿用源仓库随附文件；本次未生成新素材或扩展素材授权范围。二次发布素材前应按其原始授权范围使用。
