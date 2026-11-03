# 0010. A compiler script, not API Extractor, gates the TypeScript API

- **Date:** 2026-11-03
- **Status:** Active
- **Source:** The 1.0 gap audit of 2026-11-03, item 1, which Ben put first among the 0.x work toward 1.0.

## Decision

`packages/design-system/scripts/check-typescript-api.ts` reads the package's TypeScript source with the compiler API and writes `typescript-api.json`, one path per export, member and compound part. CI fails when that file drifts, and when the branch removes or changes a path without an added changeset that names the export. Anything but a rename also needs the breaking bump, `minor` until 1.0.0 and `major` after, since the script compares printed types and can't tell a type callers pass in from one they read back. Before 1.0.0, when `major` makes that costly, a check that compiles both versions and asks the checker whether the new type is assignable to the old one could let real widenings through as a patch. [ARCHITECTURE.md](../../ARCHITECTURE.md#releases) records the rules.

## Why

API Extractor reports one entry point per config, and the package has 27 typed entry points. It works from the built `.d.ts` files, so the check would wait for a build, and it bundles its own TypeScript, which can lag the TypeScript 6 the package needs. Its report is one text block per declaration, so CI could only say that something changed, not which export, and so could not match a removal to a changeset. The script runs on the source in about four seconds, needs no build, and gives each path its own line, so the job can name the export a changeset has to mention. Props inherited from React's DOM types are recorded as what an `Omit` leaves out, so a new `@types/react` release doesn't change the file.
