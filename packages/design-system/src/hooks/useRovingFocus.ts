import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useStableComposedRef } from '../components/props';
import { useControlledState } from './useControlledState';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export type UseRovingFocusOptions = {
  /** Which arrow keys move focus. Horizontal keys follow the container's `direction`. */
  orientation?: RovingOrientation;
  /** Wrap from the last item to the first and back. */
  loop?: boolean;
  /** Typing a printable character focuses the next item whose text starts with it. */
  typeahead?: boolean;
  /**
   * Keep one item tabbable. False for a widget focus only enters from code,
   * such as a menu opened from its trigger: every item gets tabIndex -1, and
   * the hook skips tracking the tab stop.
   */
  tabStop?: boolean;
  /** Controlled tab stop. `null` is controlled with no preference: the first enabled item. */
  activeValue?: string | null;
  defaultActiveValue?: string | null;
  /** Fires when an item other than the active one takes focus, from a key, a click or a script. */
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
  /** Focuses the enabled item with this value. Returns false when there is none focus can reach. */
  focus: (value: string) => boolean;
  /** Focuses the first enabled item and returns its value. */
  focusFirst: () => string | null;
  /** Focuses the last enabled item and returns its value. */
  focusLast: () => string | null;
  /** True while a typeahead search is under way, when a Space adds to it instead of activating. */
  isTypingAhead: (event: { timeStamp: number }) => boolean;
  /** The element of the enabled item with this value that focus can reach, or null. */
  getItemNode: (value: string) => HTMLElement | null;
  /** Enabled item values in document order, read from the DOM. */
  values: () => string[];
  /** Enabled item elements focus can reach now, in document order: not inert and not hidden by style. */
  reachableItems: () => HTMLElement[];
  getContainerProps: <P extends RovingContainerUserProps>(props?: P) => Omit<P, keyof RovingContainerWire> & RovingContainerWire;
  getItemProps: <P extends RovingItemUserProps>(
    value: string,
    options?: RovingItemOptions,
    props?: P,
  ) => Omit<P, keyof RovingItemWire> & RovingItemWire;
};

const TYPEAHEAD_RESET_MS = 500;

type KnownItems = { read: boolean; enabled: string[]; reachable: string[] };

const NO_ITEMS: KnownItems = { read: false, enabled: [], reachable: [] };

// `visibility: hidden` blocks focus too, so it counts as hidden.
export const isReachable = (node: HTMLElement) =>
  !node.closest('[inert]') && (node.checkVisibility?.({ visibilityProperty: true }) ?? true);

