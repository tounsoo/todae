/** Modal <dialog> elements in Todae's stack, in the order they were shown, so the last one is in front. */
const open: HTMLDialogElement[] = [];
const listeners = new Set<(reshown: boolean) => void>();
// When each element was last shown, as a running count.
const shownAt = new WeakMap<HTMLDialogElement, number>();
let shows = 0;

function notify(reshown = false): void {
  for (const listener of [...listeners]) listener(reshown);
}

function stamp(el: HTMLDialogElement): void {
  shownAt.set(el, ++shows);
}

/**
 * Notes that `el` was shown just now, for when it joins later. A held
 * element moves only through pushModal().
 */
export function noteShown(el: HTMLDialogElement): void {
  if (!open.includes(el)) stamp(el);
}

/**
 * Holds `el` in the order the elements were shown. `reshown` says it was
 * shown just now, which puts it in front, and notifies even when it already
 * was there: showModal() again puts it last in the top layer. Otherwise a
 * held element keeps its place, and one that joins late goes behind those
 * shown after it. A show not noted counts as now.
 */
export function pushModal(el: HTMLDialogElement, reshown = false): void {
  const index = open.indexOf(el);
  if (index !== -1 && !reshown) return;
  if (index !== -1) open.splice(index, 1);
  if (reshown || !shownAt.has(el)) stamp(el);
  const at = shownAt.get(el)!;
  let to = open.length;
  while (to > 0 && shownAt.get(open[to - 1]!)! > at) to--;
  open.splice(to, 0, el);
  notify(reshown);
}

export function dropModal(el: HTMLDialogElement): void {
  shownAt.delete(el);
  const index = open.indexOf(el);
  if (index === -1) return;
  open.splice(index, 1);
  notify();
}

/**
 * Calls `listener` whenever the stack changes or an element in it is shown
 * again, with `reshown` true for the latter.
 */
export function subscribeModals(listener: (reshown: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether `dialog` is shown as a modal: with showModal(), not show(). */
export function isModal(dialog: Element): boolean {
  try {
    if (dialog.matches(':modal')) return true;
  } catch {
    // An engine without :modal, such as jsdom, falls back to aria-modal.
  }
  return dialog.getAttribute('aria-modal') === 'true';
}

/**
 * The modal in the stack that is in front and still open and in the document,
 * skipping any that `skip` returns true for.
 */
export function frontModal(skip?: (el: HTMLDialogElement) => boolean): HTMLDialogElement | null {
  for (let i = open.length - 1; i >= 0; i--) {
    const el = open[i]!;
    if (el.isConnected && el.open && !skip?.(el)) return el;
  }
  return null;
}

/** For tests: the elements the stack holds. */
export function heldModals(): readonly HTMLDialogElement[] {
  return open;
}
