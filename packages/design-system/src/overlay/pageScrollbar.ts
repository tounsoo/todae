const NO_PAGE_SCROLLBAR = 'data-todae-no-page-scrollbar';

let scrollLockGeneration = 0;

export function pageScrollbarIsFlush(innerWidth: number, clientWidth: number): boolean {
  return innerWidth <= clientWidth;
}

function modalIsOpen(doc: Document): boolean {
  return doc.querySelector('dialog:modal') !== null;
}

export function syncPageScrollbar(doc: Document): void {
  scrollLockGeneration += 1;
  // Measuring while a modal is open reports no scrollbar, because the lock
  // has hidden it, and would drop the gutter on a page that had one.
  if (modalIsOpen(doc)) return;
  const view = doc.defaultView;
  if (!view) return;
  const flush = pageScrollbarIsFlush(view.innerWidth, doc.documentElement.clientWidth);
  doc.documentElement.toggleAttribute(NO_PAGE_SCROLLBAR, flush);
}

export function releasePageScrollbar(doc: Document): void {
  if (modalIsOpen(doc)) return;
  doc.documentElement.removeAttribute(NO_PAGE_SCROLLBAR);
}

export function releasePageScrollbarOnUnmount(el: HTMLDialogElement): void {
  const doc = el.ownerDocument;
  const generation = scrollLockGeneration;
  // Still connected in this cleanup. React detaches it just after, and a
  // newer open in the same commit may have measured the page already.
  const finish = () => {
    if (el.isConnected || scrollLockGeneration !== generation) return;
    releasePageScrollbar(doc);
  };
  if (!el.isConnected) finish();
  else queueMicrotask(finish);
}
