import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { optionDomId } from './OptionList.ids';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './OptionList.module.css';

/** `id` is derived from the list and value so `aria-activedescendant` can point at it. */
export type OptionListOptionProps = {
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

export type OptionListRootProps = OptionListSingleProps | OptionListMultipleProps;

type OptionListContextValue = {
  listId: string;
  selectionMode: 'single' | 'multiple';
  selected: ReadonlySet<string>;
  highlighted: string | null;
  select: (value: string, fromPointer?: boolean) => void;
  register: (entry: OptionEntry) => () => void;
};

type OptionEntry = { value: string; disabled: boolean; node: HTMLElement };

const OptionListContext = createContext<OptionListContextValue | null>(null);

function useOptionList(): OptionListContextValue {
  const ctx = useContext(OptionListContext);
  if (!ctx) throw new Error('OptionList.Option must render inside OptionList.Root');
  return ctx;
}

function isMultiple(props: OptionListRootProps): props is OptionListMultipleProps {
  return props.selectionMode === 'multiple';
}

// Options register themselves instead of being found by component type, so an
// Option inside a company's wrapper, a fragment or any other element still
// counts. Keyboard order is document order.
function byDocumentOrder(a: OptionEntry, b: OptionEntry): number {
  return a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

// Server-render hint only, used until options have registered: direct Option
// children, looking through fragments.
function hintOptions(children: ReactNode): { value: string; disabled: boolean }[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: unknown; disabled?: boolean; children?: ReactNode }>(child)) return [];
    if (child.type === OptionListOption && typeof child.props.value === 'string') {
      return [{ value: child.props.value, disabled: Boolean(child.props.disabled) }];
    }
    return child.type === Fragment ? hintOptions(child.props.children) : [];
  });
}

function OptionListOption({
  value,
  children,
  disabled,
  className,
  onMouseDown,
  onClick,
  ref,
  ...props
}: OptionListOptionProps) {
  const ctx = useOptionList();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const refs = useComposedRefs(nodeRef, ref);
  const { register } = ctx;
  useLayoutEffect(() => {
    if (!nodeRef.current) return;
    return register({ value, disabled: Boolean(disabled), node: nodeRef.current });
  }, [disabled, register, value]);
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('OptionList.Option children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  const selected = ctx.selected.has(value);
  return (
    <div
      {...props}
      ref={refs}
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

function OptionListRoot(props: OptionListRootProps) {
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
    ref,
    ...rest
  } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listRefs = useComposedRefs(listRef, ref);
  const autoId = useId();
  const listId = id ?? autoId;
  const multiple = isMultiple(props);
  // Registration only records the option; ordering happens once per render
  // below, so mounting N options costs one sort, not N.
  const registered = useRef(new Set<OptionEntry>());
  const [entries, setEntries] = useState<readonly OptionEntry[]>([]);
  const [, registrationChanged] = useReducer((n: number) => n + 1, 0);
  const register = useCallback((entry: OptionEntry) => {
    registered.current.add(entry);
    registrationChanged();
    return () => {
      registered.current.delete(entry);
      registrationChanged();
    };
  }, []);
  // Keyed options can move without re-registering, and a wrapper can move them
  // from its own state without this list rendering; re-sort when they do.
  const resort = useCallback(() => {
    const sorted = [...registered.current].sort(byDocumentOrder);
    setEntries((prev) =>
      prev.length === sorted.length && sorted.every((entry, i) => entry === prev[i]) ? prev : sorted,
    );
  }, []);
  useLayoutEffect(resort);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(resort);
    observer.observe(list, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [resort]);
  const known = entries.length > 0 || registered.current.size > 0 ? entries : hintOptions(children);
  const enabled = known.filter((option) => !option.disabled).map((option) => option.value);
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

  const shown = activeValueProp !== undefined ? activeValue : highlighted;
  // aria-activedescendant moves no focus, so nothing scrolls the option into
  // view: scroll its nearest scroll box, never the page. Reveal when the
  // activeValue prop changes or, uncontrolled, when the keyboard moves the
  // highlight; never on mount.
  const target = activeValueProp !== undefined ? activeValueProp : highlighted;
  const lastTarget = useRef(target);
  useLayoutEffect(() => {
    const changed = lastTarget.current !== target;
    lastTarget.current = target;
    const list = listRef.current;
    // A list in a closed popover has no layout; it is revealed when it opens.
    if (!changed || !target || !list || list.checkVisibility?.() === false) return;
    reveal(list, optionDomId(listId, target));
  }, [listId, target]);
  // Opening a popover or dialog lays the list out: reveal the active option then.
  const activeId = activeValue ? optionDomId(listId, activeValue) : null;
  useLayoutEffect(() => {
    const surface = listRef.current?.closest('[popover], dialog');
    if (!surface || !activeId) return;
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'open' && listRef.current) reveal(listRef.current, activeId);
    };
    surface.addEventListener('toggle', onToggle);
    return () => surface.removeEventListener('toggle', onToggle);
  }, [activeId]);

  const ctx = useMemo<OptionListContextValue>(
    () => ({
      listId,
      selectionMode: multiple ? 'multiple' : 'single',
      selected,
      highlighted: shown,
      select,
      register,
    }),
    [shown, listId, multiple, register, select, selected],
  );

  return (
    <OptionListContext.Provider value={ctx}>
      <div
        {...rest}
        ref={listRefs}
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

function scrollsY(element: Element): boolean {
  const overflow = element.ownerDocument.defaultView?.getComputedStyle(element).overflowY;
  return (overflow === 'auto' || overflow === 'scroll') && element.scrollHeight > element.clientHeight;
}

function reveal(list: HTMLElement, id: string) {
  // The root node finds the option by id inside a shadow root too.
  const root = list.getRootNode() as Document | ShadowRoot;
  const option = 'getElementById' in root ? root.getElementById(id) : null;
  if (option) revealInScrollBox(option);
}

function px(value: string): number {
  return parseFloat(value) || 0;
}

/** scroll-padding can be a percentage of the scrollport. */
function scrollPadding(value: string, box: Element): number {
  return value.endsWith('%') ? (parseFloat(value) / 100) * box.clientHeight : px(value);
}

/**
 * Scrolls `option`'s nearest scroll box by the least amount, inside the box's
 * border, padding and scroll-padding. The search stops at a popover or dialog
 * and never reaches the page, so a list on the page doesn't scroll it.
 */
function revealInScrollBox(option: HTMLElement) {
  const doc = option.ownerDocument;
  let box: Element | null = option.parentElement;
  while (box && box !== doc.body && box !== doc.documentElement && !scrollsY(box)) {
    box = box.matches('[popover], dialog') ? null : box.parentElement;
  }
  if (!box || box === doc.body || box === doc.documentElement) return;
  const style = doc.defaultView!.getComputedStyle(box);
  const boxTop = box.getBoundingClientRect().top + box.clientTop;
  const top = boxTop + px(style.paddingTop) + scrollPadding(style.scrollPaddingTop, box);
  const bottom = boxTop + box.clientHeight - px(style.paddingBottom) - scrollPadding(style.scrollPaddingBottom, box);
  const rect = option.getBoundingClientRect();
  if (rect.top < top) box.scrollTop -= top - rect.top;
  else if (rect.bottom > bottom) box.scrollTop += rect.bottom - bottom;
}

export const OptionList = { Root: OptionListRoot, Option: OptionListOption } as const;
