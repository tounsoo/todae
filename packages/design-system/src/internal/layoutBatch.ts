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
// microtask; after this many passes the rest waits for the next one.
const MAX_PASSES = 20;

function attempt(run: (() => void) | undefined) {
  if (!run) return;
  // One job that throws doesn't keep the rest from running.
  try {
    run();
  } catch (error) {
    setTimeout(() => {
      throw error;
    });
  }
}

function flush() {
  scheduled = false;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const queue = queues.find((jobs) => jobs.size > 0);
    if (!queue) return;
    const jobs = [...queue.values()];
    queue.clear();
    for (const job of jobs) attempt(job.read);
    for (const job of jobs) attempt(job.write);
  }
  if (queues.some((jobs) => jobs.size > 0)) schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flush);
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
}
