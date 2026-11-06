// Layout work that many parts on one page queue in the same commit, or in the
// same observer callback, runs together in one microtask: every read of a
// stage first, then every write. A read after a write forces the browser to
// lay the page out again, so a page of 1,000 tab lists that each measured and
// wrote in its own layout effect laid the page out twice per list. Batched,
// the reads of a stage share one layout, however many parts queued them.
//
// The microtask runs after React's commit and before the browser paints, so
// what a stage writes is on the first frame, as it would be from a layout
// effect, and an overlay that shows its popover in its own layout effect is
// shown by the time its parts read it.

/**
 * The stages, in the order they run. A later stage reads what every earlier
 * one wrote: the scroll arrows' sizes, then which arrows show, then a tab
 * list's scroll to its selected tab, which goes by the arrows shown.
 */
export const STAGE = { measure: 0, show: 1, reveal: 2 } as const;
type Stage = (typeof STAGE)[keyof typeof STAGE];

export type LayoutJob = {
  /** Reads layout. It shouldn't write anything that changes layout. */
  read?: () => void;
  /** Writes what the read found. */
  write?: () => void;
};

const queues: Map<object, LayoutJob>[] = [new Map(), new Map(), new Map()];
let scheduled = false;
// A job that queues itself again from its own write would run forever in one
// microtask; after this many passes the rest waits for a task of its own, so
// the page gets a turn first.
const MAX_PASSES = 20;

// Runs `run`, and says whether it finished. One job that throws doesn't keep
// the rest from running; its error is thrown after.
function attempt(run: (() => void) | undefined): boolean {
  if (!run) return true;
  try {
    run();
    return true;
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
    return false;
  }
}

// The jobs of the pass under way, so a part cancelled during it, as by a
// write that unmounts it, writes nothing.
let running: Map<object, LayoutJob> | null = null;

// Jobs queued while the batch runs join it, so `scheduled` stays set until
// it ends.
function flush() {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const queue = queues.find((jobs) => jobs.size > 0);
    if (!queue) break;
    const jobs = new Map(queue);
    queue.clear();
    running = jobs;
    const failed = new Set<object>();
    for (const [key, job] of jobs) if (jobs.has(key) && !attempt(job.read)) failed.add(key);
    // A write goes by its own read, so one whose read threw is skipped.
    for (const [key, job] of jobs) if (jobs.has(key) && !failed.has(key)) attempt(job.write);
    running = null;
  }
  scheduled = false;
  if (queues.some((jobs) => jobs.size > 0)) schedule(true);
}

function schedule(yieldFirst = false) {
  if (scheduled) return;
  scheduled = true;
  if (yieldFirst) setTimeout(flush);
  else queueMicrotask(flush);
}

/**
 * Queues `job` at `stage` under `key`. A key queued again before the batch
 * runs keeps its place and takes the newer job, so a part that several
 * observers report in one callback measures once.
 */
export function queueLayout(key: object, stage: Stage, job: LayoutJob) {
  queues[stage]!.set(key, job);
  schedule();
}

/** Drops whatever `key` has queued, as a part does when it stops. */
export function cancelLayout(key: object) {
  for (const jobs of queues) jobs.delete(key);
  running?.delete(key);
}
