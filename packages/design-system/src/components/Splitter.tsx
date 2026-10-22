import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll, revealRing } from './revealRing.js';
import {
  clampSize,
  DEFAULT_SIZE,
  dragSize,
  emptySide,
  floorSize,
  growSign,
  keyAction,
  snapSize,
  stepSize,
  toggledSize,
  type Bounds,
  type SplitterKeyAction,
  type SplitterOrientation,
  type SplitterPrimary,
} from './splitterModel.js';
import { warnOnce } from './warnOnce.js';
import styles from './Splitter.module.css';

export type { SplitterOrientation, SplitterPrimary };

/**
 * Two resizable panels and the handle between them, in the order
 * `Splitter.Panel`, `Splitter.Handle`, `Splitter.Panel`. More panes nest
 * roots. `value` is the size in CSS pixels of the primary panel, the first one
 * unless `primary` is `end`; the other takes the rest. Give a vertical splitter
 * a definite block size.
 */
export type SplitterRootProps = {
  /** The axis the panels are laid along. A horizontal splitter puts them side by side. */
  orientation?: SplitterOrientation;
  /** Which panel `value` sizes. */
  primary?: SplitterPrimary;
  /** The primary panel's size in CSS pixels, when you own it. */
  value?: number;
  /** The primary panel's starting size in CSS pixels. */
  defaultValue?: number;
  /** Called on every change of the size, from a drag or a key, with the new size. */
  onValueChange?: (value: number) => void;
  /** The smallest size in pixels while the panel is open. A container too narrow for it wins. */
  min?: number;
  /** The largest size in pixels. The container limits it too. */
  max?: number;
  /** Pixels an arrow key moves the handle. */
  step?: number;
  /** Lets the primary panel collapse to 0: Enter toggles it, and a drag below half of `min` snaps to 0. */
  collapsible?: boolean;
} & Omit<ComponentPropsWithRef<'div'>, 'defaultValue'>;

/** One of the two panels. A `div`, hidden from the tab order and the accessibility tree while it is drawn at no size. */
export type SplitterPanelProps = ComponentPropsWithRef<'div'>;

/** The `separator` between the panels. Name it with `aria-label` or `aria-labelledby`. */
export type SplitterHandleProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

type Drag = {
  pointerId: number;
  startPointer: number;
  startSize: number;
  sign: 1 | -1;
  scale: number;
};

type SplitterContextValue = {
  orientation: SplitterOrientation;
  primary: SplitterPrimary;
  size: number;
  bounds: Bounds;
  handleRef: RefObject<HTMLDivElement | null>;
  attachHandle: (el: HTMLDivElement | null) => void;
  drag: RefObject<Drag | null>;
  setDragging: (dragging: boolean) => void;
  commit: (size: number) => void;
  apply: (action: SplitterKeyAction) => void;
};

const SplitterContext = /* @__PURE__ */ createContext<SplitterContextValue | null>(null);

function useSplitter(part: string): SplitterContextValue {
  const ctx = useContext(SplitterContext);
  if (!ctx) throw new Error(`Splitter.${part} must render inside Splitter.Root`);
  return ctx;
}

const PANEL = 'data-todae-splitter-panel';

// The panel before or after `el`; the shape check makes the root's children Panel, Handle, Panel, so a panel or
// handle that a company wraps in its own component still counts.
function siblingPanel(el: Element, side: 'previous' | 'next'): Element | null {
  return side === 'previous' ? el.previousElementSibling : el.nextElementSibling;
}

// Layout pixels per screen pixel along the axis, which a scaled ancestor makes other than 1.
function layoutScale(el: HTMLElement, horizontal: boolean): number {
  const shown = el.getBoundingClientRect()[horizontal ? 'width' : 'height'];
  const laid = Number.parseFloat(getComputedStyle(el)[horizontal ? 'width' : 'height']);
  return shown > 0 && laid > 0 ? laid / shown : 1;
}

function isRtl(el: HTMLElement): boolean {
  return el.matches(':dir(rtl)');
}

