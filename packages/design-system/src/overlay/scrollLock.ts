const GUTTER = '--_todae-scroll-lock-gutter';

const open = new Set<HTMLDialogElement>();
let restore: { inline: string } | undefined;

function gap(doc: Document): number {
  const view = doc.defaultView;
  if (!view) return 0;
  return Math.max(0, view.innerWidth - doc.documentElement.clientWidth);
}

function arm(doc: Document): void {
  const root = doc.documentElement;
  restore = { inline: root.style.getPropertyValue(GUTTER) };
  // stable reserves a gutter even when the bar took no space, which narrows a short page.
  root.style.setProperty(GUTTER, gap(doc) > 0 ? 'stable' : 'auto');
}

function disarm(doc: Document): void {
  if (restore === undefined) return;
  const root = doc.documentElement;
  if (restore.inline) root.style.setProperty(GUTTER, restore.inline);
  else root.style.removeProperty(GUTTER);
  restore = undefined;
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

export function installScrollLock(): void {
  if (typeof HTMLDialogElement === 'undefined') return;
  const proto = HTMLDialogElement.prototype;
  // Inside the function: a top-level Symbol.for stays in every import from the entry.
  const patched = Symbol.for('todae.scrollLock');
  if (patched in proto.showModal) return;

  const showModal = proto.showModal;
  const close = proto.close;

  function patchedShow(this: HTMLDialogElement): void {
    if (live() === 0) disarm(this.ownerDocument);
    const first = open.size === 0;
    if (first) arm(this.ownerDocument);
    const tracked = open.has(this);
    open.add(this);
    try {
      showModal.call(this);
    } catch (error) {
      if (!tracked) open.delete(this);
      if (first) disarm(this.ownerDocument);
      throw error;
    }
  }

  function patchedClose(this: HTMLDialogElement, returnValue?: string): void {
    close.call(this, returnValue);
    noteClosed(this);
  }

  Object.defineProperty(patchedShow, patched, { value: true });
  proto.showModal = patchedShow;
  proto.close = patchedClose;
  document.addEventListener(
    'close',
    (event) => {
      if (event.target instanceof HTMLDialogElement) noteClosed(event.target);
    },
    true,
  );
}
