# Windows Sandbox Guard (qualification only)

Optional companion to DSH Windows Sandbox Enhanced. It replaces `sandbox`,
`subprocess`, and either `fs-sandbox` or `filesystem` with refusal-only providers. No command executes,
including `danger-full-access` requests through these services. File provider
reads are refused too: this is an intentionally unusable execution environment,
not a functional sandbox. Trusted Host code bypassing these services is outside
its scope. Agent Loop requires `windowsSandboxGuardReady`, published only after all three providers register. A conflict leaves Agent Loop pending and the official boot audit rejects the profile. Later privileged profile overrides that remove this dependency are outside this contract. On non-Windows hosts the bundle leaves official providers unchanged.

Use only in disposable official **0.2.1-rc.2** test profiles. Do not install on
older DSH versions or use version exemptions. The diagnostics bundle
alone does not install this guard. Disable/remove the whole guard bundle to
restore official services; that can restore the official Low IL behavior too.
Already running processes from a previous provider are not retroactively confined.
Restart a quiescent test profile when changing execution providers.

本次发行以官方 DSH 0.2.1-rc.2 为统一基线。Windows x64 离线包包含所需第三方运行依赖及许可证，宿主 DSH/Cordis/React 由已有安装提供；不需要联网下载插件依赖。更新后完整重启 DSH。全仓库发行及验证记录见 `docs/releases/0.2.1-rc.2.md`。
