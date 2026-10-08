/** Modal <dialog> elements in Todae's stack, in the order they were shown, so the last one is in front. */
const open: HTMLDialogElement[] = [];
const listeners = new Set<(reshown: boolean) => void>();
// When each element was last shown, as a running count.
const shownAt = new WeakMap<HTMLDialogElement, number>();
let shows = 0;
// One observer for every element, as its records come in the order the
// changes happened, also across elements. Elements stay observed, so their
// shows keep being counted.
let observer: MutationObserver | undefined;
const watchers = new Map<HTMLDialogElement, Set<(shown: boolean) => void>>();

function notify(reshown = false): void {
  for (const listener of [...listeners]) listener(reshown);
}

function byShown(a: HTMLDialogElement, b: HTMLDialogElement): number {
  return (shownAt.get(a) ?? 0) - (shownAt.get(b) ?? 0);
}

function deliver(records: MutationRecord[]): void {
  const touched = new Map<HTMLDialogElement, boolean>();
  for (const record of records) {
    const el = record.target as HTMLDialogElement;
    // The open attribute was added: shown, counted in the order it happened.
    const added = record.oldValue === null;
    if (added) shownAt.set(el, ++shows);
    touched.set(el, Boolean(touched.get(el)) || added);
  }
  for (const [el, added] of touched) for (const watcher of [...(watchers.get(el) ?? [])]) watcher(added && el.open);
}

/**
 * Calls `watcher` after `el` opens or closes, with whether it was shown,
 * which showModal() and show() do. Returns a function that stops.
 */
export function watchOpen(el: HTMLDialogElement, watcher: (shown: boolean) => void): () => void {
  observer ??= new MutationObserver(deliver);
  observer.observe(el, { attributes: true, attributeFilter: ['open'], attributeOldValue: true });
  const own = watchers.get(el) ?? new Set();
  own.add(watcher);
  watchers.set(el, own);
  return () => {
    own.delete(watcher);
    if (!own.size && watchers.get(el) === own) watchers.delete(el);
  };
}

/** Handles opens and closes not handled yet, so the stack has every show before it reads their order. */
export function flushOpens(): void {
  if (observer) deliver(observer.takeRecords());
}

/**
 * Holds `el` in the order the elements were last shown, so the one shown
 * last is in front, and one that joins late goes behind those shown after
 * it. `reshown` says it was shown again: it moves to where that show puts
 * it, and notifies even when it already was there, as showModal() again
 * puts it last in the top layer. Without it, a held element stays where it
 * is. One with no show counted counts as shown now.
 */
export function pushModal(el: HTMLDialogElement, reshown = false): void {
  const index = open.indexOf(el);
  if (index !== -1 && !reshown) return;
  if (index !== -1) open.splice(index, 1);
  if (!shownAt.has(el)) shownAt.set(el, ++shows);
  open.push(el);
  open.sort(byShown);
  notify(reshown);
}

export function dropModal(el: HTMLDialogElement): void {
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

let modalPseudo: boolean | undefined;

/** Whether `dialog` is shown as a modal: with showModal(), not show(). */
export function isModal(dialog: Element): boolean {
  // An engine without :modal, such as jsdom, falls back to aria-modal. Asked
  // once, not tried: jsdom takes :modal, then recurses until its call stack
  // overflows, which takes most of a second each time.
  modalPseudo ??= typeof CSS !== 'undefined' && CSS.supports?.('selector(:modal)') === true;
  if (modalPseudo && dialog.matches(':modal')) return true;
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

/** The elements the stack holds, the one in front last. */
export function heldModals(): readonly HTMLDialogElement[] {
  return open;
}
