import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll, revealRing } from './revealRing.js';
import {
  clampSize,
  DEFAULT_SIZE,
  dragSize,
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
};

type SplitterContextValue = {
  orientation: SplitterOrientation;
  primary: SplitterPrimary;
  size: number;
  bounds: Bounds;
  handleRef: RefObject<HTMLDivElement | null>;
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

// The nearest panel before or after `el` among its siblings, so a panel or
// handle that a company wraps in its own component still counts.
function siblingPanel(el: Element, side: 'previous' | 'next'): Element | null {
  for (
    let sibling = side === 'previous' ? el.previousElementSibling : el.nextElementSibling;
    sibling;
    sibling = side === 'previous' ? sibling.previousElementSibling : sibling.nextElementSibling
  ) {
    if (sibling.hasAttribute(PANEL)) return sibling;
  }
  return null;
}

function isRtl(el: HTMLElement): boolean {
  return el.matches(':dir(rtl)');
}

// The space a root's tracks share: its content box along the axis, less the handle's own track.
function available(root: HTMLElement, handle: HTMLElement | null, orientation: SplitterOrientation): number | null {
  const horizontal = orientation === 'horizontal';
  const style = getComputedStyle(root);
  const padding = horizontal
    ? Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
    : Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const total = (horizontal ? root.clientWidth : root.clientHeight) - (padding || 0);
  // Nothing laid out (not rendered, or no layout engine): there is no limit to read.
  if (total <= 0) return null;
  const rect = handle?.getBoundingClientRect();
  return Math.max(0, Math.floor(total - (rect ? (horizontal ? rect.width : rect.height) : 0)));
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
  const drag = useRef<Drag | null>(null);
  const lastOpen = useRef(0);
  const composedRef = useComposedRefs(rootRef, ref);
  const [room, setRoom] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const bounds = useMemo<Bounds>(
    () => ({
      min,
      max: Math.min(max ?? Number.POSITIVE_INFINITY, room ?? Number.POSITIVE_INFINITY),
      collapsible,
    }),
    [min, max, room, collapsible],
  );
  const [stored, change] = useControlledValue<number>(
    value,
    defaultValue ?? Math.min(Math.max(DEFAULT_SIZE, min), max ?? Number.POSITIVE_INFINITY),
    onValueChange,
  );
  const size = clampSize(stored, bounds);
  // The side drawn at no size: the primary panel at 0, or the other one when the primary fills the room.
  const empty =
    size === 0 ? primary : room !== null && size >= room ? (primary === 'start' ? 'end' : 'start') : undefined;

  // The size on screen as of the latest change, which a render has not caught up with while moves queue.
  const shown = useRef(size);
  useLayoutEffect(() => {
    shown.current = size;
  });

  // A change of the size the panel already shows, such as a key at the
  // container's edge while the size the product holds is past it, reports nothing.
  const commit = (next: number) => {
    const drawn = clampSize(next, bounds);
    if (drawn === shown.current) return;
    shown.current = drawn;
    change(next);
  };

  // Enter restores the size the product held when the panel was last open, whoever closed it. A drag in
  // progress holds sizes it only passes through, so it records once it ends.
  useEffect(() => {
    if (!dragging && stored > 0) lastOpen.current = stored;
  }, [dragging, stored]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setRoom(available(root, handleRef.current, orientation));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [orientation]);

  // Focus inside a panel that empties would fall to the page; the handle is the way back.
  useLayoutEffect(() => {
    const handle = handleRef.current;
    if (!empty || !handle) return;
    const active = handle.ownerDocument.activeElement;
    if (active && siblingPanel(handle, empty === 'start' ? 'previous' : 'next')?.contains(active)) {
      focusWithoutScroll(handle);
    }
  }, [empty]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const panels = root.querySelectorAll(`:scope > [${PANEL}]`).length;
    const handles = root.querySelectorAll(':scope > [role="separator"]').length;
    if (panels !== 2 || handles !== 1) {
      warnOnce(
        'splitter-shape',
        'Splitter.Root holds two Splitter.Panel and one Splitter.Handle as direct children, in the order Panel, Handle, Panel. Nest a Splitter.Root in a panel for more panes.',
        'error',
      );
    }
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
  const { orientation, primary, size, bounds, drag, handleRef } = ctx;
  const composedRef = useComposedRefs(handleRef, ref);
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
      aria-valuenow={Math.round(size)}
      aria-valuemin={Math.round(floorSize(bounds))}
      aria-valuemax={Math.round(largest)}
      aria-controls={controls}
      className={cx(styles.handle, className)}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const action = keyAction(
          event.key,
          orientation,
          primary,
          orientation === 'horizontal' && isRtl(event.currentTarget),
        );
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
          sign: growSign(orientation, primary, horizontal && isRtl(handle)),
        };
        setDragging(true);
        focusWithoutScroll(handle);
      })}
      onPointerMove={composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        const pointer = orientation === 'horizontal' ? event.clientX : event.clientY;
        const next = dragSize(pointer, current.startPointer, current.startSize, current.sign);
        ctx.commit(snapSize(Math.round(next), bounds));
      })}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onLostPointerCapture={release(onLostPointerCapture)}
    />
  );
}

export const Splitter = { Root, Panel, Handle } as const;
