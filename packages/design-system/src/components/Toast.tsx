import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { frontModal, isModal, subscribeModals } from '../overlay/modalStack';
import { useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { isPopoverOpen } from '../overlay/usePopoverSync';
import { TOAST_HOST_ATTRIBUTE } from '../overlay/tabbables';
import { initialFocusTarget } from '../overlay/useInitialFocus';
import { useFocusLeave } from '../overlay/useFocusLeave';
import { Button, type ButtonRootProps } from './Button';
import { useDismissLabel } from './dismissLabel';
import { composeHandlers, cx, useComposedRefs } from './props';
import type { Toaster, ToastRecord, ToastTone } from './toaster';
import styles from './Toast.module.css';

// The longest delay setTimeout takes; a longer one fires at once.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// Fallback for when the exit transition can't be read from computed style.
// The real length comes from the toast.motion.exit token.
export const TOAST_EXIT_MS = 160;

export type ToastPlacement = 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
export type ToastLayout = 'list' | 'stack';

export type ToastRegionProps<T extends object = object> = {
  /** The store from `createToaster()`. */
  toaster: Toaster<T>;
  /** Renders one toast, usually a `Toast.Root`. */
  children: (toast: ToastRecord<T>) => ReactNode;
  placement?: ToastPlacement;
  /** `list` shows every toast in full; `stack` collapses them behind the newest until hovered or focused. */
  layout?: ToastLayout;
  /** How many toasts show at once. Later ones wait their turn. */
  limit?: number;
  /** Key that moves focus to the toasts, such as `"F8"` or `"Alt+T"`. `null` turns it off. */
  hotkey?: string | null;
  'aria-label'?: string;
} & Omit<ComponentPropsWithRef<'section'>, 'children'>;

export type ToastRootProps = {
  /** Defaults to the toast's own `tone`. */
  tone?: ToastTone;
  children?: ReactNode;
} & ComponentPropsWithRef<'div'>;

export type ToastIconProps = ComponentPropsWithRef<'span'>;
export type ToastTitleProps = ComponentPropsWithRef<'p'>;
export type ToastDescriptionProps = ComponentPropsWithRef<'div'>;
export type ToastActionProps = ButtonRootProps;
export type ToastCloseProps = ButtonRootProps;

type ItemContextValue = { toast: ToastRecord; dismiss: () => void };

const ItemContext = createContext<ItemContextValue | null>(null);

// One reference, so the server snapshot never changes.
const NO_TOASTS: readonly never[] = [];
const noToasts = () => NO_TOASTS;

function show(el: HTMLElement): void {
  if (el.isConnected && !isPopoverOpen(el)) el.showPopover();
}

/**
 * Shows the popover again so it is last in the top layer, in front of
 * anything shown since. Focus inside comes back to where it was.
 */
function raise(el: HTMLElement): void {
  // Hiding it would hide a modal opened from a toast inside it.
  if (!el.isConnected || hasOpenModal(el)) return;
  keepingFocus(el, () => {
    if (isPopoverOpen(el)) el.hidePopover();
    el.showPopover();
  });
}

/**
 * Keyboard focus, as opposed to focus a pointer press left behind. Only
 * keyboard focus pauses the toasts; the pointer pauses them by hovering.
 */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Focuses `el` and says whether it took focus: an inert or hidden one does not. */
function tryFocus(el: HTMLElement | null | undefined): boolean {
  if (!el?.isConnected) return false;
  el.focus({ preventScroll: true });
  return el.ownerDocument.activeElement === el;
}

function hasOpenModal(el: HTMLElement): boolean {
  return [...el.querySelectorAll('dialog[open]')].some(isModal);
}

/** Runs `change`, which may hide `el`, and puts focus back where it was inside. */
function keepingFocus(el: HTMLElement, change: () => void): void {
  const active = el.ownerDocument.activeElement;
  const focused = active instanceof HTMLElement && el.contains(active) ? active : null;
  change();
  if (focused && el.isConnected) focused.focus({ preventScroll: true });
}

/** Runs the consumer's handler, then the region's bookkeeping, which has no default to prevent. */
function alongside<E>(theirs: ((event: E) => void) | undefined, ours: (event: E) => void): (event: E) => void {
  return (event) => {
    theirs?.(event);
    ours(event);
  };
}

/** Whether a key pressed in `target` types there, so a typing hotkey leaves it alone. */
function typesIn(target: EventTarget | null, hotkey: string): boolean {
  // A function key types nothing anywhere.
  if (/(^|\+)\s*f\d{1,2}\s*$/i.test(hotkey)) return false;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches('input, textarea, select');
}

const MODIFIERS = ['alt', 'ctrl', 'meta', 'shift'] as const;

/** Whether `event` is `hotkey`, such as "F8" or "Alt+T", with exactly those modifiers. */
export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.split('+').map((part) => part.trim().toLowerCase());
  const key = parts.pop();
  if (!key) return false;
  // Chrome sends keydown events with no key, such as for an autofill pick.
  const eventKey = event.key ?? '';
  const eventCode = event.code ?? '';
  const wanted = new Set(parts.map((part) => (part === 'control' ? 'ctrl' : part)));
  for (const modifier of MODIFIERS) {
    if (event[`${modifier}Key`] !== wanted.has(modifier)) return false;
  }
  const typed = eventKey.toLowerCase();
  if (typed === key) return true;
  // The code only when the key is no plain letter or digit, as Option changes
  // what a letter or digit types on macOS. A plain one decides by itself, so
  // a layout such as AZERTY matches by what the key types.
  if (/^[a-z0-9]$/.test(typed)) return false;
  const code = eventCode.toLowerCase();
  return code === `key${key}` || code === `digit${key}`;
}

