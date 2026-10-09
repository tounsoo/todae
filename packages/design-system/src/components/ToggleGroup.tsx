import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus';
import { useFocusLeave } from '../overlay/useFocusLeave';
import { Button, type ButtonRootProps } from './Button';
import buttonStyles from './Button.module.css';
import { cx } from './cx';
import { useComposedRefs } from './props';
import { useToolbar } from './toolbarContext';
import styles from './ToggleGroup.module.css';

export type ToggleGroupOrientation = 'horizontal' | 'vertical';

type ToggleGroupBase = {
  orientation?: ToggleGroupOrientation;
  /** Disables every item. */
  disabled?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'defaultValue' | 'children' | 'onChange'>;

/** One item pressed at most. Pressing the pressed item again clears it. */
export type ToggleGroupSingleProps = ToggleGroupBase & {
  selectionMode?: 'single';
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
};

/** Any number of items pressed. */
export type ToggleGroupMultipleProps = ToggleGroupBase & {
  selectionMode: 'multiple';
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
  disabled: boolean;
  roving: UseRovingFocusResult | null;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

function Root(props: ToggleGroupRootProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const toolbar = useToolbar(nodeRef);
  const {
    selectionMode = 'single',
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
    } else {
      const next = pressed.has(item) ? null : item;
      setValue(next);
      (onValueChange as ToggleGroupSingleProps['onValueChange'])?.(next);
    }
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
  const container = toolbar ? { ref: undefined, onKeyDown } : roving.getContainerProps({ onKeyDown });
  const refs = useComposedRefs(container.ref, nodeRef, ref);

  return (
    <ToggleGroupContext.Provider value={{ pressed, toggle, disabled, roving: toolbar ? null : roving }}>
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
        className={cx(orientation === 'horizontal' ? buttonStyles.group : styles.vertical, className)}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

function Item({ value, disabled, onFocus, ...props }: ToggleGroupItemProps) {
  const ctx = useContext(ToggleGroupContext);
  if (!ctx) throw new Error('ToggleGroup.Item must render inside ToggleGroup.Root');
  const off = disabled || ctx.disabled;
  const roving = ctx.roving ? ctx.roving.getItemProps(value, { disabled: off }, { onFocus }) : { onFocus };
  return (
    <Button.Root
      variant="secondary"
      {...props}
      {...roving}
      disabled={off}
      pressed={ctx.pressed.has(value)}
      onPressedChange={() => ctx.toggle(value)}
    />
  );
}

export const ToggleGroup = { Root, Item } as const;
