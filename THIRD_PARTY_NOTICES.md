# 来源与许可

本仓库抽离自 Nidofy/dsh_desktop 的本地工作区，源代码基线为 `f3008a67f74e290ebd8fd61fc70ef870ca9493dc`，包含 2026-10-16 当时尚未提交的功能和修复。上游为 deepseek-ai/deepseek-harness，保存的原版基线为 `639ed01539`（0.2.0-rc.2）。原仓库 MIT 许可已保留在根目录及各包 LICENSE 中。

- `packages/desktop-pets`：来自 desktop-extras 的 pets、pet-coordination、资源管理、桌宠 assets、设置 UI，以及 apps/desktop/src/pet.ts；增加独立 Host/Client 入口、浏览器桥接和可选 preload。
- `packages/working-notebook`：来自 working-notebook，以及 desktop-extras 的 notebook/context/compaction/history 依赖闭包。
- `packages/plugin-shared`：来自 desktop-extras 的设置、配额接口和 optional Companion 类型。
- `packages/runtime-adapter`：来自 session-persistence-jsonl 的 provider、锁、格式与验证 worker，以及 compaction-basic 的 summarizer/config/types；Notebook 预设来自原版 web-app Standard 预设。保留 MIT 许可；新增持久化契约、可忽略插件日志标记和摘要子类。
- `tests/setup-dom.ts` 与迁移测试保留上游测试行为和快照；新增测试覆盖抽离后独立启停及打包。

DSH/Cordis 通过 peerDependencies 由安装环境提供。React、sharp、TypeScript、tsdown、Vitest 等依赖保留各自许可证，不在本仓库声明其版权。桌宠素材沿用源仓库随附文件；本次未生成新素材或扩展素材授权范围。二次发布素材前应按其原始授权范围使用。
