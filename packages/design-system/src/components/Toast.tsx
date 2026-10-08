import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { frontModal, subscribeModals } from '../overlay/modalStack';
import { useEntered, useOverlayPresence } from '../overlay/useOverlayPresence';
import { isPopoverOpen } from '../overlay/usePopoverSync';
import { Button, type ButtonRootProps } from './Button';
import { useDismissLabel } from './dismissLabel';
import { composeHandlers, cx, useComposedRefs } from './props';
import type { Toaster, ToastRecord, ToastTone } from './toaster';
import styles from './Toast.module.css';

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

function show(el: HTMLElement): void {
  if (el.isConnected && !isPopoverOpen(el)) el.showPopover();
}

/**
 * Shows the popover again so it is last in the top layer, in front of
 * anything shown since. Focus inside comes back to where it was.
 */
function raise(el: HTMLElement): void {
  keepingFocus(el, () => {
    if (isPopoverOpen(el)) el.hidePopover();
    el.showPopover();
  });
}

/** Runs `change`, which may hide `el`, and puts focus back where it was inside. */
function keepingFocus(el: HTMLElement, change: () => void): void {
  const active = el.ownerDocument.activeElement;
  const focused = active instanceof HTMLElement && el.contains(active) ? active : null;
  change();
  if (focused && el.isConnected) focused.focus({ preventScroll: true });
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
  // The code too, as Option changes the character a letter or digit types on macOS.
  const code = eventCode.toLowerCase();
  return eventKey.toLowerCase() === key || code === `key${key}` || code === `digit${key}`;
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
  onFocusLost: () => void;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const { present, exiting } = useOverlayPresence(toast.open, TOAST_EXIT_MS, node, 'opacity');
  const entered = useEntered(present, exiting);
  const { id, open, duration, version } = toast;

  useEffect(() => {
    if (present) return;
    // Removing the element that has focus sends no blur, so focus is moved
    // on before it goes.
    const hadFocus = Boolean(node?.contains(node.ownerDocument.activeElement));
    toaster.remove(id);
    if (hadFocus) onFocusLost();
  }, [present, toaster, id, node, onFocusLost]);

  // Time left, kept across pauses. Full again when add() shows it again.
  const remaining = useRef<number>(duration);
  useEffect(() => {
    remaining.current = duration;
  }, [duration, version]);
  useEffect(() => {
    if (!open || paused || !Number.isFinite(remaining.current)) return;
    const start = performance.now();
    const timer = window.setTimeout(() => toaster.dismiss(id), Math.max(0, remaining.current));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= performance.now() - start;
    };
  }, [open, paused, duration, version, toaster, id]);

  const dismiss = useCallback(() => toaster.dismiss(id), [toaster, id]);

  return (
    <li
      ref={setNode}
      className={styles.item}
      data-entered={entered ? '' : undefined}
      data-exiting={exiting ? '' : undefined}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        // Escape belongs to the toast, not to a dialog or popover behind it.
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
    >
      <ItemContext.Provider value={{ toast: toast as ToastRecord, dismiss }}>{children}</ItemContext.Provider>
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
  const toasts = useSyncExternalStore(toaster.subscribe, toaster.getSnapshot, toaster.getSnapshot);
  const homeRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sectionRefs = useComposedRefs(sectionRef, ref);
  const listRef = useRef<HTMLOListElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const expanded = hovered || focused;
  // Focus can leave without a blur, such as when the focused element is
  // removed or moved, so it is read again after those.
  const syncFocused = useCallback(() => {
    const section = sectionRef.current;
    setFocused(Boolean(section?.contains(section.ownerDocument.activeElement)));
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
    el.setAttribute('data-todae-toast-host', '');
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
    const place = () => {
      const target = frontModal() ?? home;
      keepingFocus(host, () => {
        if (host.parentNode !== target) target.append(host);
        show(host);
      });
      syncFocused();
    };
    place();
    return subscribeModals(place);
  }, [host, syncFocused]);

  const shown = toasts.slice(0, limit);
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
    if (fresh) raise(host);
  }, [host, openKey]);

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
    for (const toast of toasts.slice(limit)) if (!toast.open) toaster.remove(toast.id);
  }, [toasts, limit, toaster]);

  useEffect(() => {
    if (!hotkey || !hasOpen) return;
    const doc = homeRef.current?.ownerDocument;
    if (!doc) return;
    const onKey = (event: KeyboardEvent) => {
      const section = sectionRef.current;
      if (!section || !matchesHotkey(event, hotkey)) return;
      event.preventDefault();
      const active = doc.activeElement;
      if (active instanceof HTMLElement && !section.contains(active)) returnFocus.current = active;
      section.focus();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [hotkey, hasOpen]);

  const leave = useCallback(() => {
    const target = returnFocus.current;
    returnFocus.current = null;
    const section = sectionRef.current;
    const active = section?.ownerDocument.activeElement;
    if (target?.isConnected) target.focus();
    // With nowhere to go back to, out of the region rather than lost with
    // the element about to be removed.
    else if (active instanceof HTMLElement && section?.contains(active)) active.blur();
    syncFocused();
  }, [syncFocused]);

  // A toast with focus is leaving: focus goes to the region while others
  // remain, so the keyboard stays here, and otherwise back where the hotkey
  // came from.
  const afterFocusLost = useCallback(() => {
    const others = toaster.getSnapshot().slice(0, limit).some((toast) => toast.open);
    if (others) sectionRef.current?.focus();
    else leave();
  }, [toaster, limit, leave]);

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
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    for (const item of list.children) {
      observer.observe(item);
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    }
    return () => observer.disconnect();
  }, [host, shownKey]);

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
      onPointerEnter={composeHandlers(onPointerEnter, () => setHovered(true))}
      onPointerLeave={composeHandlers(onPointerLeave, () => setHovered(false))}
      onFocus={composeHandlers(onFocus, () => setFocused(true))}
      onBlur={composeHandlers(onBlur, (event) => {
        const next = event.relatedTarget;
        // With no relatedTarget, a window that lost focus keeps its active
        // element, so focus has not left.
        const landed = next instanceof Node ? next : event.currentTarget.ownerDocument.activeElement;
        if (!event.currentTarget.contains(landed)) setFocused(false);
      })}
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

const ASSERTIVE: ReadonlySet<ToastTone> = new Set(['critical']);

/**
 * One toast. `role` is `alert` for critical toasts, which interrupts;
 * others are read politely through the region's live list.
 */
function Root({ tone, role, className, ...props }: ToastRootProps) {
  const item = useContext(ItemContext);
  const resolved = tone ?? item?.toast.tone ?? 'info';
  return (
    <div
      {...props}
      role={role ?? (ASSERTIVE.has(resolved) ? 'alert' : undefined)}
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
