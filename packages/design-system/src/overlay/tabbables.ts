// Every kind of element Tab could stop on.
const CANDIDATES = /* @__PURE__ */ [
  'a[href]',
  'button',
  // A value input carries a custom control's value and is not a control itself.
  'input:not([type="hidden"]):not([data-todae-value-input])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not(input[type="hidden"]):not([data-todae-value-input])',
].join(', ');

/**
 * Marks the element Toast.Region moves into an open modal. Its toasts are not
 * the modal's own content.
 */
export const TOAST_HOST_ATTRIBUTE = 'data-todae-toast-host';

/** Whether `el` sits in a toast host inside `root`, rather than being root's own content. */
export function inToastHostWithin(el: Element, root: Element): boolean {
  const host = el.closest(`[${TOAST_HOST_ATTRIBUTE}]`);
  return Boolean(host && host !== root && root.contains(host));
}

// Whether Tab would stop on `el`, one of root's CANDIDATES, were it enabled
// and shown: not taken out by a negative tabindex, and not inside a `hidden`
// or `aria-hidden` subtree strictly inside the queried root. Both subtrees
// count as removed content on purpose; one on or around root is the page's
// business, not root's. Styles and `disabled` are not read.
function inTabOrder(el: HTMLElement, root: HTMLElement): boolean {
  if (el.hasAttribute('tabindex')) {
    if (hasNegativeTabindex(el)) return false;
  } else if (el.localName === 'summary') {
    // Only a <details>'s own summary, its first summary child, takes focus.
    const details = el.parentElement;
    if (details?.localName !== 'details' || details.querySelector(':scope > summary') !== el) return false;
  }
  const removed = el.closest('[hidden], [aria-hidden="true"]');
  return !removed || removed === root || !root.contains(removed);
}

// Engines differ on the default tabIndex of some candidates, such as
// contenteditable, so only a tabindex that is set takes one out.
function hasNegativeTabindex(el: HTMLElement): boolean {
  return el.hasAttribute('tabindex') && el.tabIndex < 0;
}

/**
 * Whether focus can move to `el` now: not inert, and not hidden by a
 * stylesheet, `visibility`, or a closed `<details>`. `visibility: hidden`
 * blocks focus too. Tabindex and `disabled` are not read.
 */
export function isReachable(el: HTMLElement | SVGElement): boolean {
  if (el.closest('[inert]')) return false;
  // Without checkVisibility, only an inline display:none is seen.
  // checkVisibilityCSS is visibilityProperty's older name, which Safari 17.4 reads.
  return el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) ?? el.style.display !== 'none';
}

/** Whether a script can move focus to `el` now: it isn't disabled and is reachable. Tab order is not read. */
export function canFocusNow(el: HTMLElement | SVGElement): boolean {
  return !el.matches(':disabled') && isReachable(el);
}

// Whether `el` is focusable now, by its own state alone.
function canTakeFocus(el: HTMLElement, root: HTMLElement): boolean {
  return inTabOrder(el, root) && canFocusNow(el);
}

// Each named radio group's one Tab stop, going forward: its checked radio, or
// with none checked, the root's first that can take focus. A group is the
// radios of one name and one form owner. Its checked radio may sit outside
// root, and then takes the whole group out of root, as Chromium's Tab does,
// unless root is in an open modal dialog that radio is not in, since the page
// behind it is inert. Which radio claims the group follows the browser:
// `aria-hidden` does not matter there. Whether root lists it does, as for any
// candidate. Null marks a group root holds that no radio claims.
type RadioStops = Map<HTMLFormElement | null, Map<string, HTMLInputElement | null>>;

// Whether the browser's Tab could stop on radio `el`: tabindex, `disabled`,
// `hidden` and reachability count, `aria-hidden` does not.
function radioTakesFocus(el: HTMLInputElement): boolean {
  // `hidden` is read too, for engines without checkVisibility.
  if (hasNegativeTabindex(el) || el.closest('[hidden]')) return false;
  return canFocusNow(el);
}