// The space a root's tracks share: its content box along the axis, less the handle's own track. Fractional, as the
// sheet draws it: `clientWidth` rounds, which would leave a sliver of the other panel unmarked or the range a pixel off.
function available(root: HTMLElement, handle: HTMLElement | null, orientation: SplitterOrientation): number | null {
  const horizontal = orientation === 'horizontal';
  const style = getComputedStyle(root);
  const [before, after] = horizontal
    ? [style.paddingLeft, style.paddingRight]
    : [style.paddingTop, style.paddingBottom];
  const [borderBefore, borderAfter] = horizontal
    ? [style.borderLeftWidth, style.borderRightWidth]
    : [style.borderTopWidth, style.borderBottomWidth];
  const padding = Number.parseFloat(before) + Number.parseFloat(after);
  const used = Number.parseFloat(horizontal ? style.width : style.height);
  // Without a used size (no layout engine) the rounded client size is all there is.
  const total = Number.isFinite(used)
    ? used -
      (style.boxSizing === 'border-box'
        ? padding + Number.parseFloat(borderBefore) + Number.parseFloat(borderAfter)
        : 0)
    : (horizontal ? root.clientWidth : root.clientHeight) - (padding || 0);
  // Nothing laid out (not rendered, or no layout engine): there is no limit to read.
  if (!(total > 0)) return null;
  // The handle's track from its computed size too, which, unlike a client rect, no scaled ancestor shrinks.
  const track = handle ? Number.parseFloat(getComputedStyle(handle)[horizontal ? 'width' : 'height']) : 0;
  return Math.max(0, total - (Number.isFinite(track) ? track : 0));
}

function Root({
  orientation = 'horizontal',
  primary = 'start',
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max,
  step = 16,
  collapsible = false,
  className,
  style,
  ref,
  ...props
}: SplitterRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  // The handle as state too, so a handle that remounts is measured and observed afresh.
  const [handle, setHandle] = useState<HTMLDivElement | null>(null);
  const attachHandle = useCallback((el: HTMLDivElement | null) => {
    handleRef.current = el;
    setHandle(el);
  }, []);
  const drag = useRef<Drag | null>(null);
  const lastOpen = useRef(0);
  const composedRef = useComposedRefs(rootRef, ref);
  const [room, setRoom] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const bounds = useMemo<Bounds>(
    () => ({
      min,
      // Whole pixels, as a drag and the keys give; the sliver under a pixel left over counts as empty.
      max: Math.min(max ?? Number.POSITIVE_INFINITY, room === null ? Number.POSITIVE_INFINITY : Math.floor(room)),
      collapsible,
    }),
    [min, max, room, collapsible],
  );
  const [stored, setStored] = useControlledState<number>(
    value,
    defaultValue ?? Math.min(Math.max(DEFAULT_SIZE, min), max ?? Number.POSITIVE_INFINITY),
  );
  const size = clampSize(stored, bounds);
  const empty = emptySide(size, room, primary);

  // The size last asked for, which a render has not caught up with while moves queue in one frame. It is the
  // only dedupe, so a move back to the size on screen still counts after one away from it.
  const requested = useRef(size);
  useLayoutEffect(() => {
    requested.current = size;
  });
  // A product that refuses a change renders nothing of its own; this render puts `requested` back to the size shown.
  const [, settle] = useReducer((count: number) => count + 1, 0);

  // A change to the size the panel already shows, such as a key at the
  // container's edge while the size the product holds is past it, reports nothing.
  const commit = (next: number) => {
    const drawn = clampSize(next, bounds);
    if (drawn === requested.current) return;
    requested.current = drawn;
    setStored(next);
    onValueChange?.(next);
    settle();
  };

  // Enter restores the size the product held when the panel was last open, whoever closed it. A drag in
  // progress holds sizes it only passes through, so it records once it ends.
  useEffect(() => {
    if (!dragging && stored > 0) lastOpen.current = stored;
  }, [dragging, stored]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The ref, not the state, so the first measure in the commit that attaches the handle already counts its track.
    const measure = () => setRoom(available(root, handleRef.current, orientation));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    // A token or font size that changes the handle's track moves the room without moving the root.
    if (handle) observer.observe(handle);
    return () => observer.disconnect();
  }, [orientation, handle]);

  // Focus inside a panel that empties would fall to the page; the handle is the way back.
  useLayoutEffect(() => {
    const handle = handleRef.current;
    if (!empty || !handle) return;
    const active = handle.ownerDocument.activeElement;
    if (active && siblingPanel(handle, empty === 'start' ? 'previous' : 'next')?.contains(active)) {
      focusWithoutScroll(handle);
    }
  }, [empty]);

  // The sheet and the handle's lookups rely on the exact shape, so check it whenever the root's children change,
  // whoever renders them.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const root = rootRef.current;
    if (!root) return;
    const check = () => {
      const [first, middle, last, ...rest] = root.children;
      if (
        !first?.hasAttribute(PANEL) ||
        middle?.getAttribute('role') !== 'separator' ||
        !last?.hasAttribute(PANEL) ||
        rest.length > 0
      ) {
        warnOnce(
          'splitter-shape',
          'Splitter.Root holds two Splitter.Panel and one Splitter.Handle as its only children, in the order Panel, Handle, Panel. Nest a Splitter.Root in a panel for more panes, and put a Suspense boundary inside a panel, not around one.',
          'error',
        );
      }
    };
    check();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true });
    return () => observer.disconnect();
  }, []);

  const apply = (action: SplitterKeyAction) => {
    switch (action) {
      case 'grow':
      case 'shrink':
        return commit(stepSize(action, size, bounds, step));
      case 'min':
        return commit(floorSize(bounds));
      case 'max':
        return Number.isFinite(bounds.max) ? commit(bounds.max) : undefined;
      case 'toggle':
        return commit(toggledSize(size, lastOpen.current, min, step));
    }
  };

  // The handlers read the latest render through the context, which changes with it.
  const context: SplitterContextValue = {
    orientation,
    primary,
    size,
    bounds,
    handleRef,
    attachHandle,
    drag,
    setDragging,
    commit,
    apply,
  };

  return (
    <SplitterContext.Provider value={context}>
      <div
        {...props}
        ref={composedRef}
        className={cx(styles.root, className)}
        data-orientation={orientation}
        data-primary={primary}
        data-dragging={dragging ? '' : undefined}
        data-empty={empty}
        style={{ ...style, '--_size': `${size}px` } as CSSProperties}
      />
    </SplitterContext.Provider>
  );
}

