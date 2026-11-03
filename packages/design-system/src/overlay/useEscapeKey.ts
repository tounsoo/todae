import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { focusPath, isElement, topDocument } from '../internal/dom.js';
import { isImeKeyEvent } from '../internal/ime.js';
import { frontModal, isModal } from './modalStack.js';

type Entry = {
  handle: () => void;
  takes: (target: Element | null) => boolean;
  passesKey: (event: KeyboardEvent) => boolean;
  /** Null while the layer's element isn't mounted, so every caller checks it. */
  element: () => Element | null;
  /** The document the layer lives in: its element's, or the one it was activated in while unmounted. */
  doc: () => Document;
  popup: boolean;
  closeRequests: boolean;
};

/** A layer's passesKey: a key a popup or field inside already took, or one that ends an IME composition. */
export function handledOrComposing(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isImeKeyEvent(event);
}

const stack: Entry[] = [];
const watchers = /* @__PURE__ */ new Set<() => void>();
// The documents that have the keydown listener. Key events don't cross
// documents, so a layer in an iframe or a popup window needs its own.
const listening = /* @__PURE__ */ new Set<Document>();

/** The page's document and the same-origin frames focus sits in, through shadow roots too. */
function focusedDocuments(): Set<Document> {
  return new Set([document, ...focusPath(document).map((el) => el.ownerDocument)]);
}

// A key comes only from the document with focus, so check again once focus
// has moved to another one: an element can reach an iframe after its layer
// activates with nothing rendering again.
function onWindowBlur(): void {
  setTimeout(sync);
}

/**
 * Listens on each layer's document and, while any layer is up, on the page's
 * document and the frames focus is in, as a layer's element may get there
 * after it activates.
 */
function sync(): void {
  const wanted = new Set(stack.map((entry) => entry.doc()));
  if (wanted.size > 0) for (const doc of focusedDocuments()) wanted.add(doc);
  for (const doc of wanted) {
    if (listening.has(doc)) continue;
    doc.addEventListener('keydown', onKeyDown);
    doc.defaultView?.addEventListener('blur', onWindowBlur);
    listening.add(doc);
  }
  for (const doc of [...listening]) {
    if (wanted.has(doc)) continue;
    doc.removeEventListener('keydown', onKeyDown);
    doc.defaultView?.removeEventListener('blur', onWindowBlur);
    listening.delete(doc);
  }
}

/**
 * The layer that answers first: the one registered last, or, when other
 * layers sit inside it in the DOM, the innermost of them. Registration order
 * alone fails when an inner layer registers first, as nested ones do when
 * they mount together.
 */
function innermost(layers: readonly Entry[]): Entry | undefined {
  let top = layers.at(-1);
  while (top !== undefined) {
    const outer = top.element();
    if (!outer) return top;
    let inner: Entry | undefined;
    for (let i = layers.length - 1; i >= 0 && inner === undefined; i--) {
      const el = layers[i]!.element();
      if (el && el !== outer && within(outer, el)) inner = layers[i];
    }
    if (inner === undefined) return top;
    top = inner;
  }
  return undefined;
}

function contains(outer: Entry, inner: Entry): boolean {
  const scope = outer.element();
  const el = inner.element();
  return Boolean(scope && el && within(scope, el));
}

/**
 * The one selection for Escape and close requests, over the enabled layers:
 * the innermost, where a layer that isn't a popup, such as a Drilldown going
 * back, yields to every popup whose element doesn't contain it, so a menu or
 * tooltip the person sees beside it closes first.
 */
function select(enabled: readonly Entry[]): Entry | undefined {
  const popups = enabled.filter((entry) => entry.popup && entry.element());
  return innermost(enabled.filter((entry) => entry.popup || popups.every((popup) => contains(popup, entry))));
}

/**
 * The modal <dialog> in front: the one the key was pressed in, or, when focus
 * has fallen back to the body, the one Todae opened last. Failing that, any
 * open modal counts.
 */
