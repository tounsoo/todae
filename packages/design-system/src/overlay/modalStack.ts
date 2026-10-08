/** Modal <dialog> elements in Todae's stack, oldest first, so the last one is in front. */
const open: HTMLDialogElement[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Puts `el` in front, or moves it there if it is already held. Notifies even
 * when it already was: showModal() again puts it last in the top layer.
 */
export function pushModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index !== -1) open.splice(index, 1);
  open.push(el);
  notify();
}

export function dropModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index === -1) return;
  open.splice(index, 1);
  notify();
}

/** Calls `listener` whenever an element joins or leaves the stack. */
export function subscribeModals(listener: () => void): () => void {
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
