const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve))));

/**
 * Waits until the page is still: effects, measurement and anchored layout
 * have run, and no finite animation or transition is running, so an overlay
 * is checked open, not partway through its entry. Overlays mark
 * `data-entered` a couple of frames after they show and only then start
 * their entry motion, so one look can find nothing running yet; the page
 * counts as still after three looks in a row, two frames apart, that find no
 * motion, no open dialog without `data-entered` and no `data-todae-entering`.
 * Loaders and other endless animations are left running. Gives up after
 * three seconds, so a test that never settles fails on its own check.
 */
export async function settle(): Promise<void> {
  const deadline = performance.now() + 3000;
  for (let still = 0; still < 3 && performance.now() < deadline; ) {
    await frames();
    const running = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity));
    const entering = document.querySelector('dialog[open]:not([data-entered]), [data-todae-entering]') !== null;
    if (running.length === 0 && !entering) {
      still += 1;
      continue;
    }
    still = 0;
    await Promise.race([Promise.allSettled(running.map((animation) => animation.finished)), new Promise((resolve) => setTimeout(resolve, 500))]);
  }
}
