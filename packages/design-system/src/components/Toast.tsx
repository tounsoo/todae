import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useEntered, useOverlayPresence } from '../overlay/useOverlayPresence.js';
import { handledOrComposing, useEscapeKey } from '../overlay/useEscapeKey.js';
import { useRaiseOnNew, useToastHost } from '../overlay/useToastHost.js';
import { Button, type ButtonActionProps, type ButtonRenderedProps } from './Button.js';
import { useStrings } from '../providers/StringsProvider.js';
import { CloseButton } from './closeButton.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { usePageHidden } from '../internal/usePageHidden.js';
import type { Toaster, ToastRecord, ToastTone } from './toaster.js';
import { isKeyboardFocus, useRegionFocus } from './useRegionFocus.js';
import { useRegionPointer } from './useRegionPointer.js';
import { useStackMeasure } from './useStackMeasure.js';
import styles from './Toast.module.css';

export { matchesHotkey } from '../hooks/hotkey.js';

// The longest delay setTimeout takes; a longer one fires at once.
const MAX_TIMEOUT_MS = 2_147_483_647; // 2 ** 31 - 1, written out since esbuild keeps `**` in unused code

// Fallback for when the exit transition can't be read from computed style.
// The real length comes from the toast.motion.duration.exit token.
export const TOAST_EXIT_MS = 160;

export type ToastPlacement = 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
export type ToastLayout = 'list' | 'stack';

