import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { domSafe, useDomId } from '../internal/domId.js';
import { ScrollEdges } from './scrollEdges.js';
import styles from './Tabs.module.css';

export type TabsOrientation = 'horizontal' | 'vertical';

/**
 * `automatic` selects a tab as soon as it takes focus. `manual` waits for
 * Enter, Space or a click, for panels that are slow to render.
 */
export type TabsActivation = 'automatic' | 'manual';

type TabsValue =
  | { value: string; onValueChange: (value: string) => void; defaultValue?: never }
  | { defaultValue: string; onValueChange?: (value: string) => void; value?: never };

export type TabsRootProps = TabsValue & {
  orientation?: TabsOrientation;
  activation?: TabsActivation;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'>;

export type TabsListProps = {
  /**
   * Whether a horizontal list shows an arrow at each edge where tabs are cut
   * off, while there is more to scroll that way. Resting a mouse or pen on one
   * scrolls toward it. The arrows are for the pointer only: touch, a wheel and
   * the arrow keys scroll the list as before, and assistive technology never
   * meets them. A vertical list never scrolls, so it shows none.
   */
  arrows?: boolean;
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'children'>;

export type TabsTabProps = {
  value: string;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
} & Omit<ComponentPropsWithRef<'button'>, 'value' | 'role' | 'type' | 'disabled' | 'id' | 'tabIndex'>;

export type TabsPanelProps = {
  value: string;
  children?: ReactNode;
  /** Keep the panel's children mounted while it is hidden, for state or forms. */
  keepMounted?: boolean;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'id' | 'hidden' | 'children'>;

type TabsContextValue = {
  baseId: string;
  value: string;
  select: (value: string) => void;
  orientation: TabsOrientation;
  activation: TabsActivation;
  roving: UseRovingFocusResult;
  /** Focus left the list. */
  leave: () => void;
  /** A tab went away or turned disabled; it can no longer hold the tab stop. */
  release: (value: string) => void;
};

const TabsContext = /* @__PURE__ */ createContext<TabsContextValue | null>(null);

// Panels read only the selection, so arrowing through the list, which moves
// the tab stop, does not render them.
type TabsPanelContextValue = { baseId: string; value: string };

const TabsPanelContext = /* @__PURE__ */ createContext<TabsPanelContextValue | null>(null);

function useTabs(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`Tabs.${part} must render inside Tabs.Root`);
  return ctx;
}

const tabId = (baseId: string, value: string) => `${baseId}-tab-${domSafe(value)}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${domSafe(value)}`;

function Root({
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activation = 'automatic',
  children,
  className,
  ...props
}: TabsRootProps) {
  const baseId = useDomId();
  const [value, select] = useControlledState(valueProp, defaultValue ?? '', onValueChange);
  // The tab stop is the selected tab, except while focus moves inside the
  // list: then it is the focused tab. Leaving the list returns it to the
  // selected tab, so focus always enters on the selected tab.
  const [navigating, setNavigating] = useState<string | null>(null);
  const leave = useCallback(() => setNavigating(null), []);
  const release = useCallback(
    (gone: string) => setNavigating((current) => (current === gone ? null : current)),
    [],
  );
  const roving = useRovingFocus({
    orientation,
    activeValue: navigating ?? value,
    onActiveValueChange: setNavigating,
  });
  const ctx = useMemo(
    () => ({ baseId, value, select, orientation, activation, roving, leave, release }),
    [activation, baseId, leave, orientation, release, roving, select, value],
  );
  const panelCtx = useMemo(() => ({ baseId, value }), [baseId, value]);
  return (
    <TabsContext.Provider value={ctx}>
      <TabsPanelContext.Provider value={panelCtx}>
        <div {...props} className={cx(styles.root, className)} data-orientation={orientation}>
          {children}
        </div>
      </TabsPanelContext.Provider>
    </TabsContext.Provider>
  );
}

function List({ arrows = true, children, className, ref, onBlur, onFocus, ...props }: TabsListProps) {
  const ctx = useTabs('List');
  const container = ctx.roving.getContainerProps(props);
  const focusLeave = useFocusLeave(ctx.leave);
  const own = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, container.ref, ref);
  const horizontal = ctx.orientation === 'horizontal';
  // A horizontal list scrolls sideways, so a selected tab past its edge, on
  // the first render, chosen by the owner, in a list that was hidden until
  // now, or among tabs that arrive late, is scrolled into view, clear of a
  // shown arrow. Only the list scrolls, never the page around it. It measures
  // in the list's own layout (offsets and scroll positions), so a transform
  // on an ancestor, such as a popover growing in, changes nothing. Focus
  // moving to a tab scrolls it into view the browser's own way.
  useLayoutEffect(() => {
    const list = own.current;
    if (!list || !horizontal) return;
    const id = tabId(ctx.baseId, ctx.value);
    // Scrolls the selected tab into view, or returns false while there is
    // nothing to reveal yet: not rendered, in a list with no box, or in a list
    // that still fits, which tabs arriving later can push it out of.
    const measure = () => {
      const tab = [...list.querySelectorAll<HTMLElement>('[role="tab"]')].find((node) => node.id === id);
      if (!tab || list.clientWidth === 0 || tab.offsetParent !== list) return false;
      if (list.scrollWidth <= list.clientWidth) return false;
      const style = getComputedStyle(list);
      // The scrollport in the content's own coordinates, where a right-to-left
      // list's scrollLeft runs negative.
      const start = list.scrollLeft + (Number.parseFloat(style.scrollPaddingLeft) || 0);
      const end = list.scrollLeft + list.clientWidth - (Number.parseFloat(style.scrollPaddingRight) || 0);
      const left = tab.offsetLeft;
      const right = left + tab.offsetWidth;
      if (left >= start && right <= end) return true;
      // A tab wider than the room shows its inline start.
      if (right - left > end - start) list.scrollLeft += style.direction === 'rtl' ? right - end : left - start;
      else list.scrollLeft += left < start ? left - start : right - end;
      return true;
    };
    // Once per selection, and again each time the list shows after being
    // hidden, which resets its scroll; never after, so the list stays where
    // the user scrolls it.
    let done = false;
    let frame = 0;
    const reveal = () => {
      if (done || !measure()) return;
      done = true;
      // Scrolling away from an end shows that end's arrow, which takes room
      // the first pass couldn't see; settle once more after it shows.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    reveal();
    // Tabs that arrive after the first render, as from loaded data, may hold
    // the selected one.
    const added = new MutationObserver(reveal);
    added.observe(list, { childList: true });
    let shown: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      let width = list.clientWidth;
      shown = new ResizeObserver(() => {
        const was = width;
        width = list.clientWidth;
        if (width === 0) done = false;
        else if (was === 0) reveal();
      });
      shown.observe(list);
    }
    return () => {
      cancelAnimationFrame(frame);
      added.disconnect();
      shown?.disconnect();
    };
  }, [horizontal, ctx.baseId, ctx.value]);
  return (
    <div
      {...container}
      ref={refs}
      role="tablist"
      aria-orientation={ctx.orientation}
      data-orientation={ctx.orientation}
      className={cx(styles.list, className)}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        onFocus?.(event);
        focusLeave.onFocus();
      }}
      // The tab stop must return to the selected tab whatever the consumer's
      // handler does, so this runs even if it prevented the event.
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        onBlur?.(event);
        focusLeave.onBlur(event);
      }}
    >
      {arrows && horizontal && <ScrollEdges axis="inline" />}
      {children}
    </div>
  );
}

