import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { optionDomId } from './OptionList.ids';
import { composeHandlers, cx } from './props';
import styles from './OptionList.module.css';

/** `id` is derived from the list and value so `aria-activedescendant` can point at it. */
export type OptionProps = {
  value: string;
  children: string;
  disabled?: boolean;
} & Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'id'>;

type OptionListBase = {
  children: ReactNode;
  className?: string;
  id?: string;
  tabIndex?: number;
  activeValue?: string | null;
  onActiveChange?: (value: string | null) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'onChange' | 'defaultValue'>;

export type OptionListSingleProps = OptionListBase & {
  selectionMode?: 'single';
  value: string | null;
  onChange: (value: string) => void;
};

export type OptionListMultipleProps = OptionListBase & {
  selectionMode: 'multiple';
  value: readonly string[];
  onChange: (value: string[]) => void;
};

export type OptionListProps = OptionListSingleProps | OptionListMultipleProps;

type OptionListContextValue = {
  listId: string;
  selectionMode: 'single' | 'multiple';
  selected: ReadonlySet<string>;
  highlighted: string | null;
  select: (value: string, fromPointer?: boolean) => void;
};

const OptionListContext = createContext<OptionListContextValue | null>(null);

function useOptionList(): OptionListContextValue {
  const ctx = useContext(OptionListContext);
  if (!ctx) throw new Error('Option must render inside OptionList');
  return ctx;
}

function isMultiple(props: OptionListProps): props is OptionListMultipleProps {
  return props.selectionMode === 'multiple';
}

function isOptionElement(node: ReactNode): node is ReactElement<OptionProps> {
  return isValidElement(node) && node.type === Option;
}

function collectOptions(children: ReactNode): Pick<OptionProps, 'value' | 'disabled'>[] {
  return Children.toArray(children).flatMap((child) => {
    if (isOptionElement(child)) return [child.props];
    // Children.toArray flattens arrays but not fragments; look through them so disabled
    // state and keyboard order stay correct for `<>{items.map(...)}</>`.
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return collectOptions(child.props.children);
    }
    return [];
  });
}

export function Option({ value, children, disabled, className, onMouseDown, onClick, ...props }: OptionProps) {
  const ctx = useOptionList();
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Option children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  const selected = ctx.selected.has(value);
  return (
    <div
      {...props}
      id={optionDomId(ctx.listId, value)}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-selected={selected ? '' : undefined}
      data-highlighted={ctx.highlighted === value ? '' : undefined}
      className={cx(styles.option, className)}
      onMouseDown={composeHandlers(onMouseDown, (event: MouseEvent<HTMLDivElement>) => {
        const list = event.currentTarget.closest('[role="listbox"]');
        if (list instanceof HTMLElement && list.tabIndex < 0) event.preventDefault();
      })}
      onClick={composeHandlers(onClick, () => {
        if (disabled) return;
        ctx.select(value, true);
      })}
    >
      {label}
    </div>
  );
}

export function OptionList(props: OptionListProps) {
  const {
    children,
    className,
    id,
    tabIndex,
    activeValue: activeValueProp,
    onActiveChange,
    selectionMode: _selectionMode,
    value: _value,
    onChange: _onChange,
    onKeyDown: onKeyDownProp,
    onPointerUp,
    onPointerCancel,
    ...rest
  } = props;
  const autoId = useId();
  const listId = id ?? autoId;
  const multiple = isMultiple(props);
  const options = collectOptions(children);
  const enabled = options.filter((option) => !option.disabled).map((option) => option.value);
  const selected = useMemo(() => {
    if (isMultiple(props)) return new Set(props.value);
    return new Set(props.value ? [props.value] : []);
  }, [props]);
  const selectedFirst = isMultiple(props) ? (props.value[0] ?? null) : props.value;
  const [active, setActive] = useState<string | null>(selectedFirst ?? enabled[0] ?? null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const uncontrolledActive = active && enabled.includes(active) ? active : (enabled[0] ?? null);
  const activeValue =
    activeValueProp !== undefined
      ? activeValueProp && enabled.includes(activeValueProp)
        ? activeValueProp
        : (enabled[0] ?? null)
      : uncontrolledActive;

  const select = useCallback(
    (value: string, fromPointer = false) => {
      if (isMultiple(props)) {
        props.onChange(
          props.value.includes(value) ? props.value.filter((item) => item !== value) : [...props.value, value],
        );
      } else {
        props.onChange(value);
      }
      setActive(value);
      setHighlighted(fromPointer ? null : value);
      onActiveChange?.(value);
    },
    [onActiveChange, props],
  );

  function move(next: string | undefined) {
    if (!next) return;
    setActive(next);
    setHighlighted(next);
    onActiveChange?.(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (enabled.length === 0) return;
    const index = activeValue ? enabled.indexOf(activeValue) : -1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(enabled[Math.min(index + 1, enabled.length - 1)] ?? enabled[0]);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(enabled[Math.max(index - 1, 0)] ?? enabled[0]);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      move(enabled[0]);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      move(enabled[enabled.length - 1]);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (!activeValue) return;
      event.preventDefault();
      select(activeValue);
    }
  }

  const ctx = useMemo<OptionListContextValue>(
    () => ({
      listId,
      selectionMode: multiple ? 'multiple' : 'single',
      selected,
      highlighted: activeValueProp !== undefined ? activeValue : highlighted,
      select,
    }),
    [activeValue, activeValueProp, highlighted, listId, multiple, select, selected],
  );

  return (
    <OptionListContext.Provider value={ctx}>
      <div
        {...rest}
        role="listbox"
        id={listId}
        tabIndex={tabIndex ?? 0}
        aria-multiselectable={multiple || undefined}
        aria-activedescendant={activeValue ? optionDomId(listId, activeValue) : undefined}
        data-selection-mode={multiple ? 'multiple' : 'single'}
        className={cx(styles.list, className)}
        onKeyDown={composeHandlers(onKeyDownProp, onKeyDown)}
        onPointerUp={composeHandlers(onPointerUp, () => setHighlighted(null))}
        onPointerCancel={composeHandlers(onPointerCancel, () => setHighlighted(null))}
      >
        {children}
      </div>
    </OptionListContext.Provider>
  );
}

OptionList.Option = Option;
