import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus';
import { Button, type ButtonRootProps } from './Button';
import buttonStyles from './Button.module.css';
import { cx } from './cx';
import { useComposedRefs } from './props';
import { TOOLBAR_BOUNDARY, ToolbarContext } from './toolbarContext';
import styles from './ToggleGroup.module.css';

export type ToggleGroupOrientation = 'horizontal' | 'vertical';

type ToggleGroupBase = {
  orientation?: ToggleGroupOrientation;
  /** Disables every item. */
  disabled?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'defaultValue' | 'onChange' | 'children'>;

/** One item pressed at most. Pressing the pressed item again clears it. */
export type ToggleGroupSingleProps = ToggleGroupBase & {
  selectionMode?: 'single';
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
};

/** Any number of items pressed. */
export type ToggleGroupMultipleProps = ToggleGroupBase & {
  selectionMode: 'multiple';
  value?: readonly string[];
  defaultValue?: readonly string[];
  onChange?: (value: string[]) => void;
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
  const toolbarContext = useContext(ToolbarContext);
  // Layers reset the context, but it still crosses a plain portal, and the
  // toolbar only manages controls inside its own element, so check the DOM too.
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [inLayer, setInLayer] = useState(false);
  useLayoutEffect(() => {
    const layer = nodeRef.current?.parentElement?.closest(TOOLBAR_BOUNDARY);
    setInLayer(layer?.getAttribute('role') !== 'toolbar');
  }, []);
  const toolbar = inLayer ? null : toolbarContext;
  const {
    selectionMode = 'single',
    value: valueProp,
    defaultValue,
    onChange,
    orientation = toolbar?.orientation ?? 'horizontal',
    disabled = false,
    className,
    ref,
    onKeyDown,
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
      (onChange as ToggleGroupMultipleProps['onChange'])?.(next);
    } else {
      const next = pressed.has(item) ? null : item;
      setValue(next);
      (onChange as ToggleGroupSingleProps['onChange'])?.(next);
    }
  };

  // Inside a toolbar the toolbar owns the arrow keys and the tab stop.
  // Single mode puts the tab stop on the pressed item; multiple on the first item.
  const roving = useRovingFocus({
    orientation,
    tabStop: toolbar === null,
    activeValue: multiple ? null : (list[0] ?? null),
  });
  const container = toolbar ? { ref: undefined, onKeyDown } : roving.getContainerProps({ onKeyDown });
  const refs = useComposedRefs(container.ref, nodeRef, ref);

  return (
    <ToggleGroupContext.Provider value={{ pressed, toggle, disabled, roving: toolbar ? null : roving }}>
      <div
        {...rest}
        {...container}
        ref={refs}
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