function Panel({ id: idProp, className, onFocus, ref, ...props }: SplitterPanelProps) {
  useSplitter('Panel');
  const generated = useId();

  return (
    <div
      {...props}
      ref={ref}
      id={idProp ?? generated}
      data-todae-splitter-panel=""
      className={cx(styles.panel, className)}
      onFocus={composeHandlers(onFocus, (event: FocusEvent<HTMLDivElement>) =>
        revealRing(event.currentTarget, event.target),
      )}
    />
  );
}

function Handle({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className,
  ref,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  ...props
}: SplitterHandleProps) {
  const ctx = useSplitter('Handle');
  const { resizePanel } = useStrings();
  const { orientation, primary, size, bounds, drag, handleRef, attachHandle } = ctx;
  const composedRef = useComposedRefs(attachHandle, ref);
  const [controls, setControls] = useState<string | undefined>();

  // The panel's id is read after each commit, since a product may give or change it.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- no dependency list: a same value renders nothing.
  useLayoutEffect(() => {
    const el = handleRef.current;
    setControls((el && siblingPanel(el, primary === 'start' ? 'previous' : 'next'))?.id || undefined);
  });

  // A handle that leaves mid-drag gets no release.
  const { setDragging } = ctx;
  useEffect(
    () => () => {
      if (!drag.current) return;
      drag.current = null;
      setDragging(false);
    },
    [drag, setDragging],
  );

  const name = ariaLabel || (ariaLabelledby ? undefined : resizePanel);
  // Until the container is measured, with no `max`, the range reaches the size it shows.
  const largest = Number.isFinite(bounds.max) ? bounds.max : Math.max(size, floorSize(bounds));

  // A release runs Todae's part whatever the product's handler did.
  const release =
    (theirs: ((event: PointerEvent<HTMLDivElement>) => void) | undefined) => (event: PointerEvent<HTMLDivElement>) => {
      theirs?.(event);
      if (drag.current?.pointerId !== event.pointerId) return;
      drag.current = null;
      setDragging(false);
    };

  return (
    <div
      {...props}
      ref={composedRef}
      role="separator"
      tabIndex={0}
      aria-label={name}
      aria-labelledby={ariaLabelledby}
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.floor(size)}
      aria-valuemin={Math.floor(floorSize(bounds))}
      aria-valuemax={Math.floor(largest)}
      aria-controls={controls}
      className={cx(styles.handle, className)}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const action = keyAction(event.key, orientation, primary, isRtl(event.currentTarget));
        if (!action || (action === 'toggle' && !bounds.collapsible)) return;
        event.preventDefault();
        ctx.apply(action);
      })}
      onPointerDown={composeHandlers(onPointerDown, (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || !event.isPrimary || drag.current) return;
        const handle = event.currentTarget;
        const horizontal = orientation === 'horizontal';
        // Not a text selection or a native drag; focus is moved by hand below.
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startPointer: horizontal ? event.clientX : event.clientY,
          startSize: size,
          sign: growSign(orientation, primary, isRtl(handle)),
          scale: layoutScale(handle, horizontal),
        };
        setDragging(true);
        focusWithoutScroll(handle);
      })}
      onPointerMove={composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        const pointer = orientation === 'horizontal' ? event.clientX : event.clientY;
        const next = dragSize(pointer, current.startPointer, current.startSize, current.sign, current.scale);
        ctx.commit(snapSize(Math.round(next), bounds));
      })}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onLostPointerCapture={release(onLostPointerCapture)}
    />
  );
}

export const Splitter = { Root, Panel, Handle } as const;
