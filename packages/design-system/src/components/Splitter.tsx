import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState.js';
import { useStrings } from '../providers/StringsProvider.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll } from './revealRing.js';
import {
  ceilingSize,
  clampSize,
  DEFAULT_SIZE,
  floorSize,
  keyAction,
  pointerSize,
  snapSize,
  stepSize,
  toggledSize,
  type Bounds,
  type SplitterKeyAction,
  type SplitterOrientation,
  type SplitterPrimary,
} from './splitterModel.js';
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
  /** The smallest size in pixels while the panel is open. */
  min?: number;
  /** The largest size in pixels. The container limits it too. */
  max?: number;
  /** Pixels an arrow key moves the handle. */
  step?: number;
  /** Lets the primary panel collapse to 0: Enter toggles it, and a drag below half of `min` snaps to 0. */
  collapsible?: boolean;
} & Omit<ComponentPropsWithRef<'div'>, 'defaultValue'>;

/** One of the two panels. A `div`, hidden from the tab order and the accessibility tree while it is collapsed. */
export type SplitterPanelProps = ComponentPropsWithRef<'div'>;

/** The `separator` between the panels. Name it with `aria-label` or `aria-labelledby`. */
export type SplitterHandleProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

type Drag = { pointerId: number; origin: number; sign: 1 | -1; offset: number };

type SplitterContextValue = {
  orientation: SplitterOrientation;
  primary: SplitterPrimary;
  size: number;
  bounds: Bounds;
  collapsible: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  handleRef: RefObject<HTMLDivElement | null>;
  drag: RefObject<Drag | null>;
  setDragging: (dragging: boolean) => void;
  setSize: (size: number) => void;
  apply: (action: SplitterKeyAction) => void;
};

const SplitterContext = /* @__PURE__ */ createContext<SplitterContextValue | null>(null);

function useSplitter(part: string): SplitterContextValue {
  const ctx = useContext(SplitterContext);
  if (!ctx) throw new Error(`Splitter.${part} must render inside Splitter.Root`);
  return ctx;
}

const PANEL = 'data-todae-splitter-panel';
let warnedShape = false;

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
  try {
    return el.matches(':dir(rtl)');
  } catch {
    // Engines without :dir, such as jsdom.
    return el.closest('[dir]')?.getAttribute('dir') === 'rtl';
  }
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
    () => ({ min, max: Math.min(max ?? Number.POSITIVE_INFINITY, room ?? Number.POSITIVE_INFINITY), collapsible }),
    [min, max, room, collapsible],
  );
  const [stored, change] = useControlledValue<number>(
    value,
    defaultValue ?? Math.min(Math.max(DEFAULT_SIZE, min), max ?? Number.POSITIVE_INFINITY),
    onValueChange,
  );
  const size = clampSize(stored, bounds);

  useEffect(() => {
    if (size > 0) lastOpen.current = size;
  }, [size]);

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

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || warnedShape) return;
    const root = rootRef.current;
    if (!root) return;
    const panels = root.querySelectorAll(`:scope > [${PANEL}]`).length;
    const handles = root.querySelectorAll(':scope > [role="separator"]').length;
    if (panels !== 2 || handles !== 1) {
      warnedShape = true;
      console.error(
        'Splitter.Root holds two Splitter.Panel and one Splitter.Handle as direct children, in the order Panel, Handle, Panel. Nest a Splitter.Root in a panel for more panes.',
      );
    }
  }, []);

  const setSize = useCallback((next: number) => change(next), [change]);
  const apply = (action: SplitterKeyAction) => {
    switch (action) {
      case 'grow':
      case 'shrink':
        return change(stepSize(action, size, bounds, step));
      case 'min':
        return change(floorSize(bounds));
      case 'max': {
        const largest = ceilingSize(bounds);
        return Number.isFinite(largest) ? change(largest) : undefined;
      }
      case 'toggle':
        return collapsible ? change(toggledSize(size, lastOpen.current, bounds, step)) : undefined;
    }
  };

  // The handlers read the latest render through the context, which changes with it.
  const context: SplitterContextValue = {
    orientation,
    primary,
    size,
    bounds,
    collapsible,
    rootRef,
    handleRef,
    drag,
    setDragging,
    setSize,
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
        style={{ ...style, '--_size': `${size}px` } as CSSProperties}
      />
    </SplitterContext.Provider>
  );
}

