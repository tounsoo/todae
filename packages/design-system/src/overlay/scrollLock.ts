const GUTTER = '--_todae-scroll-lock-gutter';

const open = new Set<HTMLDialogElement>();
// The inline value to put back, or unset while nothing is locked.
let saved: string | undefined;

function gap(doc: Document): number {
  const view = doc.defaultView;
  if (!view) return 0;
  return Math.max(0, view.innerWidth - doc.documentElement.clientWidth);
}

function arm(doc: Document): void {
  const root = doc.documentElement;
  saved = root.style.getPropertyValue(GUTTER);
  // stable reserves a gutter even when the bar took no space, which narrows a short page.
  root.style.setProperty(GUTTER, gap(doc) > 0 ? 'stable' : 'auto');
}

function disarm(doc: Document): void {
  if (saved === undefined) return;
  const root = doc.documentElement;
  if (saved) root.style.setProperty(GUTTER, saved);
  else root.style.removeProperty(GUTTER);
  saved = undefined;
}

function live(): number {
  for (const dialog of open) {
    if (!dialog.isConnected || !dialog.open) open.delete(dialog);
  }
  return open.size;
}

function noteClosed(dialog: HTMLDialogElement): void {
  open.delete(dialog);
  if (live() === 0) disarm(dialog.ownerDocument);
}

/**
 * Reserves the scrollbar gutter only when the page had one at the moment a
 * modal opened. The CSS lock applies to every modal dialog, so this wraps
 * showModal and close rather than one component.
 */
export function installScrollLock(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  const proto = HTMLDialogElement.prototype;
  // Inside the function: a top-level Symbol.for stays in every import from the entry.
  const patched = Symbol.for('todae.scrollLock');
  if (patched in proto.showModal) return;

  const showModal = proto.showModal;
  const close = proto.close;

  function patchedShow(this: HTMLDialogElement): void {
    // A dialog removed without close() must not keep the next page locked.
    if (live() === 0) disarm(this.ownerDocument);
    const first = open.size === 0;
    if (first) arm(this.ownerDocument);
    try {
      showModal.call(this);
    } catch (error) {
      if (first) disarm(this.ownerDocument);
      throw error;
    }
    open.add(this);
  }

  function patchedClose(this: HTMLDialogElement, returnValue?: string): void {
    close.call(this, returnValue);
    noteClosed(this);
  }

  Object.defineProperty(patchedShow, patched, { value: true });
  proto.showModal = patchedShow;
  proto.close = patchedClose;
  // close() does not bubble. Capture still hears a dialog the browser closes
  // itself, including one removed while it is open.
  document.addEventListener(
    'close',
    (event) => {
      if (event.target instanceof HTMLDialogElement) noteClosed(event.target);
    },
    true,
  );
}
