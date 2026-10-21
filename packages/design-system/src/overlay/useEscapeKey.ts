import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { frontModal, isModal } from './modalStack.js';

type Entry = {
  handle: () => void;
  takes: (target: Element | null) => boolean;
  passesKey: (event: KeyboardEvent) => boolean;
  element: () => Element | null;
  popup: boolean;
};

const stack: Entry[] = [];
const watchers = /* @__PURE__ */ new Set<() => void>();
let listening = false;

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
      if (el && el !== outer && outer.contains(el)) inner = layers[i];
    }
    if (inner === undefined) return top;
    top = inner;
  }
  return undefined;
}

function contains(outer: Entry, inner: Entry): boolean {
  const el = inner.element();
  return Boolean(el && outer.element()?.contains(el));
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
function modalsInFront(target: EventTarget | null): Element[] {
  let node = target instanceof Element ? target.closest('dialog[open]') : null;
  while (node && !isModal(node)) node = node.parentElement?.closest('dialog[open]') ?? null;
  if (node) return [node];
  const front = frontModal();
  if (front) return [front];
  return [...document.querySelectorAll('dialog[open]')].filter(isModal);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A layer outside the modal dialog the key was pressed in sits behind it
  // and is inert. Escape belongs to the dialog's own close request.
  const modals = modalsInFront(event.target);
  const inFront = (entry: Entry) => {
    const el = entry.element();
    return modals.length === 0 || !el || modals.some((modal) => modal.contains(el));
  };
  const target = event.target instanceof Element ? event.target : null;
  // A disabled layer keeps its place but lets Escape fall through to the next enabled one.
  const top = select(stack.filter((entry) => inFront(entry) && entry.takes(target) && !entry.passesKey(event)));
  if (!top) return;
  event.preventDefault();
  top.handle();
}

function inside(scope: Element, entry: Entry): boolean {
  const el = entry.element();
  return Boolean(el && scope.contains(el));
}

/**
 * Gives a close request of the modal `dialog`, such as the Android back
 * gesture, to the layer inside it that Escape pressed where focus is would
 * reach, and returns whether one took it.
 */
export function takeCloseRequest(dialog: Element): boolean {
  const target = dialog.ownerDocument.activeElement;
  const top = select(stack.filter((entry) => inside(dialog, entry) && entry.takes(target)));
  top?.handle();
  return top !== undefined;
}

function subscribe(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => watchers.delete(watcher);
}

/**
 * Whether a layer sits inside `element`, kept current as layers come and go.
 * Registration only: whether a layer takes a request is read when one comes.
 */
export function useLayerInside(element: Element | null): boolean {
  return useSyncExternalStore(
    subscribe,
    () => element !== null && stack.some((entry) => inside(element, entry)),
    () => false,
  );
}

function push(entry: Entry): () => void {
  stack.push(entry);
  if (!listening) {
    document.addEventListener('keydown', onKeyDown);
    listening = true;
  }
  for (const watcher of [...watchers]) watcher();
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onKeyDown);
      listening = false;
    }
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
 * handled or one that ends an IME composition. Pass `elementRef` so a layer left behind a modal
 * `<dialog>` opened later skips the key, and the dialog gets it. A layer with
 * `popup: false` yields to every open popup whose element doesn't contain its
 * own.
 */
export function useEscapeKey(
  active: boolean,
  enabled: boolean | ((target: Element | null) => boolean),
  handler: () => void,
  elementRef?: RefObject<Element | null>,
  { popup = true, passesKey }: { popup?: boolean; passesKey?: (event: KeyboardEvent) => boolean } = {},
): void {
  const latest = useRef({ handler, enabled, passesKey });
  latest.current = { handler, enabled, passesKey };
  // Keyed on `active` only: toggling `enabled` must not move the layer above overlays opened later.
  useEffect(() => {
    if (!active) return;
    return push({
      handle: () => latest.current.handler(),
      takes: (target) => {
        const on = latest.current.enabled;
        return typeof on === 'function' ? on(target) : on;
      },
      passesKey: (event) => latest.current.passesKey?.(event) === true,
      element: () => elementRef?.current ?? null,
      popup,
    });
  }, [active, elementRef, popup]);
}
