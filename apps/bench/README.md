# todae bench

The on-demand performance benchmark. It renders todae's parts many at a time in Chromium, the way an app's pages use them, and writes what that costs to a JSON record. It runs only when someone asks: it is not part of CI and fails no check. [0011](../../docs/decisions/0011-on-demand-benchmark.md) says why.

## Run it

Locally, from the repo root:

```sh
pnpm --filter bench exec playwright install --with-deps chromium   # once
pnpm bench                       # build the package, run every case, write a record
pnpm bench --against main        # also build main and run it beside this checkout
pnpm bench --cases menu,button   # only cases whose id starts with one of these
pnpm bench --compare 2026-11-06-main-1a2b3c4   # compare the run with a saved record
pnpm bench compare <a> <b>       # compare two saved records, a is before
pnpm bench list                  # list saved records
pnpm bench --help
```

On GitHub, open Actions, pick **Bench**, press **Run workflow** and choose the branch or tag to measure. Its inputs match the flags: `against`, `save`, `name`, `runs` and `cases`. The comparison or a summary lands on the run's page, and the log prints the record.

`--cases bundle` measures only bundle sizes and needs no browser.

## What it measures

Each case renders 10, 100 and 1,000 copies of one part, except the billing case, which renders the docs playground's billing page once. `html-button` is a plain `<button>`, as a floor to read the rest against. Each case is measured over `--runs` runs (5 by default) after one warmup, and every metric keeps its median, middle half and range.

- **Time, in ms:** mount, update (every copy's label changes) and unmount, each with and without a forced layout, and one interaction, such as opening the first Menu, up to its layout. Chromium's own style, layout and script time on mount. These compare only between records from the same machine type.
- **Browser counts:** style recalculations and layouts on mount, and the JS heap after a forced garbage collection. These compare only within the same Chromium major version.
- **Exact counts:** DOM nodes; listeners on `document` and `window`; live Resize, Mutation and Intersection observers; observers created on mount and on update; components React rendered on mount, update and interaction; and listeners and observers left after unmount. These compare against any record.
- **Bundle bytes:** for `import * from '@tounsoo/todae'`, for each common part alone, and for `todae.css`, minified and gzipped, with React left out. Exact counts too.

Some limits on what the numbers mean:

- A time is the time to the forced layout, not to a painted frame.
- Listeners added with `once` are not counted, since they remove themselves.
- Leaked counts are taken after the warmup, so a page-wide singleton that a part creates once and keeps is not called a leak.

## Read a comparison

The table lists only the metrics that changed. A timing or browser count is called faster or slower only when the middle halves of the two runs don't overlap and the change is at least 5%. Anything smaller is noise. `--all` lists every metric. When the two records came from different machine types the table leaves timings out and says so, and when the runs settings differ it warns.

## Records

Every run writes its record to `apps/bench/out/`, which git ignores. `--against` writes one for each side. A record names the todae version, commit and ref, the machine type, the Chromium and Node versions, and the settings.

Records worth keeping go in [`records/`](records), committed. Keep one per release, taken on the GitHub runner so release records also compare on timings:

1. Run the Bench workflow on the release tag, such as `@tounsoo/todae@0.8.0`, with **save** ticked and a name such as `release-0.8.0`.
2. The workflow pushes the record to a `bench-record/<name>` branch off main. Its summary links a pull request for it.
3. Merge that pull request.

`pnpm bench --save` writes a local record to `records/` as well, but a laptop's timings compare only with that laptop's records. Set `BENCH_MACHINE` to give a machine a stable name.

## Compare with an older build

`--against <ref>` checks the ref out in a temporary worktree, installs and builds it there, and runs both builds on the same page, alternating their runs, so a close call compares like with like on one machine. The cases use todae's public API only. A case that uses a part the older build lacks is reported as failed, and the rest still compare.

## Add a case

Add it to `SCENARIOS` in [`app/scenarios.tsx`](app/scenarios.tsx), using only todae's public exports. `tick` changes on update, so put it in each copy's label. `interact` acts on the first copy. `pnpm --filter bench test` renders every case once in jsdom to catch a broken case before a browser run.