function Item<T extends object>({
  toast,
  toaster,
  paused,
  onFocusLost,
  children,
}: {
  toast: ToastRecord<T>;
  toaster: Toaster<T>;
  paused: boolean;
  onFocusLost: (keyboard: boolean) => void;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const { present, exiting } = useOverlayPresence(toast.open, TOAST_EXIT_MS, node, 'opacity');
  const entered = useEntered(present, exiting);
  const { id, open, duration, version } = toast;

  // Only the toast that left: add() may have shown this id again since.
  useEffect(() => {
    if (present) return;
    const current = toaster.getSnapshot().find((item) => item.id === id);
    if (current && !current.open && current.version === version) toaster.remove(id);
  }, [present, toaster, id, version]);

  // Removing the element that has focus sends no blur, so focus moves on
  // first. A layout cleanup runs before the element leaves, however it goes:
  // after its exit motion, remove(), or a lower limit.
  const focusLost = useRef(onFocusLost);
  focusLost.current = onFocusLost;
  useLayoutEffect(() => {
    if (!node) return;
    return () => {
      const active = node.ownerDocument.activeElement;
      if (active && node.contains(active)) focusLost.current(isKeyboardFocus(active));
    };
  }, [node]);

  // Time shown so far, kept across pauses, so a new duration counts it too.
  // Back to zero when add() shows it again.
  const elapsed = useRef(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    elapsed.current = 0;
  }, [version]);
  useEffect(() => {
    if (!open || paused || !Number.isFinite(duration)) return;
    const start = performance.now();
    const left = Math.max(0, duration - elapsed.current);
    // Longer than setTimeout takes: wait the most it takes, then go on counting.
    const timer =
      left > MAX_TIMEOUT_MS
        ? window.setTimeout(() => setTick((n) => n + 1), MAX_TIMEOUT_MS)
        : window.setTimeout(() => toaster.dismiss(id), left);
    return () => {
      window.clearTimeout(timer);
      elapsed.current += performance.now() - start;
    };
  }, [open, paused, duration, version, toaster, id, tick]);

  const dismiss = useCallback(() => toaster.dismiss(id), [toaster, id]);
  const item = useMemo(() => ({ toast: toast as ToastRecord, dismiss }), [toast, dismiss]);

  return (
    <li
      ref={setNode}
      className={styles.item}
      data-entered={entered ? '' : undefined}
      data-exiting={exiting ? '' : undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Escape belongs to the toast, not to a dialog or popover behind it,
        // also while it leaves. Toasts hold text and buttons only, so no layer
        // opened from one needs it.
        event.preventDefault();
        event.stopPropagation();
        if (open) dismiss();
      }}
    >
      <ItemContext.Provider value={item}>{children}</ItemContext.Provider>
    </li>
  );
}

