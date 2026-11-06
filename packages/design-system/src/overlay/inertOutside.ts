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

// Dialogs that opened, through `liftDialog`, and haven't closed yet.
const lifted = /* @__PURE__ */ new Set<Element>();
// Those of the page's own, lifted on `beforetoggle` while a call held: they
// are part of the page again once no call holds.
const pageLifted = /* @__PURE__ */ new Set<Element>();
// What each inertOutside call that holds does to unmark its elements, then mark again.
const holding = /* @__PURE__ */ new Set<{ unmark: () => void; walk: () => void }>();

function rewalk(): void {
  // Every call unmarks first, so none skips an element another one marked.
  for (const call of holding) call.unmark();
  for (const call of holding) call.walk();
}

function onLiftedClose(event: Event): void {
  const dialog = event.currentTarget as Element;
  // A browser sends close a task later, so the dialog may be open again by
  // then, as when its owner shows it again: it stays lifted until it closes.
  if (dialog.hasAttribute('open')) {
    dialog.addEventListener('close', onLiftedClose, { once: true });
    return;
  }
  lifted.delete(dialog);
  pageLifted.delete(dialog);
  rewalk();
}

/**
 * Lifts `dialog` out of what an `inertOutside` call holds inert, until it
 * closes. Call it right before the dialog opens: a dialog moves focus in as
 * it opens, and focus can't land in an inert element, so one a coachmark's
 * target opens, such as a combobox's dialog, has to be usable by then,
 * wherever it sits. Todae's modal surfaces call it themselves, and a dialog
 * of the page's own that a browser reports with `beforetoggle` is lifted too,
 * while a call holds.
 */
export function liftDialog(dialog: Element): void {
  if (lifted.has(dialog)) return;
  lifted.add(dialog);
  dialog.addEventListener('close', onLiftedClose, { once: true });
  rewalk();
}

function isLifted(dialog: Element): boolean {
  return lifted.has(dialog) && dialog.isConnected;
}

/**
 * The innermost dialog `event` happened in, through shadow roots too, that
 * opened as `liftDialog` says and so stands apart from the dim page, such as
 * the one holding a dialog of its own that never opened through it.
 */
export function liftedDialogOf(event: Event): Element | null {
  for (const at of event.composedPath()) {
    if (at instanceof Element && at.localName === 'dialog' && isLifted(at)) return at;
  }
  return null;
}

/**
 * Makes everything in `keep`'s document inert except the elements `keep`
 * returns, what they hold, the elements around them, guest layers such as
 * Toast.Region's host, popovers, and dialogs that opened (see `liftDialog`).
 * It walks from each kept element up to the body, through shadow roots, and
 * marks every sibling on the way that holds nothing kept, so a kept element stays usable while the rest of the page can't be
 * pressed, focused or read. An element added beside the path while it holds,
 * such as a sibling a product renders later, is marked too, unless `keep`
 * returns it or it is a guest layer or a popover by then; one that brings a
 * kept element with it has only what sits beside that element marked.
 *
 * A popover stays as it is because its own trigger opens it: one that an inert
 * trigger owns can't open, and one the kept element owns, such as its tooltip
 * or its menu, has to stay usable beside it. A closed dialog is part of the
 * page until it opens, and an open one that isn't modal stays part of it.
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
    // One removed while open sends no close, so it goes once it is gone.
    for (const el of lifted) if (!el.isConnected) lifted.delete(el);
    const dialogs = new Set<Element>([...lifted].filter((el) => el.ownerDocument === doc));
    // A dialog that holds a kept element, such as one a coachmark sits in, is
    // on the path, so the rest of it is dimmed like the rest of the page.
    for (const el of dialogs) if (own.some((inner) => holds(el, inner))) dialogs.delete(el);
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
  // The body, the shadow roots and the elements between it and each kept
  // element. Each step on the path is watched, and what sits beside it is
  // marked.
  const path = new Set<Element | ShadowRoot>();
  const observer = new MutationObserver((records) => {
    const now = kept();
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        // One that brings a kept element with it, such as a wrapper around a
        // guest layer, joins the path, so only what sits beside that is marked.
        const inside = now.filter((el) => el !== node && holds(node, el));
        if (inside.length > 0) extend(inside, now);
        else mark(node, now);
      }
    }
  });
  const extend = (from: readonly Element[], now: readonly Element[]) => {
    const added: (Element | ShadowRoot)[] = [];
    for (const el of from) {
      if (!el.isConnected) continue;
      for (let at = containerOf(el); at; at = containerOf(at instanceof ShadowRoot ? at.host : at)) {
        if (at === doc.documentElement || path.has(at)) break;
        path.add(at);
        added.push(at);
        if (at === doc.body) break;
      }
    }
    for (const parent of added) {
      for (const child of parent.children) mark(child, now);
      observer.observe(parent, { childList: true });
    }
  };
  const call = {
    unmark() {
      observer.disconnect();
      path.clear();
      for (const el of marked) el.removeAttribute('inert');
      marked.clear();
    },
    walk() {
      const now = kept();
      extend(now, now);
    },
  };
  // A dialog of the page's own that opens, as a browser reports it before it
  // moves focus in.
  const onBeforeToggle = (event: Event) => {
    const el = event.target;
    if (!(el instanceof Element) || el.localName !== 'dialog' || (event as Event & { newState?: string }).newState !== 'open') return;
    if (!lifted.has(el)) pageLifted.add(el);
    liftDialog(el);
  };
  holding.add(call);
  call.walk();
  doc.addEventListener('beforetoggle', onBeforeToggle, true);
  return () => {
    doc.removeEventListener('beforetoggle', onBeforeToggle, true);
    holding.delete(call);
    call.unmark();
    // What this call marked, others skipped as inert already: they mark it now.
    if (holding.size > 0) rewalk();
    // After the task's own work, as a call can end only to start again, as
    // a coachmark's does when its target names something new.
    queueMicrotask(() => {
      if (holding.size > 0) return;
      for (const el of pageLifted) {
        lifted.delete(el);
        el.removeEventListener('close', onLiftedClose);
      }
      pageLifted.clear();
    });
  };
}