function modalsInFront(doc: Document, target: EventTarget | null): Element[] {
  let node = isElement(target) ? target.closest('dialog[open]') : null;
  while (node && !isModal(node)) node = node.parentElement?.closest('dialog[open]') ?? null;
  if (node) return [node];
  const front = frontModal((modal) => modal.ownerDocument !== doc);
  if (front) return [front];
  return [...doc.querySelectorAll('dialog[open]')].filter(isModal);
}

/** Whether `node` is inside `scope`, also through the frames around it. */
function within(scope: Element, node: Element): boolean {
  for (let el: Element | null | undefined = node; el; el = el.ownerDocument.defaultView?.frameElement) {
    if (scope.contains(el)) return true;
  }
  return false;
}

/**
 * Whether a modal dialog keeps `entry` behind it in one of the documents
 * between its own and `doc`: its own, then each one holding the frame it is
 * in. A modal in `doc` itself is the caller's to check.
 */
function behindFrameModal(entry: Entry, doc: Document): boolean {
  for (
    let el: Element | null | undefined = entry.element();
    el && el.ownerDocument !== doc;
    el = el.ownerDocument.defaultView?.frameElement
  ) {
    const modals = modalsInFront(el.ownerDocument, null);
    const node = el;
    if (modals.length > 0 && !modals.some((modal) => modal.contains(node))) return true;
  }
  return false;
}

/**
 * Whether `entry`'s element is inside `scope`, also through the frames around
 * it, and no modal dialog in a frame between keeps it behind.
 */
function inside(scope: Element, entry: Entry): boolean {
  const el = entry.element();
  return Boolean(el && within(scope, el) && !behindFrameModal(entry, scope.ownerDocument));
}

/**
 * The layers that take a request with focus on `target`, inside one of
 * `scope` or anywhere when it is null: for the Escape key `event`, those that
 * don't pass it on, and without one, a modal's close request, those that take
 * close requests. A disabled layer keeps its place in the stack but is left
 * out, so the request falls through to the next one.
 */
function candidates(
  scope: readonly Element[] | null,
  target: Element | null | ((entry: Entry) => Element | null),
  event?: KeyboardEvent,
  doc?: Document,
): Entry[] {
  return stack.filter(
    (entry) =>
      (doc === undefined || entry.doc() === doc) &&
      (scope === null || scope.some((el) => inside(el, entry))) &&
      (event ? !entry.passesKey(event) : entry.closeRequests) &&
      entry.takes(typeof target === 'function' ? target(entry) : target),
  );
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // The document the listener was added to. A key in a frame or popup goes only to its layers.
  const doc = event.currentTarget as Document;
  // A layer outside the modal dialog the key was pressed in sits behind it
  // and is inert. Escape belongs to the dialog's own close request.
  const modals = modalsInFront(doc, event.target);
  const target = isElement(event.target) ? event.target : null;
  const scope = modals.length > 0 ? modals : null;
  // A key on the page also reaches the layers of other documents, such as a
  // tooltip portaled into an iframe while its trigger keeps focus here, in one
  // selection with the page's, so the innermost or the popup goes first. A
  // modal in that document keeps the layers behind it.
  // A popup window isn't beside the page, so its layers only take a key no
  // layer here or in the page's frames takes.
  let top: Entry | undefined;
  if (doc === document) {
    const reached = candidates(scope, target, event).filter((entry) => !behindFrameModal(entry, document));
    // The page may itself be in a frame, such as a docs sandbox.
    const page = topDocument(document);
    const here = (entry: Entry) => topDocument(entry.doc()) === page;
    top = select(reached.filter(here)) ?? select(reached.filter((entry) => !here(entry)));
  } else {
    top = select(candidates(scope, target, event, doc));
  }
  if (!top) return;
  event.preventDefault();
  top.handle();
}

/**
 * Gives a close request of the modal `dialog`, such as the Android back
 * gesture, to the layer inside it that Escape pressed where focus is would
 * reach, and returns whether one took it. It is the whole dialog's, so a layer
 * in a frame there that takes any key, such as an open popover, takes it
 * wherever focus is in the dialog, as one on the page would.
 */