/**
 * Where toasts show. Render one near the app root; it renders where you put
 * it, so it takes the theme there, and while a modal is open it sits inside
 * the modal and takes its theme. The toasts sit in a `popover="manual"`
 * element in the top layer, and move into the modal `<dialog>` in front of
 * Todae's modal stack while one is open, as everything outside a modal is
 * inert. Each new toast shows the popover again, in front of overlays opened
 * since.
 */
function Region<T extends object = object>({
  toaster,
  children,
  placement = 'bottom-end',
  layout = 'list',
  limit = 3,
  hotkey = 'F8',
  'aria-label': ariaLabel = 'Notifications',
  className,
  ref,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: ToastRegionProps<T>) {
  // None on the server: a store at module scope is shared by every request.
  const toasts = useSyncExternalStore(toaster.subscribe, toaster.getSnapshot, noToasts);
  const homeRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sectionRefs = useComposedRefs(sectionRef, ref);
  const listRef = useRef<HTMLOListElement>(null);
  // Where focus came from into the region, to go back to. Never inside it.
  const origin = useRef<HTMLElement | null>(null);
  // The element focused inside the region, to focus again if the host is
  // taken out of the document with it, such as with a dialog React removes.
  const lastInside = useRef<HTMLElement | null>(null);
  // Set while Todae moves or shows the host again, so the focus events that
  // causes don't count as focus coming in.
  const moving = useRef(false);
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const expanded = hovered || focused;
  // Focus can leave without a blur, such as when the focused element is
  // removed or moved, so it is read again after those.
  const syncFocused = useCallback(() => {
    const section = sectionRef.current;
    const active = section?.ownerDocument.activeElement;
    setFocused(Boolean(active && section.contains(active) && isKeyboardFocus(active)));
  }, []);
  // Likewise the pointer: a toast removed from under a resting pointer sends
  // no pointerleave, so hover is read again a frame after the toasts change,
  // once the browser has updated it.
  const syncHovered = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (!section.matches(':hover')) setHovered(false);
      } catch {
        // An engine without :hover keeps what the pointer events said.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const whileMoving = useCallback((change: () => void) => {
    moving.current = true;
    try {
      change();
    } finally {
      moving.current = false;
    }
  }, []);

  // A host element of Todae's own, so it can move into a dialog and back
  // without React noticing; React only renders inside it.
  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    const el = home.ownerDocument.createElement('div');
    el.setAttribute('popover', 'manual');
    el.className = styles.host ?? '';
    // Marks it as not the dialog's own content when it moves into one.
    el.setAttribute(TOAST_HOST_ATTRIBUTE, '');
    home.append(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, []);

  useLayoutEffect(() => {
    if (host) host.dataset.placement = placement;
  }, [host, placement]);

  // Lives inside the modal in front, or at home when none is open. Moving a
  // popover hides it, so it is shown again, which also puts it in front.
  useLayoutEffect(() => {
    const home = homeRef.current;
    if (!host || !home) return;
    let observer: MutationObserver | null = null;
    let stopHover: (() => void) | undefined;
    const place = (reshown = false) => {
      // Not a modal opened from a toast, which sits inside the host itself.
      const target = frontModal((modal) => host.contains(modal)) ?? home;
      // Removed with focus inside, which then fell to the body.
      const lost = host.isConnected ? null : lastInside.current;
      observer?.disconnect();
      whileMoving(() => {
        keepingFocus(host, () => {
          if (host.parentNode !== target) target.append(host);
          // Where it is, it shows again only to go back in front of a modal
          // that was shown again.
          else if (reshown && target !== home && !hasOpenModal(host) && isPopoverOpen(host)) host.hidePopover();
          show(host);
        });
        // Only while focus is nowhere else, as it was left by the removal.
        const active = host.ownerDocument.activeElement;
        if (lost && host.contains(lost) && (!active || active === host.ownerDocument.body)) tryFocus(lost);
      });
      // Without the stack changing, React may take the host out of a dialog
      // it renders, such as when it sets the dialog's text, and code may take
      // the dialog out of the document with the host inside. Watching the
      // dialog and its ancestors, not their subtrees, sees both.
      if (target !== home) {
        observer = new MutationObserver(() => {
          if (host.parentNode !== target || !host.isConnected) place();
        });
        for (let node: Node | null = target; node; node = node.parentNode) observer.observe(node, { childList: true });
      }
      syncFocused();
      // Moved out from under a resting pointer, which sends no pointerleave.
      stopHover?.();
      stopHover = syncHovered();
    };
    place();
    const unsubscribe = subscribeModals(place);
    return () => {
      unsubscribe();
      observer?.disconnect();
      stopHover?.();
    };
  }, [host, syncFocused, syncHovered, whileMoving]);

  // Toasts already in the store when the region mounts show a task after
  // the live list, so screen readers read them as added.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!host) return;
    const timer = window.setTimeout(() => setLive(true));
    return () => {
      window.clearTimeout(timer);
      setLive(false);
    };
  }, [host]);

  // At least one, so toasts never only wait.
  const max = Math.max(1, Math.floor(limit) || 1);
  const shown = live ? toasts.slice(0, max) : NO_TOASTS;
  const hasOpen = shown.some((toast) => toast.open);

  // A toast that starts showing, new, shown again by add() or out of the
  // queue, goes in front of overlays shown since the last one.
  const openKeys = shown.filter((toast) => toast.open).map((toast) => `${toast.id}:${toast.version}`);
  const openKey = openKeys.join('\n');
  const raisedKeys = useRef<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => {
    if (!host) return;
    const keys = openKey ? openKey.split('\n') : [];
    const fresh = keys.some((key) => !raisedKeys.current.has(key));
    raisedKeys.current = new Set(keys);
    if (fresh) whileMoving(() => raise(host));
  }, [host, openKey, whileMoving]);

  useEffect(() => {
    const doc = homeRef.current?.ownerDocument;
    if (!doc) return;
    const sync = () => setPageHidden(doc.visibilityState === 'hidden');
    sync();
    doc.addEventListener('visibilitychange', sync);
    return () => doc.removeEventListener('visibilitychange', sync);
  }, []);

  // A toast dismissed while it waited never showed, so it has no exit motion.
  useEffect(() => {
    for (const toast of toasts.slice(max)) if (!toast.open) toaster.remove(toast.id);
  }, [toasts, max, toaster]);

  useEffect(() => {
    if (!hotkey || !hasOpen) return;
    const doc = homeRef.current?.ownerDocument;
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      const section = sectionRef.current;
      // Not a key something else handled, an IME composing, or a held key.
      if (event.defaultPrevented || event.isComposing || event.repeat || typesIn(event.target, hotkey)) return;
      // The key stays the page's when the region can't take focus, such as
      // under a modal outside Todae's stack.
      if (section && matchesHotkey(event, hotkey) && tryFocus(section)) event.preventDefault();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [hotkey, hasOpen]);

  // Focus leaves the region: back where it came from, else to the modal the
  // region sits in, as the page outside it is inert, else out of the region
  // rather than lost with an element about to be removed.
  const leave = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;
    const from = origin.current;
    origin.current = null;
    const active = section.ownerDocument.activeElement;
    const modal = host?.parentElement instanceof HTMLDialogElement ? host.parentElement : null;
    if (!tryFocus(from) && !(modal && tryFocus(initialFocusTarget(modal)))) {
      if (active instanceof HTMLElement && section.contains(active)) active.blur();
    }
    syncFocused();
  }, [host, syncFocused]);

  // A focused toast is leaving. A keyboard user stays in the region while
  // other toasts remain, so the next Tab reaches them; otherwise focus leaves.
  const afterFocusLost = useCallback(
    (keyboard: boolean) => {
      if (!alive.current) return;
      const others = toaster.getSnapshot().slice(0, max).some((toast) => toast.open);
      if (keyboard && others) sectionRef.current?.focus();
      else leave();
    },
    [toaster, max, leave],
  );

  // Not when the host left the document with focus inside: place() puts it
  // back and focuses that element again.
  const focusLeave = useFocusLeave(
    () => {
      origin.current = null;
      lastInside.current = null;
      setFocused(false);
    },
    () => !host?.isConnected,
  );

  // The observer sees size changes; the list itself changes with these ids.
  const shownKey = shown.map((toast) => toast.id).join('\n');
  // Stack offsets from each toast's own height, as CSS variables, so the
  // stack layout needs no measuring of its own. Read from the toast inside
  // each item, which the collapsed layout clips but never resizes.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const items = [...list.children] as HTMLElement[];
      let offset = 0;
      items.forEach((item, index) => {
        const height = (item.firstElementChild as HTMLElement | null)?.offsetHeight ?? item.offsetHeight;
        item.style.setProperty('--toast-index', String(index));
        item.style.setProperty('--toast-offset', `${offset}px`);
        if (index === 0) list.style.setProperty('--toast-front-height', `${height}px`);
        offset += height;
      });
      list.style.setProperty('--toast-count', String(items.length));
    };
    measure();
    const stopHover = syncHovered();
    if (typeof ResizeObserver === 'undefined') return stopHover;
    const observer = new ResizeObserver(measure);
    for (const item of list.children) {
      observer.observe(item);
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    }
    return () => {
      observer.disconnect();
      stopHover?.();
    };
  }, [host, shownKey, syncHovered]);

  const region = (
    <section
      {...props}
      ref={sectionRefs}
      tabIndex={-1}
      aria-label={ariaLabel}
      className={cx(styles.region, className)}
      data-layout={layout}
      data-placement={placement}
      data-expanded={expanded ? '' : undefined}
      onPointerEnter={alongside(onPointerEnter, () => setHovered(true))}
      onPointerLeave={alongside(onPointerLeave, () => setHovered(false))}
      onFocus={alongside(onFocus, (event) => {
        focusLeave.onFocus();
        if (event.target instanceof HTMLElement) lastInside.current = event.target;
        if (moving.current) return;
        const from = event.relatedTarget;
        // Only from outside: focus moving within the region keeps the origin,
        // and an unknown origin keeps the last one.
        if (from instanceof HTMLElement && !event.currentTarget.contains(from)) origin.current = from;
        setFocused(isKeyboardFocus(event.target));
      })}
      onBlur={alongside(onBlur, focusLeave.onBlur)}
      onKeyDown={composeHandlers(onKeyDown, (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Escape' || event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        leave();
      })}
    >
      {/* Present before any toast, so screen readers announce what is added. */}
      <ol ref={listRef} className={styles.list} aria-live="polite">
        {[...shown].reverse().map((toast) => (
          <Item
            key={toast.id}
            toast={toast}
            toaster={toaster}
            paused={expanded || pageHidden}
            onFocusLost={afterFocusLost}
          >
            {children(toast)}
          </Item>
        ))}
      </ol>
    </section>
  );

  return (
    <span ref={homeRef} className={styles.home}>
      {host ? createPortal(region, host) : null}
    </span>
  );
}