export type ToastRegionProps<T extends object = object> = {
  /** The store from `createToaster()`. */
  toaster: Toaster<T>;
  /** Renders one toast, usually a `Toast.Root`. */
  children: (toast: ToastRecord<T>) => ReactNode;
  placement?: ToastPlacement;
  /** `list` shows every toast in full; `stack` collapses them behind the newest, and spreads them while the pointer is over them or keyboard focus is inside, and from a tap with a finger or a pen that isn't hovering until a press outside or no toast is left. */
  layout?: ToastLayout;
  /** How many toasts show at once. Later ones wait their turn. */
  limit?: number;
  /**
   * Key that moves focus to the toasts, such as `"F8"` or `"Alt+T"`. Modifiers
   * are Alt (or Option), Ctrl, Meta (or Cmd) and Shift. `null` turns it off.
   */
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
/** A Toast.Action can be a link, such as View, through Button.Root's `render`. */
export type ToastActionProps = ButtonActionProps | ButtonRenderedProps;
export type ToastCloseProps = ButtonActionProps;

type ItemContextValue = { toast: ToastRecord; dismiss: () => void };

const ItemContext = /* @__PURE__ */ createContext<ItemContextValue | null>(null);

// One reference, so the server snapshot never changes.
const NO_TOASTS: readonly never[] = [];
const noToasts = () => NO_TOASTS;


// Memoized, and it calls the region's render function itself, so a region
// render for one toast, such as a new one arriving, renders no other toast.
// A change to the timers' pause renders each toast's Item alone, not its
// content.
function ToastItem<T extends object>({
  toast,
  toaster,
  paused,
  escapable,
  onFocusLost,
  render,
}: {
  toast: ToastRecord<T>;
  toaster: Toaster<T>;
  paused: boolean;
  /** Whether focus is in the region, while which the toast is a layer on the Escape stack. */
  escapable: boolean;
  onFocusLost: (keyboard: boolean) => void;
  render: (toast: ToastRecord<T>) => ReactNode;
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
  // In an effect, not during render, so a render React throws away can't
  // leave the cleanup below a callback that never took effect.
  useLayoutEffect(() => {
    focusLost.current = onFocusLost;
  });
  useLayoutEffect(() => {
    if (!node) return;
    return () => {
      const active = node.ownerDocument.activeElement;
      if (active && node.contains(active)) focusLost.current(isKeyboardFocus(active));
    };
  }, [node]);

  // Time the timer has run so far, kept across pauses, so a new duration
  // counts it too. No timer runs while the duration is Infinity, so that
  // time is not counted. Back to zero when add() shows it again.
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
  const content = useMemo(() => render(toast), [render, toast]);

  // Escape inside the toast is the toast's, not a dialog's or popover's
  // behind it, also while it leaves. A layer inside it, such as a button's
  // tooltip, takes it first. The back gesture passes it by, as it does a
  // tooltip. It joins the stack when focus comes into the region, so an
  // overlay shown before that doesn't take Escape from it.
  const itemRef = useRef<HTMLLIElement>(null);
  const itemRefs = useComposedRefs(itemRef, setNode);
  useEscapeKey(
    escapable,
    (target) => target !== null && itemRef.current?.contains(target) === true,
    () => {
      if (open) dismiss();
    },
    itemRef,
    { closeRequests: false, passesKey: handledOrComposing },
  );

  return (
    <li
      ref={itemRefs}
      className={styles.item}
      data-entered={entered ? '' : undefined}
      data-todae-exiting={exiting ? '' : undefined}
    >
      <ItemContext.Provider value={item}>{content}</ItemContext.Provider>
    </li>
  );
}

const Item = /* @__PURE__ */ memo(ToastItem) as typeof ToastItem;

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
  'aria-label': ariaLabelProp,
  className,
  ref,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  onPointerMove,
  onPointerDown,
  onClickCapture,
  ...props
}: ToastRegionProps<T>) {
  // None on the server: a store at module scope is shared by every request.
  const toasts = useSyncExternalStore(toaster.subscribe, toaster.getSnapshot, noToasts);
  const { notifications } = useStrings();
  // An empty aria-label falls back too, as on Breadcrumbs and Pagination.
  const ariaLabel = ariaLabelProp || notifications;
  const homeRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const sectionRefs = useComposedRefs(sectionRef, ref);

  // At least one, so toasts never only wait. None until the host is live.
  const max = Math.max(1, Math.floor(limit) || 1);
  const [live, setLive] = useState(false);
  const shown = live ? toasts.slice(0, max) : NO_TOASTS;
  const hasOpen = shown.some((toast) => toast.open);
  // The observer sees size changes; the list itself changes with these ids.
  const shownKey = shown.map((toast) => toast.id).join('\n');

  const pointer = useRegionPointer(
    sectionRef,
    { hasOpen, listKey: shownKey },
    { onPointerEnter, onPointerMove, onPointerLeave, onPointerDown, onClickCapture, onKeyDown },
  );
  const focus = useRegionFocus({ sectionRef, toaster, max, hotkey, hasOpen, onFocus, onBlur });
  const { syncFocused, whileMoving, lastInside } = focus;
  const { syncHovered } = pointer;
  // Moving the host can take focus or the pointer from under it.
  const onPlace = useCallback(() => {
    syncFocused();
    return syncHovered();
  }, [syncFocused, syncHovered]);
  const host = useToastHost(homeRef, {
    className: styles.host ?? '',
    placement,
    whileMoving,
    lastInside,
    onPlace,
  });
  // Toasts already in the store when the region mounts show a task after
  // the live list, so screen readers read them as added.
  useEffect(() => {
    if (!host) return;
    const timer = window.setTimeout(() => setLive(true));
    return () => {
      window.clearTimeout(timer);
      setLive(false);
    };
  }, [host]);
  useRaiseOnNew(
    host,
    shown
      .filter((toast) => toast.open)
      .map((toast) => `${toast.id}:${toast.version}`)
      .join('\n'),
    whileMoving,
  );
  const listRef = useStackMeasure(shownKey);
  const pageHidden = usePageHidden(homeRef);
  const expanded = pointer.spread || focus.focused;

  // A toast dismissed while it waited never showed, so it has no exit motion.
  useEffect(() => {
    for (const toast of toasts.slice(max)) if (!toast.open) toaster.remove(toast.id);
  }, [toasts, max, toaster]);

  const region = (
    <section
      {...props}
      {...pointer.handlers}
      {...focus.handlers}
      ref={sectionRefs}
      tabIndex={-1}
      aria-label={ariaLabel}
      className={cx(styles.region, className)}
      data-layout={layout}
      data-placement={placement}
      data-expanded={expanded ? '' : undefined}
    >
      {/* Present before any toast, so screen readers announce what is added. */}
      <ol ref={listRef} className={styles.list} aria-live="polite">
        {[...shown].reverse().map((toast) => (
          <Item
            key={toast.id}
            toast={toast}
            toaster={toaster}
            paused={expanded || pointer.pressed || pageHidden}
            escapable={focus.inside}
            onFocusLost={focus.afterFocusLost}
            render={children}
          />
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
function Action(props: ButtonRenderedProps): ReactElement;
function Action(props: ButtonActionProps): ReactElement;
// Last, so ComponentProps reads ToastActionProps and a wrapper typed with it can pass it on.
function Action(props: ToastActionProps): ReactElement;
function Action({ variant = 'secondary', onClick, className, ...props }: ToastActionProps) {
  const item = useContext(ItemContext);
  // Button.Root's overloads take one shape at a time; Action passes either on.
  const AnyButton = Button.Root as (props: ButtonActionProps | ButtonRenderedProps) => ReactElement;
  return (
    <AnyButton
      variant={variant}
      {...props}
      className={cx(styles.action, className)}
      onClick={composeHandlers(onClick as ((event: ReactMouseEvent<HTMLElement>) => void) | undefined, () => item?.dismiss())}
    />
  );
}

/** A ghost Button.Root that dismisses the toast. Named by the `dismiss` string unless its own text names it. */
function Close({ onClick, className, ...props }: ToastCloseProps) {
  const item = useContext(ItemContext);
  return (
    <CloseButton
      {...props}
      fallbackName={useStrings().dismiss}
      className={cx(styles.close, className)}
      onClick={composeHandlers(onClick, () => item?.dismiss())}
    />
  );
}

export const Toast = { Region, Root, Icon, Title, Description, Action, Close } as const;
