import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type ReactNode,
} from 'react';
import { useControlledState } from '../hooks/useControlledState';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus';
import { composeHandlers, cx, useComposedRefs } from './props';
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

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`Tabs.${part} must render inside Tabs.Root`);
  return ctx;
}

// One-to-one, so two values never share an id: every character outside
// [A-Za-z0-9-], `_` included, becomes `_<hex>_`.
function domSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/gu, (char) => `_${char.codePointAt(0)!.toString(16)}_`);
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
  const baseId = useId().replaceAll(':', '');
  const [value, setValue] = useControlledState(valueProp, defaultValue ?? '');
  const select = useCallback(
    (next: string) => {
      if (next === value) return;
      setValue(next);
      onValueChange?.(next);
    },
    [onValueChange, setValue, value],
  );
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
  return (
    <TabsContext.Provider value={ctx}>
      <div {...props} className={cx(styles.root, className)} data-orientation={orientation}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function List({ children, className, ref, onBlur, ...props }: TabsListProps) {
  const ctx = useTabs('List');
  const container = ctx.roving.getContainerProps(props);
  const { leave } = ctx;
  const refs = useComposedRefs(container.ref, ref);
  return (
    <div
      {...container}
      ref={refs}
      role="tablist"
      aria-orientation={ctx.orientation}
      data-orientation={ctx.orientation}
      className={cx(styles.list, className)}
      onBlur={composeHandlers(onBlur, (event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        // The window losing focus is not leaving the list: focus comes back
        // to the same tab, which must still be the tab stop.
        if (next === null && !document.hasFocus()) return;
        if (!(next instanceof Node && event.currentTarget.contains(next))) leave();
      })}
    >
      {children}
    </div>
  );
}

function Tab({ value, children, disabled, className, onClick, onFocus, ...props }: TabsTabProps) {
  const ctx = useTabs('Tab');
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
    // tab, never one focus entered on from outside the list.
    onFocus: composeHandlers(onFocus, (event: FocusEvent<HTMLButtonElement>) => {
      const from = event.relatedTarget;
      const list = event.currentTarget.closest('[role="tablist"]');
      if (ctx.activation === 'automatic' && from instanceof Node && list?.contains(from)) ctx.select(value);
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
      // Enter and Space click a native button, which is how manual activation selects.
      onClick={composeHandlers(onClick, () => ctx.select(value))}
    >
      {children}
    </button>
  );
}

function Panel({ value, children, keepMounted = false, className, ...props }: TabsPanelProps) {
  const ctx = useTabs('Panel');
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