function Tab({ value, children, disabled, className, onClick, onFocus, onBlur, onPointerDown, ...props }: TabsTabProps) {
  const ctx = useTabs('Tab');
  // A press that focuses this tab selects it on focus; the click ending that
  // press must not ask the owner a second time.
  const pressing = useRef(false);
  const selectedOnFocus = useRef(false);
  const selected = ctx.value === value;
  const { release } = ctx;
  // Hand the tab stop back to the selected tab when this one goes away.
  useLayoutEffect(() => {
    if (disabled) release(value);
    return () => release(value);
  }, [disabled, release, value]);
  const item = ctx.roving.getItemProps(value, { disabled }, {
    ...props,
    // Automatic activation selects a tab that focus moved to from another
    // tab, never one focus entered on from outside the tabs, such as from an
    // add button inside the list, and never a fallback tab stop entered on
    // while the selected tab is disabled: selecting takes a key or a press.
    onFocus: composeHandlers(onFocus, (event: FocusEvent<HTMLButtonElement>) => {
      const from = event.relatedTarget;
      const scope = event.currentTarget.getAttribute('data-todae-roving');
      const fromTab = from instanceof Element && from.getAttribute('data-todae-roving') === scope;
      if (ctx.activation === 'automatic' && fromTab) {
        selectedOnFocus.current = pressing.current;
        ctx.select(value);
      }
    }),
  });
  return (
    <button
      {...item}
      type="button"
      role="tab"
      id={tabId(ctx.baseId, value)}
      aria-selected={selected}
      aria-controls={panelId(ctx.baseId, value)}
      disabled={disabled}
      data-selected={selected ? '' : undefined}
      data-orientation={ctx.orientation}
      className={cx(styles.tab, className)}
      onPointerDown={composeHandlers(onPointerDown, () => {
        pressing.current = true;
        selectedOnFocus.current = false;
      })}
      onBlur={composeHandlers(onBlur, () => {
        pressing.current = false;
        selectedOnFocus.current = false;
      })}
      // Enter and Space click a native button, which is how manual activation selects.
      onClick={composeHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
        // Only a pointer click ends a press; Enter and Space (detail 0) always ask.
        const skip = selectedOnFocus.current && event.detail > 0;
        pressing.current = false;
        selectedOnFocus.current = false;
        if (!skip) ctx.select(value);
      })}
    >
      {children}
      {/* The list's indicator anchors here, not on the button, so an overlay
          trigger's inline anchor-name on the button can't hide it. */}
      <span className={styles.anchor} aria-hidden />
    </button>
  );
}

function Panel({ value, children, keepMounted = false, className, ...props }: TabsPanelProps) {
  const ctx = useContext(TabsPanelContext);
  if (!ctx) throw new Error('Tabs.Panel must render inside Tabs.Root');
  const selected = ctx.value === value;
  return (
    <div
      {...props}
      tabIndex={props.tabIndex ?? 0}
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      hidden={!selected}
      className={cx(styles.panel, className)}
    >
      {selected || keepMounted ? children : null}
    </div>
  );
}

export const Tabs = { Root, List, Tab, Panel } as const;
