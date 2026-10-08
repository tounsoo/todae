import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { isReachable, nextKey } from '../hooks/useRovingFocus';
import { cx } from './cx';
import { useComposedRefs } from './props';
import styles from './Toolbar.module.css';
import { TOOLBAR_BOUNDARY, ToolbarContext, type ToolbarOrientation } from './toolbarContext';

export type { ToolbarOrientation };

/**
 * A row (or column) of controls with one tab stop. Arrow keys move focus
 * between the controls inside, Home and End jump to the ends, and Tab leaves.
 * Any focusable control counts, inside wrappers too, except those in a popover
 * or dialog that opens from the toolbar. Text inputs and composites with their
 * own arrow keys keep their own tab stop. The toolbar writes no `tabindex`:
 * it moves focus to the end of the run of controls when Tab is pressed. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export type ToolbarRootProps = {
  orientation?: ToolbarOrientation;
  /** Wrap from the last control to the first and back. */
  loop?: boolean;
} & ComponentPropsWithRef<'div'>;

export type ToolbarGroupProps = ComponentPropsWithRef<'div'>;
export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

// Everything Tab can reach. A focus target with tabindex -1 only is never an item.
const FOCUSABLE = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');
// Reachable by Tab, but not an arrow-key item.
const NOT_ITEM = 'summary, iframe, audio, video';

// Roles whose widgets handle arrow keys themselves.
const ARROW_ROLES = new Set([
  'combobox',
  'grid',
  'listbox',
  'menu',
  'menubar',
  'radiogroup',
  'slider',
  'spinbutton',
  'tablist',
  'tree',
  'treegrid',
]);
const ARROW_COMPOSITES = [...ARROW_ROLES].map((role) => `[role="${role}"]`).join(', ');

// Controls whose own arrow keys move a caret or a value, and composites with
// their own roving focus. They keep their own tab stop and keys, outside the
// toolbar's, so focus is never stuck in them.
function ownsArrows(el: HTMLElement, root: HTMLElement): boolean {
  if (el.hasAttribute('data-todae-roving') || el.hasAttribute('aria-activedescendant')) return true;
  if (ARROW_ROLES.has(el.getAttribute('role') ?? '')) return true;
  // An item of such a widget, such as a tab in a tablist.
  const composite = el.parentElement?.closest(ARROW_COMPOSITES);
  if (composite && root.contains(composite)) return true;
  if (el.isContentEditable || el.matches('textarea, select, [contenteditable]:not([contenteditable="false"])')) return true;
  if (el.tagName !== 'INPUT') return false;
  // A radio's arrow keys select the next radio in its group.
  return !['button', 'checkbox', 'reset', 'submit', 'image', 'color', 'file'].includes((el as HTMLInputElement).type);
}

function isItem(el: HTMLElement, root: HTMLElement): boolean {
  return (
    !el.matches(TOOLBAR_BOUNDARY) &&
    el.parentElement?.closest(TOOLBAR_BOUNDARY) === root &&
    !el.matches(NOT_ITEM) &&
    !ownsArrows(el, root)
  );
}

// The toolbar's items in document order, split into runs at anything else
// Tab can reach: a control with its own arrow keys, an open layer, a nested
// toolbar. Tab leaves a run, so those keep their own Tab stops. Read at each
// key press, so nothing goes stale.
function runsOf(root: HTMLElement): HTMLElement[][] {
  const runs: HTMLElement[][] = [[]];
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.matches(':disabled') || !isReachable(el)) continue;
    if (isItem(el, root)) runs[runs.length - 1]!.push(el);
    // Only something Tab stops on splits a run.
    else if (!el.matches('[tabindex="-1"]')) runs.push([]);
  }
  return runs.filter((run) => run.length > 0);
}

function Root({
  orientation = 'horizontal',
  loop = true,
  className,
  ref,
  onKeyDown,
  onFocus,
  onPointerDown,
  children,
  ...props
}: ToolbarRootProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const refs = useComposedRefs(rootRef, ref);
  // For each run, the item Tab last left it from, so Tab coming back
  // returns to it.
  const left = useRef(new WeakSet<HTMLElement>());
  const context = useMemo(() => ({ orientation }), [orientation]);

  // Whether the focus now arriving comes from a Tab press. Set during the
  // key's own dispatch, before the browser moves focus, and cleared after.
  const tabbing = useRef(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      tabbing.current = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        tabbing.current = false;
      });
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
    };
  }, []);

  // Tab coming back into a run goes to the item Tab last left it from, when
  // that item can still take focus. Focus from a click, a script or a screen
  // reader lands where it was aimed, and the remembered item is dropped.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    const root = rootRef.current;
    if (!root) return;
    const target = event.target as HTMLElement;
    const run = runsOf(root).find((items) => items.includes(target));
    if (!run || run.includes(event.relatedTarget as HTMLElement)) return;
    const back = run.find((item) => left.current.has(item));
    if (back) left.current.delete(back);
    if (!tabbing.current) return;
    // With nothing remembered, entry is on the first control, from either side.
    const to = back ?? run[0]!;
    if (to !== target) to.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (event.key === 'Tab') {
      // Where focus is now: a layer inside, such as a menu, may already have
      // returned it to its trigger before letting Tab run.
      const from = document.activeElement instanceof HTMLElement ? document.activeElement : target;
      const run = runsOf(root).find((items) => items.includes(from));
      if (!run) return;
      // Focus moves to the end of the run first, so the browser's own Tab
      // then leaves the run from there.
      for (const item of run) left.current.delete(item);
      left.current.add(from);
      const edge = event.shiftKey ? run[0]! : run[run.length - 1]!;
      if (edge !== from) edge.focus({ preventScroll: true });
      return;
    }
    // Shift combinations are left to the control, as in useRovingFocus.
    if (event.shiftKey) return;
    const move = nextKey(event.key, orientation, () => getComputedStyle(root).direction === 'rtl');
    if (!move && event.key !== 'Home' && event.key !== 'End') return;
    const items = runsOf(root).flat();
    const index = items.indexOf(target);
    if (index === -1) return;
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else {
      const to = index + (move === 'next' ? 1 : -1);
      if (to >= 0 && to < items.length) next = to;
      else if (loop) next = (to + items.length) % items.length;
    }
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <ToolbarContext.Provider value={context}>
      <div
        {...props}
        ref={refs}
        role="toolbar"
        aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
        data-orientation={orientation}
        className={cx(styles.root, className)}
        onFocus={handleFocus}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          left.current = new WeakSet();
        }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
}

/** Controls that belong together, such as text styles. Name it to have it read as a group. */
function Group({ className, ...props }: ToolbarGroupProps) {
  const toolbar = useContext(ToolbarContext);
  return (
    <div role="group" data-orientation={toolbar?.orientation} {...props} className={cx(styles.group, className)} />
  );
}

/** A rule between groups, across the toolbar's direction. */
function Separator({ className, ...props }: ToolbarSeparatorProps) {
  const toolbar = useContext(ToolbarContext);
  const across = toolbar?.orientation === 'vertical' ? 'horizontal' : 'vertical';
  return (
    <div
      role="separator"
      aria-orientation={across}
      {...props}
      className={cx(styles.separator, className)}
    />
  );
}

export const Toolbar = { Root, Group, Separator } as const;