function Panel({ id: idProp, className, ref, ...props }: SplitterPanelProps) {
  const { primary, size } = useSplitter('Panel');
  const generated = useId();
  const own = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(own, ref);
  const [isPrimary, setIsPrimary] = useState(false);

  // Which panel is the primary one is a matter of DOM order, read after each commit.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- no dependency list: the siblings change without a prop changing, and a same value renders nothing.
  useLayoutEffect(() => {
    const el = own.current;
    if (el) setIsPrimary(siblingPanel(el, primary === 'start' ? 'previous' : 'next') === null);
  });

  return (
    <div
      {...props}
      ref={composedRef}
      id={idProp ?? generated}
      data-todae-splitter-panel=""
      className={cx(styles.panel, className)}
      data-collapsed={isPrimary && size === 0 ? '' : undefined}
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
  const { orientation, primary, size, bounds, collapsible, drag, handleRef } = ctx;
  const composedRef = useComposedRefs(handleRef, ref);
  const [controls, setControls] = useState<string | undefined>();

  // The panel's id is read after each commit, since a product may give or change it.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- no dependency list: a same value renders nothing.
  useLayoutEffect(() => {
    const el = handleRef.current;
    setControls((el && siblingPanel(el, primary === 'start' ? 'previous' : 'next'))?.id || undefined);
  });

  const name = ariaLabel || (ariaLabelledby ? undefined : resizePanel);
  const largest = ceilingSize(bounds);

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    ctx.setDragging(false);
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
      aria-valuemin={collapsible ? 0 : Math.round(bounds.min)}
      aria-valuemax={Number.isFinite(largest) ? Math.round(largest) : undefined}
      aria-controls={controls}
      className={cx(styles.handle, className)}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const action = keyAction(event.key, orientation, primary, isRtl(event.currentTarget));
        if (!action || (action === 'toggle' && !collapsible)) return;
        event.preventDefault();
        ctx.apply(action);
      })}
      onPointerDown={composeHandlers(onPointerDown, (event: PointerEvent<HTMLDivElement>) => {
        const root = ctx.rootRef.current;
        if (event.button !== 0 || !root) return;
        const handle = event.currentTarget;
        const horizontal = orientation === 'horizontal';
        const sign = (horizontal ? (primary === 'start') !== isRtl(handle) : primary === 'start') ? 1 : -1;
        const panel = siblingPanel(handle, primary === 'start' ? 'previous' : 'next');
        const rect = (panel ?? root).getBoundingClientRect();
        const origin = horizontal ? (sign > 0 ? rect.left : rect.right) : sign > 0 ? rect.top : rect.bottom;
        const shown = panel ? (horizontal ? rect.width : rect.height) : size;
        const press = horizontal ? event.clientX : event.clientY;
        // Not a text selection or a native drag; focus is moved by hand below.
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        drag.current = { pointerId: event.pointerId, origin, sign, offset: sign * (press - origin) - shown };
        ctx.setDragging(true);
        focusWithoutScroll(handle);
      })}
      onPointerMove={composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) return;
        const pointer = orientation === 'horizontal' ? event.clientX : event.clientY;
        ctx.setSize(snapSize(Math.round(pointerSize(pointer, current.origin, current.sign, current.offset)), bounds));
      })}
      onPointerUp={composeHandlers(onPointerUp, end)}
      onPointerCancel={composeHandlers(onPointerCancel, end)}
      onLostPointerCapture={composeHandlers(onLostPointerCapture, end)}
    />
  );
}

export const Splitter = { Root, Panel, Handle } as const;
