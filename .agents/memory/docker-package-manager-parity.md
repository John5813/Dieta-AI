---
name: Docker package-manager parity
description: The package-manager version used in container builds must stay aligned with the workspace lockfile.
---

Use the exact pnpm version recorded by the workspace when running `pnpm install --frozen-lockfile` in Docker.

**Why:** Different pnpm major versions can normalize workspace `overrides` differently and cause `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` even when dependencies have not changed.

**How to apply:** Keep the root `packageManager` field and the Dockerfile's globally installed pnpm version synchronized; regenerate the lockfile only when dependency configuration intentionally changes.