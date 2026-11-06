# todae bench

The on-demand performance benchmark. It renders todae's parts many at a time in Chromium, the way an app's pages use them, and writes what that costs to a JSON record. It runs only when someone asks. CI never runs the benchmark itself, though it type-checks the bench and runs its unit tests like any other workspace package. [0011](../../docs/decisions/0011-on-demand-benchmark.md) says why.

## Run it

Locally, from the repo root:

```sh
pnpm --filter bench exec playwright install --with-deps chromium   # once
pnpm bench                       # build the package, run every case, write a record
pnpm bench --against main        # also build main and run it beside this checkout
pnpm bench --cases menu,button/100   # every menu case, and button at 100 copies only
pnpm bench --compare 2026-11-06-main-1a2b3c4   # compare the run with a saved record
pnpm bench compare <a> <b>       # compare two saved records, a is before
pnpm bench list                  # list saved records
pnpm bench --help
```

On GitHub, open Actions, pick **Bench**, press **Run workflow** and choose the branch or tag to measure. Its inputs match the flags: `against`, `save`, `name`, `runs` and `cases`. The comparison or a summary lands on the run's page, and the log prints the record.

An entry in `--cases` without a slash picks every case whose id starts with it. One with a slash picks that case, so `button/100` doesn't also run `button/1000`. `--cases bundle` measures only bundle sizes and needs no browser.

## What it measures

Each case renders 10, 100 and 1,000 copies of one part, except the billing case, which renders the docs playground's billing page once. `html-button` is a plain `<button>`, as a floor to read the rest against. Each case is measured over `--runs` runs (5 by default) after one warmup, and every metric keeps its median, middle half and range.

- **Time, in ms:** mount, update (every copy's label changes) and unmount, each with and without a forced layout, and one interaction, such as opening the first Menu, up to its layout. Chromium's own style, layout and script time on mount. These compare only between records from the same machine type.
- **Browser counts:** style recalculations and layouts on mount, and the JS heap after a forced garbage collection. These compare only within the same Chromium major version.
- **Exact counts:** DOM nodes, text nodes included; listeners on `document` and `window`; live Resize, Mutation and Intersection observers; observers created on mount and on update; components React rendered on mount, update and interaction; and listeners and observers left after unmount. These compare against any record.
- **Bundle bytes:** for `import * from '@tounsoo/todae'` and for each common part alone, minified and gzipped, with React left out, and for `todae.css` as built and gzipped. Exact counts too.

Some limits on what the numbers mean:

- A time is the time to the forced layout, not to a painted frame.
- Listeners added with `once` are not counted, even while they wait, since the probe can't see the browser remove one when it fires.
- Leaked counts are taken after the warmup, so a page-wide singleton that a part creates once and keeps is not called a leak.
- The billing case renders this checkout's docs demo on both sides of `--against`, so it compares todae's builds under today's demo code.
- A case that throws, such as one using a part an older build lacks, is reported as failed with its error, not measured.

## Read a comparison

The table lists only the metrics that changed. A timing is called faster or slower, and a browser count fewer or more, only when every run on one side beats every run on the other and the medians differ by at least 5%. Anything else is noise, and so is any metric with fewer than three runs. Between two runs of the same code, five runs each still split cleanly by chance for about one metric in 125, so a full compare may show one or two such calls; rerun with `--cases` on that case and `--runs 10` before acting on one. `--all` lists every metric. When the two records came from different machine types the table leaves timings out and says so, and when the runs settings differ it warns.

## Records

Every run writes its record to `apps/bench/out/`, which git ignores. `--against` writes one for each side. A record names the todae version, commit and ref, the machine type, the Chromium and Node versions, and the settings.

Records worth keeping go in [`records/`](records), committed. Keep one per release, taken on the GitHub runner:

1. Run the Bench workflow on the release tag, such as `@tounsoo/todae@0.8.0`, with **save** ticked and a name such as `release-0.8.0`.
2. The workflow pushes the record to a `bench-record/<name>` branch off main. Its summary links a pull request for it.
3. Merge that pull request.

The machine type names the runner's image, CPU model and core count. GitHub doesn't always give the same CPU, so two release records compare on timings only when their types match; counts always compare. For a timing call between two releases, `--against` on one run is the sure way.

`pnpm bench --save` writes a local record to `records/` as well, but a laptop's timings compare only with that laptop's records. Set `BENCH_MACHINE` to give a machine a stable name.

## Compare with an older build

`--against <ref>` checks the ref out in a temporary worktree, installs and builds it there, and runs both builds on the same page, alternating their runs, so a close call compares like with like on one machine. The cases use todae's public API only, apart from the billing case's demo code. A case that uses a part the older build lacks is reported as failed, and the rest still compare.

## Add a case

Add it to `SCENARIOS` in [`app/scenarios.tsx`](app/scenarios.tsx), using only todae's public exports. `tick` changes on update, so put it in each copy's label. `interact` acts on the first copy. `pnpm --filter bench test` renders every case once in jsdom to catch a broken case before a browser run.