/**
 * One toast. Every tone is read once, politely, through the region's live
 * list: a role="alert" inside it could be read twice, and again each time
 * the region moves into or out of a dialog.
 */
function Root({ tone, className, ...props }: ToastRootProps) {
  const item = useContext(ItemContext);
  const resolved = tone ?? item?.toast.tone ?? 'info';
  return (
    <div
      {...props}
      data-tone={resolved}
      className={cx(styles.root, className)}
    />
  );
}

/** A slot for any icon. Hidden from assistive technology unless it says otherwise. */
function Icon({ className, ...props }: ToastIconProps) {
  return <span aria-hidden {...props} className={cx(styles.icon, className)} />;
}

function Title({ className, ...props }: ToastTitleProps) {
  return <p {...props} className={cx(styles.title, className)} />;
}

function Description({ className, ...props }: ToastDescriptionProps) {
  return <div {...props} className={cx(styles.description, className)} />;
}

/** A secondary Button.Root that dismisses the toast after `onClick`, unless it calls `preventDefault()`. */
function Action({ variant = 'secondary', onClick, className, ...props }: ToastActionProps) {
  const item = useContext(ItemContext);
  return (
    <Button.Root
      variant={variant}
      {...props}
      className={cx(styles.action, className)}
      onClick={composeHandlers(onClick, () => item?.dismiss())}
    />
  );
}

/** A ghost Button.Root that dismisses the toast. Named "Dismiss" unless its own text names it. */
function Close({ 'aria-label': ariaLabel, onClick, className, children, ref, ...props }: ToastCloseProps) {
  const item = useContext(ItemContext);
  const [label, refs] = useDismissLabel(children, ariaLabel, ref);
  return (
    <Button.Root
      variant="ghost"
      aria-label={label}
      {...props}
      ref={refs}
      className={cx(styles.close, className)}
      onClick={composeHandlers(onClick, () => item?.dismiss())}
    >
      {children}
    </Button.Root>
  );
}

export const Toast = { Region, Root, Icon, Title, Description, Action, Close } as const;
