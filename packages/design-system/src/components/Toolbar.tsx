import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { useRovingFocus } from '../hooks/useRovingFocus.js';
import { getTabbables, getTabOrder } from '../overlay/tabbables.js';
import { cx } from './cx.js';
import { useDomId } from './domId.js';
import { useComposedRefs } from './props.js';
import { focusWithoutScroll } from './revealRing.js';
import styles from './Toolbar.module.css';
import { TOOLBAR_BOUNDARY, ToolbarContext, type ToolbarOrientation } from './toolbarContext.js';

export type { ToolbarOrientation };

/**
 * A row (or column) of controls with one tab stop. Arrow keys move focus
 * between the controls inside, Home and End jump to the ends, and Tab leaves.
 * Any focusable control counts, inside wrappers too, except those in a popover
 * or dialog that opens from the toolbar. Text inputs and composites with their
 * own arrow keys keep their own tab stop. The toolbar writes no `tabindex`:
 * it moves focus to the edge of the run of controls in Tab's direction. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export type ToolbarRootProps = {
  orientation?: ToolbarOrientation;
  /** Wrap from the last control to the first and back. */
  loop?: boolean;
} & ComponentPropsWithRef<'div'>;

export type ToolbarGroupProps = ComponentPropsWithRef<'div'>;
export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

// Reachable by Tab, but not an arrow-key item.
const NOT_ITEM = 'summary, iframe, audio, video';

// Roles whose widgets handle arrow keys themselves.
const ARROW_ROLES = /* @__PURE__ */ new Set([
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
const ARROW_COMPOSITES = /* @__PURE__ */ roleSelector(ARROW_ROLES);

function roleSelector(roles: ReadonlySet<string>): string {
  return [...roles].map((role) => `[role="${role}"]`).join(', ');
}

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
  for (const el of getTabbables(root)) {
    if (isItem(el, root)) runs[runs.length - 1]!.push(el);
    else runs.push([]);
  }
  return runs.filter((run) => run.length > 0);
}

// The arrow keys' items, disabled and CSS-hidden ones too: useRovingFocus
// skips those, and moves on from one that became disabled while focused.
function itemsOf(root: HTMLElement): HTMLElement[] {
  return getTabOrder(root).filter((el) => isItem(el, root));
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
  // When Tab last left from each item, so Tab coming back into a run returns
  // to the one left most recently.
  const left = useRef(new WeakMap<HTMLElement, number>());
  const leaves = useRef(0);
  const id = useDomId();
  const context = useMemo(() => ({ orientation, id }), [orientation, id]);
  // Only the arrow keys, Home and End: Tab is steered below, and no tabindex is written.
  const roving = useRovingFocus({ orientation, loop, findItems: itemsOf });

  // The Tab key press now under way, seen first at the window so stopped
  // propagation cannot hide it. Dropped once the browser has moved focus.
  const tabKey = useRef<globalThis.KeyboardEvent | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      tabKey.current = event;
      clearTimeout(timer);
      timer = setTimeout(() => {
        tabKey.current = null;
      });
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
    };
  }, []);
  // Whether the focus now arriving is the browser's own Tab move: the key
  // has finished dispatch unprevented. Focus a handler moves during the key,
  // such as a menu returning focus to its trigger, does not count.
  const tabbing = () => {
    const key = tabKey.current;
    return key !== null && key.eventPhase === Event.NONE && !key.defaultPrevented;
  };

  // Tab coming back into a run goes to the item Tab last left it from, when
  // that item can still take focus. Focus from a click, a script or a screen
  // reader lands where it was aimed, and the remembered item is dropped.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    const root = rootRef.current;
    // Focus inside a portaled layer still bubbles here through React.
    if (!root || !root.contains(event.target as Node)) return;
    // A move inside the toolbar that Tab did not make, such as an arrow key.
    if (!tabbing() && root.contains(event.relatedTarget as Node | null)) return;
    const target = event.target as HTMLElement;
    const run = runsOf(root).find((items) => items.includes(target));
    if (!run || run.includes(event.relatedTarget as HTMLElement)) return;
    let back: HTMLElement | undefined;
    for (const item of run) {
      if ((left.current.get(item) ?? -1) > (back ? left.current.get(back)! : -1)) back = item;
    }
    for (const item of run) left.current.delete(item);
    if (!tabbing()) return;
    // With nothing remembered, entry is on the first control, from either side.
    const to = back ?? run[0]!;
    if (to !== target) to.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !root || event.altKey || event.ctrlKey || event.metaKey) return;
    // Where focus is now: a layer inside, such as a menu, may already have
    // returned it to its trigger before letting Tab run.
    const from = document.activeElement instanceof HTMLElement ? document.activeElement : (event.target as HTMLElement);
    const run = runsOf(root).find((items) => items.includes(from));
    if (!run) return;
    // Focus moves to the end of the run first, so the browser's own Tab
    // then leaves the run from there.
    leaves.current += 1;
    left.current.set(from, leaves.current);
    const edge = event.shiftKey ? run[0]! : run[run.length - 1]!;
    if (edge !== from) focusWithoutScroll(edge);
  };

  return (
    <ToolbarContext.Provider value={context}>
      <div
        {...props}
        {...roving.getContainerProps({ ref: refs, onKeyDown: handleKeyDown })}
        role="toolbar"
        data-todae-toolbar={id}
        aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
        data-orientation={orientation}
        className={cx(styles.root, className)}
        onFocus={handleFocus}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          // A press in a run forgets that run's remembered control.
          const pressed = event.target as Node;
          if (!event.currentTarget.contains(pressed)) return;
          const run = runsOf(event.currentTarget).find((items) => items.some((item) => item.contains(pressed)));
          for (const item of run ?? []) left.current.delete(item);
        }}
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
