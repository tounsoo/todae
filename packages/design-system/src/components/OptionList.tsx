import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import styles from './OptionList.module.css';

export type OptionProps = {
  value: string;
  children: string;
  disabled?: boolean;
};

type OptionListBase = {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
};

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

function collectOptions(children: ReactNode): OptionProps[] {
  return Children.toArray(children).filter(isOptionElement).map((child) => child.props);
}

function optionDomId(listId: string, value: string): string {
  return `${listId}-opt-${value.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function Option({ value, children, disabled }: OptionProps) {
  const ctx = useOptionList();
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('Option children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  const selected = ctx.selected.has(value);
  return (
    <div
      id={optionDomId(ctx.listId, value)}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-selected={selected ? '' : undefined}
      data-highlighted={ctx.highlighted === value ? '' : undefined}
      className={styles.option}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
      }}
      onClick={() => {
        if (disabled) return;
        ctx.select(value, true);
      }}
    >
      {label}
    </div>
  );
}

export function OptionList(props: OptionListProps) {
  const { children, className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby } = props;
  const listId = useId();
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
  const activeValue = active && enabled.includes(active) ? active : (enabled[0] ?? null);

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
    },
    [props],
  );

  function move(next: string | undefined) {
    if (!next) return;
    setActive(next);
    setHighlighted(next);
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
      highlighted,
      select,
    }),
    [highlighted, listId, multiple, select, selected],
  );

  return (
    <OptionListContext.Provider value={ctx}>
      <div
        role="listbox"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        aria-multiselectable={multiple || undefined}
        aria-activedescendant={activeValue ? optionDomId(listId, activeValue) : undefined}
        data-selection-mode={multiple ? 'multiple' : 'single'}
        className={[styles.list, className].filter(Boolean).join(' ')}
        onKeyDown={onKeyDown}
        onPointerUp={() => setHighlighted(null)}
        onPointerCancel={() => setHighlighted(null)}
      >
        {children}
      </div>
    </OptionListContext.Provider>
  );
}

OptionList.Option = Option;
