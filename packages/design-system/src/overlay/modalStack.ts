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

// Whether the engine knows :modal, asked once. An engine without it, such
// as jsdom, falls back to aria-modal.
let knowsModal: boolean | undefined;

export function isModal(dialog: Element): boolean {
  knowsModal ??= typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:modal)');
  return knowsModal ? dialog.matches(':modal') : dialog.getAttribute('aria-modal') === 'true';
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
