import { GUEST_LAYER_ATTRIBUTE } from './tabbables.js';

// The node `node` sits in, crossing out of a shadow root to its host.
function containerOf(node: Node): Element | ShadowRoot | null {
  const parent = node.parentNode;
  return parent instanceof Element || parent instanceof ShadowRoot ? parent : null;
}

/** Whether `outer` is or holds `inner`, through shadow roots too. */
export function holds(outer: Element, inner: Element): boolean {
  for (let at: Node | null = inner; at; at = at instanceof ShadowRoot ? at.host : at.parentNode) {
    if (at === outer) return true;
  }
  return false;
}

/**
 * Whether `el` is a `<dialog>` that has to stay usable beside a kept element:
 * one that is closed, which only its own trigger can open, or one open as a
 * modal, which the browser already sets apart from the rest of the page. A
 * dialog moves focus in as it opens, and focus can't land in an inert one, so
 * one the kept element opens, such as a combobox's dialog, has to be usable
 * before it opens. An open dialog that isn't modal is part of the page.
 */
function standsApart(el: Element): boolean {
  if (el.localName !== 'dialog') return false;
  return !el.hasAttribute('open') || isModal(el);
}

/** Whether `at` is in a `<dialog>` open as a modal. */
export function inModal(at: Element): boolean {
  const dialog = at.closest('dialog');
  return dialog !== null && dialog.hasAttribute('open') && isModal(dialog);
}

function isModal(dialog: Element): boolean {
  try {
    if (dialog.matches(':modal')) return true;
  } catch {
    // A browser without :modal falls back to the dialog's own word.
  }
  return dialog.getAttribute('aria-modal') === 'true';
}

/**
 * Makes everything in `keep`'s document inert except the elements `keep`
 * returns, what they hold, the elements around them, guest layers such as
 * Toast.Region's host, popovers, and dialogs that stand apart (see
 * `standsApart`), wherever they sit. It walks from each kept element up to the
 * body, through shadow roots, and marks every sibling on the way that holds
 * nothing kept, so a kept element stays usable while the rest of the page
 * can't be pressed, focused or read. An element added beside the path while it
 * holds, such as a sibling a product renders later, is marked too, unless
 * `keep` returns it, it holds such a dialog or it is a guest layer or a
 * popover by then.
 *
 * A popover stays as it is because its own trigger opens it: one that an inert
 * trigger owns can't open, and one the kept element owns, such as its tooltip
 * or its menu, has to stay usable beside it.
 *
 * Only elements it marked itself are unmarked by the returned call: an
 * `inert` the page set stays.
 */
export function inertOutside(keep: () => readonly Element[]): () => void {
  const first = keep();
  const doc = first[0]?.ownerDocument;
  if (!doc?.body) return () => undefined;
  const kept = () => {
    const own = keep();
    // A dialog that holds a kept element, such as one a coachmark sits in, is
    // on the path, so the rest of it is dimmed like the rest of the page.
    const dialogs = [...doc.querySelectorAll('dialog')].filter((d) => standsApart(d) && !own.some((el) => holds(d, el)));
    return [...own, ...doc.querySelectorAll(`[${GUEST_LAYER_ATTRIBUTE}]`), ...dialogs];
  };
  const marked = new Set<Element>();
  const mark = (el: Element, now: readonly Element[]) => {
    if (el.hasAttribute('inert') || el.hasAttribute('popover') || el.hasAttribute(GUEST_LAYER_ATTRIBUTE)) return;
    // What a kept element holds stays usable, such as the rest of a kept
    // popover that another kept element, like a coachmark inside it, sits in.
    if (now.some((kept) => holds(el, kept) || holds(kept, el))) return;
    el.setAttribute('inert', '');
    marked.add(el);
  };
  // The body, the shadow roots and the elements between it and each kept element.
  const path = new Set<Element | ShadowRoot>();
  const start = kept();
  for (const el of start) {
    if (!el.isConnected) continue;
    for (let at = containerOf(el); at; at = containerOf(at instanceof ShadowRoot ? at.host : at)) {
      if (at === doc.documentElement) break;
      path.add(at);
      if (at === doc.body) break;
    }
  }
  for (const parent of path) for (const child of parent.children) mark(child, start);
  const observer = new MutationObserver((records) => {
    const now = kept();
    for (const record of records) {
      for (const node of record.addedNodes) if (node instanceof Element) mark(node, now);
    }
  });
  for (const parent of path) observer.observe(parent, { childList: true });
  return () => {
    observer.disconnect();
    for (const el of marked) el.removeAttribute('inert');
  };
}
