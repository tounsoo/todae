# 0008. Bundle size is reported, not budgeted

- **Date:** 2026-11-02
- **Status:** Active
- **Source:** Ben, approved 2026-11-02.

## Decision

CI reports the gzip size of each export after tree-shaking, and of each shipped CSS file, against main in the Build job summary. It never fails on size. `scripts/size-check.mjs` builds the report, and `pnpm size:check` prints it. This supersedes [0004](0004-size-budget-tripwire.md), and `packages/design-system/size-budget.json` is gone.

## Why

The summed budget counted the whole library plus the Node-only token CLI, not what an app pays. In its last week it forced four bumps, a merge conflict, and a trimmed component. The per-export report shows the real cost without a number to bump.