function radioStopsIn(root: HTMLElement): RadioStops {
  const stops: RadioStops = new Map();
  for (const el of candidatesIn(root)) {
    if (!isNamedRadio(el)) continue;
    let byName = stops.get(el.form);
    if (!byName) stops.set(el.form, (byName = new Map()));
    const stop = byName.get(el.name) ?? null;
    if (!byName.has(el.name)) byName.set(el.name, null);
    if (stop?.checked || !radioTakesFocus(el)) continue;
    if (el.checked || !stop) byName.set(el.name, el);
  }
  const scope = modalAround(root) ?? (root.getRootNode() as Document | ShadowRoot | HTMLElement);
  for (const el of scope.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')) {
    const byName = stops.get(el.form);
    if (!byName?.has(el.name) || byName.get(el.name)?.checked || root.contains(el) || !radioTakesFocus(el)) continue;
    byName.set(el.name, el);
  }
  return stops;
}

// The open modal dialog root is in, at any depth: everything outside it is
// inert. Engines without `:modal`, such as jsdom, find none.
function modalAround(root: HTMLElement): HTMLDialogElement | null {
  for (let dialog = root.closest('dialog'); dialog; dialog = dialog.parentElement?.closest('dialog') ?? null) {
    try {
      if (dialog.matches(':modal')) return dialog;
    } catch {
      return null;
    }
  }
  return null;
}

function isNamedRadio(el: HTMLElement): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'radio' && el.name !== '';
}

/**
 * Tells, for one call, whether a candidate of root is a tab stop now. Radio
 * groups are worked out once, when the first named radio comes up.
 */
function tabStopTest(root: HTMLElement): (el: HTMLElement) => boolean {
  let stops: RadioStops | null = null;
  return (el) => {
    if (!canTakeFocus(el, root)) return false;
    if (!isNamedRadio(el)) return true;
    stops ??= radioStopsIn(root);
    return stops.get(el.form)?.get(el.name) === el;
  };
}

// root's candidates in document order, less the toasts moved into it.
function* candidatesIn(root: HTMLElement): Generator<HTMLElement> {
  for (const el of root.querySelectorAll<HTMLElement>(CANDIDATES)) {
    if (!inToastHostWithin(el, root)) yield el;
  }
}

/**
 * The elements in `root` that Todae treats as tab stops now: the candidates
 * Todae recognizes, in document order, minus disabled, hidden, inert and
 * aria-hidden content, and minus every radio of a named group but its one stop
 * going forward: its checked radio or, with none checked, root's first that
 * can take focus. A
 * checked radio of the group outside root takes the group out of root, unless
 * root is in an open modal dialog that radio is not in.
 */
export function getTabbables(root: HTMLElement): HTMLElement[] {
  return [...candidatesIn(root)].filter(tabStopTest(root));
}

/**
 * The elements in `root` that Tab stops on or would once shown, disabled ones
 * too, in document order. For a question about what content holds rather than
 * what Tab reaches this moment, such as which of a Toolbar's controls are its
 * arrow keys' items.
 */
export function getTabOrder(root: HTMLElement): HTMLElement[] {
  return [...candidatesIn(root)].filter((el) => inTabOrder(el, root));
}

/**
 * Every candidate Todae recognizes in `root`, in document order, whatever its
 * tabindex, `hidden`, `aria-hidden`, styles or `disabled`. For a rule about
 * what kinds of control content holds, such as Tooltip's.
 */
export function getCandidates(root: HTMLElement): HTMLElement[] {
  return [...candidatesIn(root)];
}

/**
 * The first element in `root` that Todae treats as a tab stop now, as
 * getTabbables does, and `accept` takes. It
 * stops at the first match, and runs `accept` before the costlier checks.
 */
export function firstTabbable(root: HTMLElement, accept?: (el: HTMLElement) => boolean): HTMLElement | null {
  const isTabStop = tabStopTest(root);
  for (const el of candidatesIn(root)) {
    if ((!accept || accept(el)) && isTabStop(el)) return el;
  }
  return null;
}
