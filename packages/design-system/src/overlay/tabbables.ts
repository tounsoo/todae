// Every kind of element Tab could stop on.
const CANDIDATES = /* @__PURE__ */ [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not(input[type="hidden"])',
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
  // Engines differ on the default tabIndex of some candidates, such as
  // contenteditable, so only a tabindex that is set takes one out.
  if (el.hasAttribute('tabindex')) {
    if (el.tabIndex < 0) return false;
  } else if (el.localName === 'summary') {
    // Only a <details>'s own summary, its first summary child, takes focus.
    const details = el.parentElement;
    if (details?.localName !== 'details' || details.querySelector(':scope > summary') !== el) return false;
  }
  const removed = el.closest('[hidden], [aria-hidden="true"]');
  return !removed || removed === root || !root.contains(removed);
}

/**
 * Whether focus can move to `el` now: not inert, and not hidden by a
 * stylesheet, `visibility`, or a closed `<details>`. `visibility: hidden`
 * blocks focus too. Tabindex and `disabled` are not read.
 */
export function isReachable(el: HTMLElement): boolean {
  if (el.closest('[inert]')) return false;
  // Without checkVisibility, only an inline display:none is seen.
  // checkVisibilityCSS is visibilityProperty's older name, which Safari 17.4 reads.
  return el.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) ?? el.style.display !== 'none';
}

// Whether `el` is focusable now, by its own state alone.
function canTakeFocus(el: HTMLElement, root: HTMLElement): boolean {
  return inTabOrder(el, root) && !el.matches(':disabled') && isReachable(el);
}

// Each named radio group's one Tab stop, going forward: its checked radio, or
// with none checked that can take focus, the first that can. A group is the
// radios of one name and one form owner in root's tree, radios outside root
// too, as the browser counts them; but inside an open modal dialog, only the
// dialog's own, since the page behind it is inert.
type RadioStops = Map<HTMLFormElement | null, Map<string, { radio: HTMLInputElement; checked: boolean }>>;

function radioStopsIn(root: HTMLElement): RadioStops {
  const modal = root.closest('dialog');
  const scope = modal && isModalDialog(modal) ? modal : (root.getRootNode() as unknown as ParentNode);
  const page = root.ownerDocument.documentElement;
  const stops: RadioStops = new Map();
  for (const el of scope.querySelectorAll('input')) {
    if (!isNamedRadio(el)) continue;
    const inRoot = root.contains(el);
    if ((inRoot && inToastHostWithin(el, root)) || !canTakeFocus(el, inRoot ? root : page)) continue;
    let byName = stops.get(el.form);
    if (!byName) stops.set(el.form, (byName = new Map()));
    const stop = byName.get(el.name);
    if (!stop || (el.checked && !stop.checked)) byName.set(el.name, { radio: el, checked: el.checked });
  }
  return stops;
}

// Whether `dialog` was opened with showModal(). Engines without `:modal`, such as jsdom, say no.
function isModalDialog(dialog: Element): boolean {
  try {
    return dialog.matches(':modal');
  } catch {
    return false;
  }
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
    return stops.get(el.form)?.get(el.name)?.radio === el;
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
 * going forward: the checked radio or, with none checked, the first, counting
 * the group's radios outside root unless root is in an open modal dialog.
 * Shift+Tab into a group with none checked lands on its last radio instead.
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
