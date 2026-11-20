import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { observeSize } from '../internal/sharedObservers.js';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { Button, type ButtonRootProps } from './Button.js';
import buttonStyles from './Button.module.css';
import { cx } from '../internal/cx.js';
import { useComposedRefs } from '../internal/props.js';
import { useToolbar } from '../internal/toolbarContext.js';
import styles from './ToggleGroup.module.css';

export type ToggleGroupOrientation = 'horizontal' | 'vertical';

type ToggleGroupBase = {
  orientation?: ToggleGroupOrientation;
  /** Disables every item. */
  disabled?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'defaultValue' | 'children' | 'onChange'>;

/** One item pressed at most. Pressing the pressed item again clears it, unless `required`. */
export type ToggleGroupSingleProps = ToggleGroupBase & {
  selectionMode?: 'single';
} & (
  | {
      /** Pressing the pressed item keeps it pressed, so the value does not become null. */
      required?: false;
      value?: string | null;
      defaultValue?: string | null;
      onValueChange?: (value: string | null) => void;
    }
  | {
      /** Pressing the pressed item keeps it pressed, so the value does not become null. */
      required: true;
      value?: string;
      defaultValue?: string;
      onValueChange?: (value: string) => void;
    }
);

/** Any number of items pressed. */
export type ToggleGroupMultipleProps = ToggleGroupBase & {
  selectionMode: 'multiple';
  required?: never;
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
};

export type ToggleGroupRootProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

/** A toggle Button.Root. Its pressed state comes from the group. */
export type ToggleGroupItemProps = {
  value: string;
} & Omit<ButtonRootProps, 'pressed' | 'defaultPressed' | 'onPressedChange' | 'value'>;

type ToggleGroupContextValue = {
  pressed: ReadonlySet<string>;
  toggle: (value: string) => void;
  /** A controlled value with no onValueChange, which a press can't change. */
  readOnly: boolean;
  disabled: boolean;
  roving: UseRovingFocusResult | null;
  /** Values at the start or end of a wrapped line. Empty until measured. */
  lineStart: ReadonlySet<string>;
  lineEnd: ReadonlySet<string>;
};

const ToggleGroupContext = /* @__PURE__ */ createContext<ToggleGroupContextValue | null>(null);

function Root(props: ToggleGroupRootProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const toolbar = useToolbar(nodeRef);
  const {
    selectionMode = 'single',
    required = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    orientation = toolbar?.orientation ?? 'horizontal',
    disabled = false,
    className,
    ref,
    onKeyDown,
    onFocus,
    onBlur,
    children,
    ...rest
  } = props;
  const multiple = selectionMode === 'multiple';
  const [value, setValue] = useControlledState<string | null | readonly string[]>(
    valueProp,
    defaultValue ?? (multiple ? [] : null),
  );
  const list = useMemo<readonly string[]>(
    () => (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []),
    [value],
  );
  const pressed = useMemo(() => new Set(list), [list]);

  const toggle = (item: string) => {
    if (multiple) {
      const next = pressed.has(item) ? list.filter((v) => v !== item) : [...list, item];
      setValue(next);
      (onValueChange as ToggleGroupMultipleProps['onValueChange'])?.(next);
      return;
    }
    if (required) {
      if (pressed.has(item)) return;
      setValue(item);
      (onValueChange as ((value: string) => void) | undefined)?.(item);
      return;
    }
    const next = pressed.has(item) ? null : item;
    setValue(next);
    (onValueChange as ((value: string | null) => void) | undefined)?.(next);
  };

  // Inside a toolbar the toolbar owns the arrow keys and Tab. On its own,
  // focus enters on the pressed item in single mode and the first item in
  // multiple mode. While focus moves inside, the tab stop follows it, so Tab
  // and Shift+Tab leave the group; leaving puts it back.
  const [navigating, setNavigating] = useState<string | null>(null);
  const roving = useRovingFocus({
    orientation,
    tabStop: toolbar === null,
    activeValue: navigating ?? (multiple ? null : (list[0] ?? null)),
    onActiveValueChange: setNavigating,
  });
  const focusLeave = useFocusLeave(() => setNavigating(null));
  const [lines, setLines] = useState(NO_LINES);
  useLayoutEffect(() => {
    const root = nodeRef.current;
    if (!root || orientation !== 'horizontal') {
      setLines((prev) => (sameLines(prev, NO_LINES) ? prev : NO_LINES));
      return;
    }
    const measure = () => {
      const next = readLines(root);
      setLines((prev) => (sameLines(prev, next) ? prev : next));
    };
    measure();
    // One observer for the page. The group catches the container. Each item
    // catches a label that changes width without moving the group's box.
    const watched = [root, ...root.querySelectorAll<HTMLElement>(':scope > [data-todae-toggle-item]')];
    const stops = watched.map((el) => observeSize(el, measure));
    if (typeof ResizeObserver !== 'undefined') return () => stops.forEach((stop) => stop());
    window.addEventListener('resize', measure);
    return () => {
      stops.forEach((stop) => stop());
      window.removeEventListener('resize', measure);
    };
  }, [orientation, children]);
  const container = toolbar ? { ref: undefined, onKeyDown } : roving.getContainerProps({ onKeyDown });
  const refs = useComposedRefs(container.ref, nodeRef, ref);

  return (
    <ToggleGroupContext.Provider
      value={{
        pressed,
        toggle,
        readOnly: valueProp !== undefined && !onValueChange,
        disabled,
        roving: toolbar ? null : roving,
        lineStart: lines.start,
        lineEnd: lines.end,
      }}
    >
      <div
        {...rest}
        {...container}
        ref={refs}
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          onFocus?.(event);
          focusLeave.onFocus();
        }}
        onBlur={(event: FocusEvent<HTMLDivElement>) => {
          onBlur?.(event);
          focusLeave.onBlur(event);
        }}
        role="group"
        data-orientation={orientation}
        className={cx(
          orientation === 'horizontal' ? cx(buttonStyles.group, styles.horizontal) : styles.vertical,
          className,
        )}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

function Item({ value, disabled, onFocus, className, ...props }: ToggleGroupItemProps) {
  const ctx = useContext(ToggleGroupContext);
  if (!ctx) throw new Error('ToggleGroup.Item must render inside ToggleGroup.Root');
  const off = disabled || ctx.disabled;
  const roving = ctx.roving ? ctx.roving.getItemProps(value, { disabled: off }, { onFocus }) : { onFocus };
  return (
    <Button.Root
      variant="secondary"
      {...props}
      className={cx(styles.item, className)}
      data-todae-toggle-item={value}
      data-line-start={ctx.lineStart.has(value) ? '' : undefined}
      data-line-end={ctx.lineEnd.has(value) ? '' : undefined}
      {...roving}
      disabled={off}
      pressed={ctx.pressed.has(value)}
      // A read-only group asks no one, so its items don't render on a press.
      onPressedChange={ctx.readOnly ? undefined : () => ctx.toggle(value)}
    />
  );
}

export const ToggleGroup = { Root, Item } as const;

const NO_LINES: { start: ReadonlySet<string>; end: ReadonlySet<string> } = { start: new Set(), end: new Set() };

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function sameLines(
  a: { start: ReadonlySet<string>; end: ReadonlySet<string> },
  b: { start: ReadonlySet<string>; end: ReadonlySet<string> },
) {
  return sameSet(a.start, b.start) && sameSet(a.end, b.end);
}

/** The first and last item of each flex line, in DOM order, which is the inline order. */
function readLines(root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>(':scope > [data-todae-toggle-item]')].filter((item) => {
    const box = item.getBoundingClientRect();
    return box.width > 0 || box.height > 0;
  });
  const lines: HTMLElement[][] = [];
  for (const item of items) {
    const top = item.getBoundingClientRect().top;
    const line = lines.at(-1);
    const lineTop = line?.[0]?.getBoundingClientRect().top ?? top;
    // A real next line sits a control below this one. Subpixel tops on one row stay together.
    if (line && Math.abs(top - lineTop) <= 1) line.push(item);
    else lines.push([item]);
  }
  const start = new Set<string>();
  const end = new Set<string>();
  for (const line of lines) {
    const first = line[0]?.dataset.todaeToggleItem;
    const last = line.at(-1)?.dataset.todaeToggleItem;
    if (first !== undefined) start.add(first);
    if (last !== undefined) end.add(last);
  }
  return { start, end };
}
