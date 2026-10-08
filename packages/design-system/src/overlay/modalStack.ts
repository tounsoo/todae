/** Modal <dialog> elements Todae opened, oldest first, so the last one is in front. */
const open: HTMLDialogElement[] = [];

export function pushModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index !== -1) open.splice(index, 1);
  open.push(el);
}

export function dropModal(el: HTMLDialogElement): void {
  const index = open.indexOf(el);
  if (index !== -1) open.splice(index, 1);
}

/** The modal Todae opened last that is still open and in the document. */
export function frontModal(): HTMLDialogElement | null {
  for (let i = open.length - 1; i >= 0; i--) {
    const el = open[i]!;
    if (el.isConnected && el.open) return el;
  }
  return null;
}

/** For tests: the elements the stack holds. */
export function heldModals(): readonly HTMLDialogElement[] {
  return open;
}

function isModal(dialog: Element): boolean {
  // aria-modal first: it is cheap, and an engine without :modal, such as
  // jsdom, relies on it.
  if (dialog.getAttribute('aria-modal') === 'true') return true;
  try {
    return dialog.matches(':modal');
  } catch {
    return false;
  }
}

/**
 * The modal <dialog> in front: the one target is in, or, when focus has
 * fallen back to the body, the one Todae opened last. Failing that, any open
 * modal counts, last in document order last.
 */
export function modalsInFront(target: EventTarget | null): Element[] {
  let node = target instanceof Element ? target.closest('dialog[open]') : null;
  while (node && !isModal(node)) node = node.parentElement?.closest('dialog[open]') ?? null;
  if (node) return [node];
  const front = frontModal();
  if (front) return [front];
  return [...document.querySelectorAll('dialog[open]')].filter(isModal);
}

/** The one modal <dialog> in front, judged from where focus is, else null. */
export function frontModalElement(): HTMLElement | null {
  const modals = modalsInFront(document.activeElement);
  return (modals[modals.length - 1] as HTMLElement | undefined) ?? null;
}