const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// `rtl` is a function so direction, which costs a style read, is only
// checked for Left and Right.
export function nextKey(key: string, orientation: RovingOrientation, rtl: () => boolean): 'next' | 'prev' | null {
  const vertical = orientation !== 'horizontal';
  const horizontal = orientation !== 'vertical';
  if (vertical && key === 'ArrowDown') return 'next';
  if (vertical && key === 'ArrowUp') return 'prev';
  if (horizontal && key === 'ArrowRight') return rtl() ? 'prev' : 'next';
  if (horizontal && key === 'ArrowLeft') return rtl() ? 'next' : 'prev';
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
    tabStop: keepTabStop = true,
    activeValue: activeProp,
    defaultActiveValue,
    onActiveValueChange,
  } = options;
  const scope = useId();
  const [active, setActive] = useControlledState(activeProp, defaultActiveValue ?? null);
  // The items last read from the DOM: enabled ones, and of those the ones
  // focus can reach now. The tab stop is derived from these and `active`
  // during render, so a new `active` takes the tab stop in the same render.
  const [known, setKnown] = useState<KnownItems>(NO_ITEMS);
  const containerRef = useRef<HTMLElement | null>(null);
  const buffer = useRef({ text: '', at: 0 });

  // Enabled items, by attribute alone. These decide the tab stop, so a group
  // that renders while hidden still has one when it is shown.
  const enabledItems = useCallback((): HTMLElement[] => {
    const container = containerRef.current;
    if (!container) return [];
    // The scope comes from useId, which never contains a quote or backslash.
    return [
      ...container.querySelectorAll<HTMLElement>(
        `[data-todae-roving="${scope}"]:not([data-todae-roving-disabled]):not([hidden]):not(:disabled)`,
      ),
    ];
  }, [scope]);

  // Of those, the ones focus can move to now: not inert and not hidden by
  // style. Read only when moving, since checking visibility costs a style pass.
  const items = useCallback((): HTMLElement[] => enabledItems().filter(isReachable), [enabledItems]);

  const valueOf = (node: HTMLElement) => node.getAttribute('data-todae-roving-value') ?? '';

  const values = useCallback(() => enabledItems().map(valueOf), [enabledItems]);

  // Re-read when the container mounts and on DOM changes: items can appear,
  // move, hide or turn disabled without this hook's owner rendering.
  const syncTabStop = () => {
    if (!keepTabStop) return;
    const nodes = enabledItems();
    const enabled = nodes.map(valueOf);
    const reachable = nodes.filter(isReachable).map(valueOf);
    setKnown((prev) =>
      prev.read && sameValues(prev.enabled, enabled) && sameValues(prev.reachable, reachable)
        ? prev
        : { read: true, enabled, reachable },
    );
  };
  const latestSync = useRef(syncTabStop);
  useLayoutEffect(() => {
    latestSync.current = syncTabStop;
  });

  // `active` holds the tab stop when focus can reach it. Otherwise the first
  // reachable item does, then `active` if it is merely hidden, then the first
  // enabled item: a group rendered while hidden still has a tab stop when
  // shown. Before anything is read from the DOM, as in server HTML, only
  // `active` can.
  const derivedStop = !known.read
    ? active
    : active !== null && known.reachable.includes(active)
      ? active
      : (known.reachable[0] ??
        (active !== null && known.enabled.includes(active) ? active : (known.enabled[0] ?? null)));
  const tabStop = keepTabStop ? derivedStop : null;

  // Watch whichever element is the container now, including one that mounts
  // after the owner or replaces an earlier one, and let go of one that
  // unmounts while the owner stays.
  const observer = useRef<{ node: HTMLElement; disconnect: () => void; flush: () => void } | null>(null);
  const keepRef = useRef(keepTabStop);
  const setContainer = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
    if (node && observer.current?.node === node) return;
    observer.current?.disconnect();
    observer.current = null;
    // Without a tab stop there is nothing to keep in sync.
    if (!node || !keepRef.current || typeof MutationObserver === 'undefined') return;
    // Only changes that add, remove, hide or change an item, or a wrapper
    // around items, can move the tab stop. Those are read at once. A class or
    // style change only might hide something, and can come every frame from
    // an animation, so those are read at most once per frame.
    // Only this group's items: another group nested inside, such as a menu
    // in a tab list, keeps its own.
    const item = `[data-todae-roving="${scope}"]`;
    const touchesItem = (node: Node) => node instanceof Element && (node.matches(item) || node.querySelector(item) !== null);
    let frame = 0;
    const syncNow = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      latestSync.current();
    };
    const handle = (records: MutationRecord[]) => {
      let now = false;
      let later = false;
      for (const record of records) {
        if (record.type === 'attributes') {
          const styling = record.attributeName === 'class' || record.attributeName === 'style';
          // A frame already queued covers every class or style change; skip
          // the subtree query an animation would otherwise run per record.
          if (styling && (later || frame)) continue;
          if (!touchesItem(record.target)) continue;
          if (styling) later = true;
          else now = true;
        } else if ([...record.addedNodes].some(touchesItem) || [...record.removedNodes].some(touchesItem)) {
          now = true;
        }
      }
      if (now) syncNow();
      else if (later && !frame) frame = requestAnimationFrame(syncNow);
    };
    const watcher = new MutationObserver(handle);
    watcher.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      // class and style too: either can hide an item.
      attributeFilter: ['data-todae-roving-disabled', 'data-todae-roving-value', 'hidden', 'inert', 'disabled', 'class', 'style'],
    });
    // A size change catches the group itself being shown or hidden, say by
    // an ancestor opening, which no mutation inside it reports.
    // Only a change between no size and some size matters, not every resize.
    let shown: boolean | null = null;
    const resize =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            const rect = entries.at(-1)?.contentRect;
            const now = rect ? rect.width > 0 || rect.height > 0 : true;
            if (now === shown) return;
            shown = now;
            latestSync.current();
          });
    resize?.observe(node);
    observer.current = {
      node,
      disconnect: () => {
        watcher.disconnect();
        resize?.disconnect();
        cancelAnimationFrame(frame);
      },
      flush: () => handle(watcher.takeRecords()),
    };
    latestSync.current();
  }, [scope]);

  // Items the owner itself just changed are read before paint, so a tab
  // added and made active in one render takes the tab stop at once.
  useLayoutEffect(() => {
    observer.current?.flush();
  });

  // Turning the tab stop on or off later starts or stops watching.
  useLayoutEffect(() => {
    if (keepRef.current === keepTabStop) return;
    keepRef.current = keepTabStop;
    const node = containerRef.current;
    observer.current?.disconnect();
    observer.current = null;
    if (node) setContainer(node);
  }, [keepTabStop, setContainer]);

  const commit = useCallback(
    (value: string) => {
      // The tab stop is derived from `active`, so a controlled owner that
      // keeps its value keeps the tab stop too.
      if (value === active) return;
      // A fallback tab stop that takes focus is reported too, so a controlled
      // owner can pin it before a DOM change moves the fallback elsewhere.
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

  // A space only joins a search already under way; otherwise it activates.
  const isTypingAhead = useCallback(
    (event: { timeStamp: number }) =>
      typeahead && buffer.current.text !== '' && event.timeStamp - buffer.current.at <= TYPEAHEAD_RESET_MS,
    [typeahead],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // The container itself counts too, when it takes focus, as a menu does
      // on a press between items. Its index is -1: the next item is the first.
      const onContainer = target === containerRef.current;
      if (!onContainer && target.getAttribute('data-todae-roving') !== scope) return;
      // Only these keys move focus; leave the rest without reading the DOM.
      // A typed character is one code point, so an emoji counts too.
      const isMove = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key);
      // Shift with a move key is left to the owner, say to extend a selection.
      if (isMove && event.shiftKey) return;
      if (!isMove && !(typeahead && [...event.key].length === 1)) return;
      const nodes = items();
      if (nodes.length === 0) return;
      // Where focus sits among the enabled items. A focused item that turned
      // disabled is not one of them: it sits between its enabled neighbours.
      const index = onContainer ? -1 : nodes.indexOf(target);
      const after = onContainer
        ? 0
        : index >= 0
          ? index + 1
          : nodes.filter((node) => node.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).length;
      const before = index >= 0 ? index - 1 : after - 1;
      const rtl = () => {
        const container = containerRef.current;
        return container ? getComputedStyle(container).direction === 'rtl' : false;
      };
      let next: HTMLElement | undefined;
      const step = nextKey(event.key, orientation, rtl);
      if (step === 'next') {
        next = after < nodes.length ? nodes[after] : loop ? nodes[0] : undefined;
      } else if (step === 'prev') {
        next = before >= 0 ? nodes[before] : loop || onContainer ? nodes.at(-1) : undefined;
      } else if (event.key === 'Home') {
        next = nodes[0];
      } else if (event.key === 'End') {
        next = nodes.at(-1);
      } else if (typeahead && [...event.key].length === 1 && (event.key !== ' ' || isTypingAhead(event))) {
        const state = buffer.current;
        const now = event.timeStamp;
        state.text = now - state.at > TYPEAHEAD_RESET_MS ? event.key : state.text + event.key;
        state.at = now;
        const query = state.text.toLowerCase();
        const text = (node: HTMLElement) =>
          (node.getAttribute('data-todae-roving-text') ?? node.textContent ?? '').trim().toLowerCase();
        // One letter, or the same letter repeated, cycles through the items
        // that start with it; a longer prefix keeps matching the current item.
        const chars = [...query];
        const cycling = chars.every((char) => char === chars[0]);
        const needle = cycling ? (chars[0] ?? query) : query;
        const start = cycling || index < 0 ? after : index;
        const ordered = [...nodes.slice(start), ...nodes.slice(0, start)];
        next = ordered.find((node) => text(node).startsWith(needle));
        // A Space that joined the search is the search's, match or not.
        if (!next) {
          // A failed search ends, so a Space right after it chooses again.
          state.text = '';
          if (event.key === ' ') event.preventDefault();
          return;
        }
      } else {
        return;
      }
      event.preventDefault();
      next?.focus();
    },
    [isTypingAhead, items, loop, orientation, scope, typeahead],
  );

  const composedRef = useStableComposedRef(setContainer);

  const getContainerProps = useCallback(
    <P extends RovingContainerUserProps>(props?: P): Omit<P, keyof RovingContainerWire> & RovingContainerWire => {
      const user = (props ?? {}) as P;
      return {
        ...user,
        // Stable while the caller's ref is, so React does not detach and
        // re-observe the container on every render.
        ref: composedRef(user.ref),
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
          user.onKeyDown?.(event);
          if (!event.defaultPrevented) onKeyDown(event);
        },
      };
    },
    [composedRef, onKeyDown],
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
          if (event.defaultPrevented || event.target !== event.currentTarget || itemOptions.disabled) return;
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

  return useMemo(
    () => ({
      activeValue: tabStop,
      setActiveValue: commit,
      focus,
      focusFirst,
      focusLast,
      getItemNode,
      isTypingAhead,
      values,
      reachableItems: items,
      getContainerProps,
      getItemProps,
    }),
    [commit, focus, focusFirst, focusLast, getContainerProps, getItemNode, getItemProps, isTypingAhead, items, tabStop, values],
  );
}
