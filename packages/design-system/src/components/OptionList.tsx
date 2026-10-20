import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useCallback,
  useContext,
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
import { useDomId } from './domId.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { CheckGlyph, glyphOr } from './glyphs.js';
import { optionDomId } from './OptionList.ids.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
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
  onActiveValueChange?: (value: string | null) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'children' | 'role' | 'defaultValue' | 'onChange'>;

export type OptionListSingleProps = OptionListBase & {
  selectionMode?: 'single';
  value: string | null;
  onValueChange: (value: string) => void;
};

export type OptionListMultipleProps = OptionListBase & {
  selectionMode: 'multiple';
  value: readonly string[];
  onValueChange: (value: string[]) => void;
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

/** `unavailable` (aria-disabled) keeps the option reachable; `disabled` also skips it. Neither can be selected. */
type OptionEntry = { value: string; disabled: boolean; unavailable: boolean; node: HTMLElement };

const OptionListContext = /* @__PURE__ */ createContext<OptionListContextValue | null>(null);

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
  'aria-disabled': ariaDisabled,
  ...props
}: OptionListOptionProps) {
  const ctx = useOptionList();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const refs = useComposedRefs(nodeRef, ref);
  const { register } = ctx;
  const unavailable = ariaDisabled === true || ariaDisabled === 'true';
  useLayoutEffect(() => {
    if (!nodeRef.current) return;
    return register({ value, disabled: Boolean(disabled), unavailable, node: nodeRef.current });
  }, [disabled, register, unavailable, value]);
  if (process.env.NODE_ENV !== 'production' && typeof children !== 'string') {
    console.error('OptionList.Option children must be a string');
  }
  const label = typeof children === 'string' ? children : String(children);
  const selected = ctx.selected.has(value);
  const { check } = useGlyphs();
  return (
    <div
      {...props}
      ref={refs}
      id={optionDomId(ctx.listId, value)}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || unavailable || undefined}
      data-selected={selected ? '' : undefined}
      data-highlighted={ctx.highlighted === value ? '' : undefined}
      className={cx(styles.option, className)}
      onMouseDown={composeHandlers(onMouseDown, (event: MouseEvent<HTMLDivElement>) => {
        const list = event.currentTarget.closest('[role="listbox"]');
        if (list instanceof HTMLElement && list.tabIndex < 0) event.preventDefault();
      })}
      onClick={composeHandlers(onClick, () => ctx.select(value, true))}
    >
      {selected ? (
        <span className={styles.check} data-todae-glyph="" aria-hidden="true">
          {glyphOr(check, <CheckGlyph />)}
        </span>
      ) : null}
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
    onActiveValueChange,
    selectionMode: _selectionMode,
    value: _value,
    onValueChange: _onValueChange,
    onKeyDown: onKeyDownProp,
    onPointerUp,
    onPointerCancel,
    ref,
    ...rest
  } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listRefs = useComposedRefs(listRef, ref);
  const autoId = useDomId();
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
      // Click, Enter and Space all come here.
      const entry = [...registered.current].find((option) => option.value === value);
      if (entry?.disabled || entry?.unavailable) return;
      if (isMultiple(props)) {
        props.onValueChange(
          props.value.includes(value) ? props.value.filter((item) => item !== value) : [...props.value, value],
        );
      } else {
        props.onValueChange(value);
      }
      setActive(value);
      setHighlighted(fromPointer ? null : value);
      onActiveValueChange?.(value);
    },
    [onActiveValueChange, props],
  );

  function move(next: string | undefined) {
    if (!next) return;
    setActive(next);
    setHighlighted(next);
    onActiveValueChange?.(next);
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
  // highlight; never on mount. A requested option that has not rendered yet,
  // such as an async result, is revealed when it renders enabled.
  const target = activeValueProp !== undefined ? activeValueProp : highlighted;
  const lastTarget = useRef(target);
  const pending = useRef<string | null>(null);
  // Every commit, as the requested option can render later than the request.
  useLayoutEffect(() => {
    const changed = lastTarget.current !== target;
    if (changed) {
      lastTarget.current = target;
      pending.current = target;
    }
    const want = pending.current;
    const list = listRef.current;
    if (!want || !list) return;
    // Read the options from the DOM: they may have changed in this commit,
    // before the list re-resolves. A missing or disabled request falls back to
    // the first enabled option, as aria-activedescendant will.
    const requested = findOption(list, optionDomId(listId, want));
    // Settled once its option renders, hidden or not; a missing one is awaited.
    if (requested) pending.current = null;
    else if (!changed) return;
    // Skipped options only: one that is aria-disabled but reachable can be active.
    const usable = requested !== null && ![...registered.current].some((entry) => entry.node === requested && entry.disabled);
    // A late option that arrives disabled does not move the active option.
    if (!changed && !usable) return;
    // A hidden list has no layout; a popover or dialog reveals its active
    // option when it opens (below).
    if (list.checkVisibility?.() === false) return;
    const option = usable
      ? requested
      : [...registered.current].sort(byDocumentOrder).find((entry) => !entry.disabled)?.node;
    if (option) revealInScrollBox(option);
  });
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
        aria-activedescendant={activeId ?? undefined}
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

function findOption(list: HTMLElement, id: string): HTMLElement | null {
  // The root node finds the option by id inside a shadow root too.
  const root = list.getRootNode() as Document | ShadowRoot;
  return 'getElementById' in root ? root.getElementById(id) : null;
}

function reveal(list: HTMLElement, id: string) {
  const option = findOption(list, id);
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
