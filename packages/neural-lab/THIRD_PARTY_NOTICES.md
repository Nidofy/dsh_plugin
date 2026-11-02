# Sources and licenses

The Host agent integration and workbench architecture are adapted from deepseek-harness-leetcode (MIT, Copyright 2026 kapelame), reference commit d397c96a81294c02faa405b72fe0930a9009843f and the locally supplied rc.5 adaptation. The complete MIT terms are included in LICENSE.

Version 0.1.1 also adapts the Learn native-textarea editor and lexical completions from `source/client-ui-learn/src/client/CodeEditor.tsx` and its completion helper. Their Neural Lab counterparts are `src/components/CodeEditor.tsx` and `src/components/completions.ts`; copyright notices remain in those files. Highlighting reuses the host's Shiki-backed UI primitives. No separate Learn installation is required by Neural Lab.

StudyMate (d8114f38363272852b339d6788b2f8f007243b43) informed lesson anchors, learning profiles and experiment terminal-state semantics; it is not a runtime dependency. Course prose and exercise code are authored for Neural Lab. Lesson source links identify mathematical references rather than copied question banks.

DeepSeek Harness provides the host, React UI primitives and model access under their upstream licenses. The optional CPU image contains Python, NumPy and PyTorch plus their separately licensed dependencies; see image preparation manifest and upstream distributions for licenses.
