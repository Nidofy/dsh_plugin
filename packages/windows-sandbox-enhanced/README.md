# DSH Windows Sandbox Enhanced

Independent official-Desktop plugin. Development baseline: official DSH
`dsh-v0.2.1-rc.2` (`687f282e8625c6b8d11ff58211a90524be2e4317`).

This preview provides read-only Windows ACL diagnostics and recovery planning.
It does **not** activate an isolated execution backend. Installing this bundle
does not prevent the official Windows ACL provider from granting Low IL access.
The companion guard bundle refuses process execution and filesystem mutations;
it is containment by refusal, not a usable sandbox.

Never install into a production profile assuming the isolated backend is ready.
No official installation file, real-workspace ACL, or DSH_HOME is changed by the
development build or tests. See `docs/windows-sandbox-enhanced.md` for the
qualification matrix and remaining integration work.
