# Third-Party Notices

`dsh-plugin-ai-infra-lab` bundles only its own plugin TypeScript/React code, bilingual curriculum JSON, and container controller scripts.

## Host & Peer Dependencies (Provided by DeepSeek Harness)

- `@deepseek-ai/*` — provided by the user's DeepSeek Harness installation.
- `react`, `react-dom` — MIT License, Copyright (c) Meta Platforms, Inc. and affiliates (provided by host runtime).

## Optional Local Docker CPU Image (`scripts/cpu-image`)

Prepared explicitly on the user's machine via `scripts/prepare-image.ps1` (not redistributed inside the npm tarball):

- Python 3.12 (`python:3.12.10-slim-bookworm`) — PSF License / Debian package licenses
- NumPy (`numpy==2.2.6`) — BSD-3-Clause License
- PyTorch CPU (`torch==2.7.1+cpu`) — BSD-3-Clause License
- Supporting Python wheels (`sympy`, `networkx`, `mpmath`, `Jinja2`, `MarkupSafe`, `fsspec`, `filelock`, `typing_extensions`, `setuptools`) — BSD / MIT Licenses
