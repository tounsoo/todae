import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import {
  useRovingFocus,
  type RovingItemUserProps,
  type RovingItemWire,
  type UseRovingFocusResult,
} from '../hooks/useRovingFocus.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { ChevronGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { useDomId } from '../internal/domId.js';
import styles from './Tree.module.css';

export type TreeRootProps = {
  /** Controlled selected item. `null` selects none. Pass with onValueChange. */
  value?: string | null;
  /** Initial selected item when uncontrolled. */
  defaultValue?: string | null;
  /** Fires with the item a click, Enter or Space selects. A tree given none of value, defaultValue and onValueChange has no selection. */
  onValueChange?: (value: string) => void;
  /** Controlled open items. Pass with onExpandedChange. */
  expanded?: string[];
  /** Initial open items when uncontrolled. */
  defaultExpanded?: string[];
  /** Fires with the open items after an item opens or closes. */
  onExpandedChange?: (expanded: string[]) => void;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'ul'>, 'role' | 'children' | 'defaultValue' | 'onChange'>;

export type TreeItemProps = {
  /** Names the item for selection and for `expanded`. Unique in the tree. */
  value: string;
  /** Can't be selected. Still takes focus, so a screen reader announces it as unavailable, and still opens and closes. */
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'li'>, 'role' | 'value' | 'children' | 'tabIndex'>;

export type TreeLabelProps = {
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'id' | 'children'>;

export type TreeGroupProps = {
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'ul'>, 'role' | 'hidden' | 'children'>;

export type TreeIconProps = ComponentPropsWithRef<'span'>;

// What items read from the root lives in this store, not in context, so a
// change renders only the items it concerns: a click in a tree of a thousand
// items renders the two or three it changes, not all of them.
type TreeState = { selected: string | null; expanded: ReadonlySet<string>; tabStop: string | null };

const SELECTED = 1;
const EXPANDED = 2;
const TAB_STOP = 4;

type TreeStore = {
  /** The item's flags as one number, so useSyncExternalStore compares them by value. */
  flags: (value: string) => number;
  /** Calls the listener when this item's flags may have changed. */
  subscribe: (value: string, listener: () => void) => () => void;
  /** Takes the root's latest state and tells only the items whose flags changed. */
  set: (next: TreeState) => void;
};

function createTreeStore(initial: TreeState): TreeStore {
  let state = initial;
  const listeners = new Map<string, Set<() => void>>();
  return {
    flags: (value) =>
      (state.selected === value ? SELECTED : 0) |
      (state.expanded.has(value) ? EXPANDED : 0) |
      (state.tabStop === value ? TAB_STOP : 0),
    subscribe(value, listener) {
      let set = listeners.get(value);
      if (!set) listeners.set(value, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0 && listeners.get(value) === set) listeners.delete(value);
      };
    },
    set(next) {
      const prev = state;
      if (prev.selected === next.selected && prev.expanded === next.expanded && prev.tabStop === next.tabStop) return;
      state = next;
      const changed = new Set<string | null>([prev.selected, next.selected, prev.tabStop, next.tabStop]);
      if (prev.expanded !== next.expanded) {
        for (const value of prev.expanded) if (!next.expanded.has(value)) changed.add(value);
        for (const value of next.expanded) if (!prev.expanded.has(value)) changed.add(value);
      }
      for (const value of changed) {
        if (value === null) continue;
        for (const listener of [...(listeners.get(value) ?? [])]) listener();
      }
    },
  };
}

// Every field keeps its identity across the root's renders, so a click or a
// key that only moves selection, focus or an open item renders no item
// through context.
type TreeContextValue = {
  selectable: boolean;
  select: (value: string) => void;
  setExpanded: (value: string, open: boolean) => void;
  store: TreeStore;
  /** The roving item props, whose tab stop the item takes from the store. */
  itemProps: <P extends RovingItemUserProps>(value: string, props: P) => Omit<P, keyof RovingItemWire> & RovingItemWire;
  isTypingAhead: UseRovingFocusResult['isTypingAhead'];
};

const TreeContext = /* @__PURE__ */ createContext<TreeContextValue | null>(null);

type ItemContextValue = {
  value: string;
  labelId: string;
  branch: boolean;
  expanded: boolean;
  disabled: boolean;
  /** Tree.Group calls this while it is mounted, which makes the item a branch. */
  registerGroup: () => () => void;
};

const ItemContext = /* @__PURE__ */ createContext<ItemContextValue | null>(null);

// Depth of the items rendered here: 1 at the root, one more inside each group.
const LevelContext = /* @__PURE__ */ createContext(1);

function useTree(part: string): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error(`Tree.${part} must render inside Tree.Root`);
  return ctx;
}

function useItem(part: string): ItemContextValue {
  const ctx = useContext(ItemContext);
  if (!ctx) throw new Error(`Tree.${part} must render inside Tree.Item`);
  return ctx;
}

const EMPTY: string[] = [];

function Root({
  value: valueProp,
  defaultValue,
  onValueChange,
  expanded: expandedProp,
  defaultExpanded,
  onExpandedChange,
  children,
  className,
  ref,
  onKeyDown,
  onFocus,
  onBlur,
  ...props
}: TreeRootProps) {
  // Without any of these the tree has no selection: items only open and close.
  const selectable = valueProp !== undefined || defaultValue !== undefined || onValueChange !== undefined;
  const [selected, setSelected] = useControlledState<string | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange &&
      ((next) => {
        if (next !== null) onValueChange(next);
      }),
  );
  const [expanded, setExpandedList, latestExpanded] = useControlledState(
    expandedProp,
    defaultExpanded ?? EMPTY,
    onExpandedChange,
  );
  // Builds on the latest write, so it keeps its identity across renders.
  const setExpanded = useCallback(
    (value: string, open: boolean) => {
      const list = latestExpanded();
      if (list.includes(value) === open) return;
      setExpandedList(open ? [...list, value] : list.filter((v) => v !== value));
    },
    [latestExpanded, setExpandedList],
  );
  const open = useMemo(() => new Set(expanded), [expanded]);
  // The tab stop is the selected item, except while focus moves inside the
  // tree: then it is the focused item. Leaving the tree returns it to the
  // selected item, so focus enters on the selected item.
  const [navigating, setNavigating] = useState<string | null>(null);
  const roving = useRovingFocus({
    tree: true,
    typeahead: true,
    activeValue: navigating ?? selected,
    onActiveValueChange: setNavigating,
    onExpandedChange: setExpanded,
  });
  const tabStop = roving.activeValue;
  const [store] = useState(() => createTreeStore({ selected, expanded: open, tabStop }));
  // After the root commits, the items whose flags changed render again,
  // still before paint.
  useLayoutEffect(() => store.set({ selected, expanded: open, tabStop }), [store, selected, open, tabStop]);
  // getItemProps changes with the tab stop, which each item reads from the
  // store instead, so items call the latest one through a stable function.
  // The rest of what it returns keeps its value across renders.
  const latestRoving = useRef(roving);
  useLayoutEffect(() => {
    latestRoving.current = roving;
  });
  const itemProps = useCallback(
    <P extends RovingItemUserProps>(value: string, props: P) => latestRoving.current.getItemProps(value, {}, props),
    [],
  );
  const { isTypingAhead } = roving;
  const focusLeave = useFocusLeave(useCallback(() => setNavigating(null), []));
  const container = roving.getContainerProps({ ref, onKeyDown });
  const ctx = useMemo(
    () => ({ selectable, select: setSelected, setExpanded, store, itemProps, isTypingAhead }),
    [isTypingAhead, itemProps, selectable, setExpanded, setSelected, store],
  );
  return (
    <TreeContext.Provider value={ctx}>
      <LevelContext.Provider value={1}>
        <ul
          {...props}
          {...container}
          role="tree"
          className={cx(styles.root, className)}
          onFocus={(event: FocusEvent<HTMLUListElement>) => {
            onFocus?.(event);
            focusLeave.onFocus();
          }}
          // The tab stop must return to the selected item whatever the
          // consumer's handler does, so this runs even if it prevented the event.
          onBlur={(event: FocusEvent<HTMLUListElement>) => {
            onBlur?.(event);
            focusLeave.onBlur(event);
          }}
        >
          {children}
        </ul>
      </LevelContext.Provider>
    </TreeContext.Provider>
  );
}

// Before Tree.Group registers, as in server HTML, a direct Tree.Group child
// marks a branch. Registration corrects the guess after hydration, so a
// wrapped group still counts.
const hasGroupChild = (children: ReactNode) =>
  Children.toArray(children).some((child) => isValidElement(child) && child.type === Group);

function Item({ value, disabled = false, children, className, style, onKeyDown, ...props }: TreeItemProps) {
  const tree = useTree('Item');
  const level = useContext(LevelContext);
  const id = useDomId();
  const labelId = `${id}-label`;
  const [groups, setGroups] = useState<number | null>(null);
  const branch = groups === null ? hasGroupChild(children) : groups > 0;
  const { store } = tree;
  const subscribe = useCallback((listener: () => void) => store.subscribe(value, listener), [store, value]);
  const flags = useSyncExternalStore(subscribe, () => store.flags(value), () => store.flags(value));
  const expanded = branch && (flags & EXPANDED) !== 0;
  const registerGroup = useCallback(() => {
    setGroups((n) => (n ?? 0) + 1);
    return () => setGroups((n) => (n ?? 1) - 1);
  }, []);
  const node = useRef<HTMLLIElement | null>(null);
  // Closing an item that holds focus would drop focus on the page; keep it
  // on the item that closed.
  useLayoutEffect(() => {
    const li = node.current;
    if (expanded || !li) return;
    const active = li.ownerDocument.activeElement;
    if (active && active !== li && li.contains(active)) li.focus();
  }, [expanded]);
  const { ref, ...item } = tree.itemProps(value, props);
  const refs = useComposedRefs(node, ref);
  const ctx = useMemo(
    () => ({ value, labelId, branch, expanded, disabled, registerGroup }),
    [branch, disabled, expanded, labelId, registerGroup, value],
  );
  const selected = (flags & SELECTED) !== 0;
  return (
    <ItemContext.Provider value={ctx}>
      <li
        {...item}
        tabIndex={flags & TAB_STOP ? 0 : -1}
        ref={refs}
        role="treeitem"
        aria-labelledby={labelId}
        aria-expanded={branch ? expanded : undefined}
        aria-selected={tree.selectable ? selected : undefined}
        aria-disabled={disabled || undefined}
        data-selected={selected ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        className={cx(styles.item, className)}
        style={{ ...style, '--_level': level } as CSSProperties}
        onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLLIElement>) => {
          // Keys from an item nested inside belong to that item.
          if (event.target !== event.currentTarget) return;
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          // A Space that joins a typeahead search is the search's.
          if (event.key === ' ' && tree.isTypingAhead(event)) return;
          event.preventDefault();
          if (!disabled && tree.selectable) tree.select(value);
          if (branch) tree.setExpanded(value, !expanded);
        })}
      >
        {children}
      </li>
    </ItemContext.Provider>
  );
}

