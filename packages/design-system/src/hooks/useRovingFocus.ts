import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useControlledState } from './useControlledState';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export type UseRovingFocusOptions = {
  /** Which arrow keys move focus. Horizontal keys follow the container's `direction`. */
  orientation?: RovingOrientation;
  /** Wrap from the last item to the first and back. */
  loop?: boolean;
  /** Typing a printable character focuses the next item whose text starts with it. */
  typeahead?: boolean;
  /** Controlled tab stop. `null` is controlled with no preference: the first enabled item. */
  activeValue?: string | null;
  defaultActiveValue?: string | null;
  /** Fires when an item takes focus, from a key, a click or a script. */
  onActiveValueChange?: (value: string) => void;
};

export type RovingItemOptions = {
  disabled?: boolean;
  /** Typeahead text. Default is the item's text content. */
  textValue?: string;
};

// Method syntax keeps handlers for narrower elements, such as a div's, assignable.
export type RovingContainerUserProps = {
  onKeyDown?(event: KeyboardEvent<HTMLElement>): void;
  ref?: Ref<HTMLElement | null>;
};

export type RovingContainerWire = {
  ref: (node: HTMLElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export type RovingItemUserProps = {
  onFocus?(event: FocusEvent<HTMLElement>): void;
};

export type RovingItemWire = {
  tabIndex: 0 | -1;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  'data-todae-roving': string;
  'data-todae-roving-value': string;
  'data-todae-roving-disabled': '' | undefined;
  'data-todae-roving-text': string | undefined;
};

export type UseRovingFocusResult = {
  /** The item that holds the single tab stop. */
  activeValue: string | null;
  /** Moves the tab stop without moving focus. */
  setActiveValue: (value: string) => void;
  /** Focuses the enabled item with this value. Returns false when there is none. */
  focus: (value: string) => boolean;
  /** Focuses the first enabled item and returns its value. */
  focusFirst: () => string | null;
  /** Focuses the last enabled item and returns its value. */
  focusLast: () => string | null;
  /** The enabled item element with this value, or null. */
  getItemNode: (value: string) => HTMLElement | null;
  /** Enabled item values in document order, read from the DOM. */
  values: () => string[];
  getContainerProps: <P extends RovingContainerUserProps>(props?: P) => Omit<P, keyof RovingContainerWire> & RovingContainerWire;
  getItemProps: <P extends RovingItemUserProps>(
    value: string,
    options?: RovingItemOptions,
    props?: P,
  ) => Omit<P, keyof RovingItemWire> & RovingItemWire;
};

const TYPEAHEAD_RESET_MS = 500;

function assignRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function nextKey(key: string, orientation: RovingOrientation, rtl: boolean): 'next' | 'prev' | null {
  const vertical = orientation !== 'horizontal';
  const horizontal = orientation !== 'vertical';
  if (vertical && key === 'ArrowDown') return 'next';
  if (vertical && key === 'ArrowUp') return 'prev';
  if (horizontal && key === 'ArrowRight') return rtl ? 'prev' : 'next';
  if (horizontal && key === 'ArrowLeft') return rtl ? 'next' : 'prev';
  return null;
}

/**
 * One tab stop for a composite widget: tabs, menu items, toolbar buttons.
 * Arrow keys, Home and End move focus between items; Tab leaves the group.
 * Items are found in the DOM by an attribute this hook owns, so an item inside
 * a company's own wrapper still takes part, and order is document order.
 */
export function useRovingFocus(options: UseRovingFocusOptions = {}): UseRovingFocusResult {
  const {
    orientation = 'vertical',
    loop = true,
    typeahead = false,
    activeValue: activeProp,
    defaultActiveValue,
    onActiveValueChange,
  } = options;
  const scope = useId();
  const [active, setActive] = useControlledState(activeProp, defaultActiveValue ?? null);
  // The value that holds tabIndex 0. It follows `active`, falling back to the
  // first enabled item when `active` is null, disabled or not rendered.
  const [tabStop, setTabStop] = useState<string | null>(active);
  const containerRef = useRef<HTMLElement | null>(null);
  const buffer = useRef({ text: '', at: 0 });

  const items = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];
    const all = container.querySelectorAll<HTMLElement>('[data-todae-roving]');
    return [...all].filter(
      (node) => node.getAttribute('data-todae-roving') === scope && !node.hasAttribute('data-todae-roving-disabled'),
    );
  }, [scope]);

  const valueOf = (node: HTMLElement) => node.getAttribute('data-todae-roving-value') ?? '';

  const values = useCallback(() => items().map(valueOf), [items]);

  // Items can appear, move or turn disabled without this hook's owner
  // rendering, so re-check after every render and on DOM changes.
  const syncTabStop = () => {
    const enabled = values();
    const next = active !== null && enabled.includes(active) ? active : (enabled[0] ?? null);
    setTabStop((prev) => (prev === next ? prev : next));
  };
  const latestSync = useRef(syncTabStop);
  useLayoutEffect(() => {
    latestSync.current = syncTabStop;
  });
  useLayoutEffect(syncTabStop);

  // Watch whichever element is the container now, including one that mounts
  // after the owner or replaces an earlier one.
  const observer = useRef<MutationObserver | null>(null);
  const setContainer = useCallback((node: HTMLElement | null) => {
    if (containerRef.current === node) return;
    containerRef.current = node;
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof MutationObserver === 'undefined') return;
    observer.current = new MutationObserver(() => latestSync.current());
    observer.current.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-todae-roving-disabled', 'data-todae-roving-value'],
    });
    latestSync.current();
  }, []);
  useLayoutEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
    },
    [],
  );

  const commit = useCallback(
    (value: string) => {
      setTabStop(value);
      if (value === active) return;
      setActive(value);
      onActiveValueChange?.(value);
    },
    [active, onActiveValueChange, setActive],
  );

  const getItemNode = useCallback(
    (value: string): HTMLElement | null => items().find((node) => valueOf(node) === value) ?? null,
    [items],
  );

  const focus = useCallback(
    (value: string): boolean => {
      const node = getItemNode(value);
      node?.focus();
      return node !== null;
    },
    [getItemNode],
  );

  const focusEdge = useCallback(
    (edge: 'first' | 'last'): string | null => {
      const nodes = items();
      const node = edge === 'first' ? nodes[0] : nodes.at(-1);
      if (!node) return null;
      node.focus();
      return valueOf(node);
    },
    [items],
  );

  const focusFirst = useCallback(() => focusEdge('first'), [focusEdge]);
  const focusLast = useCallback(() => focusEdge('last'), [focusEdge]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.getAttribute('data-todae-roving') !== scope) return;
      const nodes = items();
      if (nodes.length === 0) return;
      const index = nodes.indexOf(target);
      const container = containerRef.current;
      const rtl = container ? getComputedStyle(container).direction === 'rtl' : false;
      let next: HTMLElement | undefined;
      const step = nextKey(event.key, orientation, rtl);
      if (step === 'next') {
        next = index + 1 < nodes.length ? nodes[index + 1] : loop ? nodes[0] : undefined;
      } else if (step === 'prev') {
        next = index > 0 ? nodes[index - 1] : loop ? nodes.at(-1) : undefined;
      } else if (event.key === 'Home') {
        next = nodes[0];
      } else if (event.key === 'End') {
        next = nodes.at(-1);
      } else if (typeahead && event.key.length === 1 && event.key !== ' ') {
        const state = buffer.current;
        const now = event.timeStamp;
        state.text = now - state.at > TYPEAHEAD_RESET_MS ? event.key : state.text + event.key;
        state.at = now;
        const query = state.text.toLowerCase();
        const text = (node: HTMLElement) =>
          (node.getAttribute('data-todae-roving-text') ?? node.textContent ?? '').trim().toLowerCase();
        // One letter, or the same letter repeated, cycles through the items
        // that start with it; a longer prefix keeps matching the current item.
        const cycling = [...query].every((char) => char === query[0]);
        const needle = cycling ? query.slice(0, 1) : query;
        const start = cycling ? index + 1 : Math.max(index, 0);
        const ordered = [...nodes.slice(start), ...nodes.slice(0, start)];
        next = ordered.find((node) => text(node).startsWith(needle));
        if (!next) return;
      } else {
        return;
      }
      event.preventDefault();
      next?.focus();
    },
    [items, loop, orientation, scope, typeahead],
  );

  const getContainerProps = useCallback(
    <P extends RovingContainerUserProps>(props?: P): Omit<P, keyof RovingContainerWire> & RovingContainerWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        ref: (node: HTMLElement | null) => {
          setContainer(node);
          assignRef(user.ref, node);
        },
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          user.onKeyDown?.(event);
          if (!event.defaultPrevented) onKeyDown(event);
        },
      };
    },
    [onKeyDown, setContainer],
  );

  const getItemProps = useCallback(
    <P extends RovingItemUserProps>(
      value: string,
      itemOptions: RovingItemOptions = {},
      props?: P,
    ): Omit<P, keyof RovingItemWire> & RovingItemWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        tabIndex: value === tabStop && !itemOptions.disabled ? 0 : -1,
        onFocus: (event: FocusEvent<HTMLElement>) => {
          user.onFocus?.(event);
          if (event.target !== event.currentTarget || itemOptions.disabled) return;
          commit(value);
        },
        'data-todae-roving': scope,
        'data-todae-roving-value': value,
        'data-todae-roving-disabled': itemOptions.disabled ? '' : undefined,
        'data-todae-roving-text': itemOptions.textValue,
      };
    },
    [commit, scope, tabStop],
  );

  return {
    activeValue: tabStop,
    setActiveValue: commit,
    focus,
    focusFirst,
    focusLast,
    getItemNode,
    values,
    getContainerProps,
    getItemProps,
  };
}