export function takeCloseRequest(dialog: Element): boolean {
  // Where focus is, read as each layer's document reads it, as a key there
  // would be: a shadow root's focus as its host, a frame's as the frame. A
  // document focus isn't in gets where it is, not its own stale activeElement.
  const focused = focusPath(dialog.ownerDocument).filter((el) => el.getRootNode().nodeType === 9);
  const fallback = focused.at(-1) ?? dialog.ownerDocument.activeElement;
  const top = select(
    candidates([dialog], (entry) => focused.filter((el) => el.ownerDocument === entry.doc()).at(-1) ?? fallback),
  );
  top?.handle();
  return top !== undefined;
}

/**
 * A ref for a layer's element that follows it into the document it attaches
 * in, as when another component portals it into an iframe after the layer
 * activates, with nothing rendering the layer's owner again.
 */
export function followLayerElement(element: Element | null): void {
  if (element) sync();
}

function subscribe(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

/**
 * Whether a layer that takes close requests sits inside `element`, kept
 * current as layers come and go. Registration only: whether a layer takes a
 * request is read when one comes.
 */
export function useLayerInside(element: Element | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => element !== null && stack.some((entry) => entry.closeRequests && inside(element, entry)),
    () => false,
  );
}

function push(entry: Entry): () => void {
  stack.push(entry);
  sync();
  for (const watcher of [...watchers]) watcher();
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
    sync();
    for (const watcher of [...watchers]) watcher();
  };
}

/**
 * Calls `handler` on Escape, and on a close request of a modal `<dialog>` it
 * sits in, while `active && enabled`. Overlays stack: only one layer handles
 * it, so Escape in a popover inside a sheet closes the popover first. The
 * most recently activated layer goes first, unless another layer's element is
 * inside its own: then the innermost does. `enabled` may be a function of the
 * element with focus, the key's target or, for a close request, the
 * document's active element, so both reach the same layer. `passesKey` lets a
 * layer pass on what only a key carries, such as a key a field inside already
 * handled or one that ends an IME composition. `elementRef` places the
 * layer: a layer left behind a modal `<dialog>` opened later skips the key,
 * and the dialog gets it. A layer with `popup: false` yields to every open
 * popup whose element doesn't contain its own. A layer with
 * `closeRequests: false`, such as a tooltip, answers the Escape key only, and
 * a modal's close requests pass it by.
 */
export function useEscapeKey(
  active: boolean,
  enabled: boolean | ((target: Element | null) => boolean),
  handler: () => void,
  elementRef: RefObject<Element | null>,
  {
    popup = true,
    closeRequests = true,
    passesKey,
  }: { popup?: boolean; closeRequests?: boolean; passesKey?: (event: KeyboardEvent) => boolean } = {},
): void {
  const latest = useRef({ handler, enabled, passesKey });
  latest.current = { handler, enabled, passesKey };
  // Keyed on `active` only: toggling `enabled` must not move the layer above overlays opened later.
  useEffect(() => {
    if (!active) return;
    const pushedIn = elementRef.current?.ownerDocument ?? document;
    return push({
      handle: () => latest.current.handler(),
      takes: (target) => {
        const on = latest.current.enabled;
        return typeof on === 'function' ? on(target) : on;
      },
      passesKey: (event) => latest.current.passesKey?.(event) === true,
      element: () => elementRef.current,
      doc: () => elementRef.current?.ownerDocument ?? pushedIn,
      popup,
      closeRequests,
    });
  }, [active, elementRef, popup, closeRequests]);

  // The element can reach another document after the layer activates, as when
  // a portal's target is an iframe's body set after mount, so the listeners
  // follow it.
  const listenedIn = useRef<Document | null>(null);
  useEffect(() => {
    const doc = active ? (elementRef.current?.ownerDocument ?? null) : null;
    if (doc === listenedIn.current) return;
    listenedIn.current = doc;
    if (doc) sync();
  });
}