function Label({ children, className, onClick, ...props }: TreeLabelProps) {
  const tree = useTree('Label');
  const item = useItem('Label');
  const { chevron } = useGlyphs();
  return (
    <div
      {...props}
      id={item.labelId}
      className={cx(styles.label, className)}
      data-todae-focus-ring=""
      // A click selects the item and opens or closes a branch.
      onClick={composeHandlers(onClick, () => {
        if (!item.disabled && tree.selectable) tree.select(item.value);
        if (item.branch) tree.setExpanded(item.value, !item.expanded);
      })}
    >
      <span className={styles.chevron} data-todae-glyph="" aria-hidden="true">
        {glyphOr(chevron, <ChevronGlyph />)}
      </span>
      {children}
    </div>
  );
}

function Group({ children, className, ...props }: TreeGroupProps) {
  const item = useItem('Group');
  const level = useContext(LevelContext);
  const { registerGroup } = item;
  useLayoutEffect(registerGroup, [registerGroup]);
  return (
    <LevelContext.Provider value={level + 1}>
      <ul {...props} role="group" hidden={!item.expanded} className={cx(styles.group, className)}>
        {children}
      </ul>
    </LevelContext.Provider>
  );
}

function Icon({ className, ...props }: TreeIconProps) {
  return <span aria-hidden="true" {...props} className={cx(styles.icon, className)} />;
}

export const Tree = { Root, Item, Label, Group, Icon } as const;
