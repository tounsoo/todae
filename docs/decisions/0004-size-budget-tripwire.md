# 0004. The bundle size budget is a tripwire

- **Date:** 2026-11-01
- **Status:** Active
- **Source:** Ben, approved 2026-11-01.

## Decision

The bundle size budget is a tripwire, not a hard cap. A pull request may raise the budget when its body states the reason and the new number. An increase with no stated reason fails review. The numbers are in `packages/design-system/size-budget.json`. `scripts/size-check.mjs` reads that file and exits with code 1 when a measured gzip size is over its limit.

## Why

Reason not recorded.
