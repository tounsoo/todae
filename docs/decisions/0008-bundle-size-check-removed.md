# 0008. The bundle size check is removed

- **Date:** 2026-11-02
- **Status:** Active
- **Source:** Ben, approved 2026-11-02.

## Decision

Todae has no bundle size check. CI neither fails on size nor reports it. This supersedes [0004](0004-size-budget-tripwire.md), and `scripts/size-check.mjs` and `packages/design-system/size-budget.json` are gone.

## Why

The budget summed the gzip size of every published file, including the Node-only token CLI, so it did not show what an app pays. In its last week it forced four bumps, a merge conflict, and a trimmed component. Todae is in 0.x, so Ben chose to remove the check rather than replace it with a size report.
