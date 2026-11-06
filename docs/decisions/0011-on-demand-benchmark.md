# 0011. Performance is measured by an on-demand benchmark

- **Date:** 2026-11-06
- **Status:** Active
- **Source:** Ben, 2026-11-06: "I dont need something to run on every PR. Need something that I can run when I want to test for performance so I can make calls" and "We should save the benchmark so we can compare with older record".

## Decision

`apps/bench` measures todae in Chromium when someone asks: `pnpm bench` locally, or the manual Bench workflow in GitHub Actions. The benchmark never runs on a push, a pull request or a schedule, and no check depends on its numbers. CI only type-checks it and runs its unit tests. Each run writes a JSON record, and the records worth keeping, one per release from the GitHub runner, are committed in `apps/bench/records`. Exact counts (DOM nodes, listeners, observers, components rendered, bundle bytes) compare against any record. Timings compare only between records from the same machine type, and browser engine counts only within the same browser major version. `--against <ref>` builds an older ref beside the current code for a close call.

## Why

A design system's parts are used many at a time on one page, so their cost adds up, and Ben wants numbers to decide with rather than a gate. [0008](0008-bundle-size-check-removed.md) removed the size check because a CI budget forced bumps and trims without showing what an app pays. The benchmark reports per-import bundle bytes and runtime costs instead, and leaves the call to a person. Records live in the repo so they outlast GitHub's artifact retention and sit beside the code they measure.
