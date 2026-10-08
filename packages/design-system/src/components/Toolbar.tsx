import {
  useContext,
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

export { TOOLBAR_BOUNDARY, ToolbarContext, type ToolbarOrientation };

/**
 * A row (or column) of controls with one tab stop. Arrow keys move focus
 * between the controls inside, Home and End jump to the ends, and Tab leaves.
 * Any focusable control counts, inside wrappers too, except those in a popover
 * or dialog that opens from the toolbar. Text inputs and composites with their
 * own arrow keys keep their own tab stop. The toolbar writes no `tabindex`:
 * it moves focus to the end of the controls when Tab is pressed. Name it with
 * `aria-label` or `aria-labelledby`.
 */
export type ToolbarRootProps = {
  orientation?: ToolbarOrientation;
  /** Wrap from the last control to the first and back. */
  loop?: boolean;
} & ComponentPropsWithRef<'div'>;

export type ToolbarGroupProps = ComponentPropsWithRef<'div'>;
export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

// Selects, textareas and editable text own their arrow keys, so they are never items.
const FOCUSABLE = 'button, a[href], input, [tabindex]';

// Controls whose own arrow keys move a caret or a value, and composites with
// their own roving focus. They keep their own tab stop and keys, outside the
// toolbar's, so focus is never stuck in them.
function ownsArrows(el: HTMLElement): boolean {
  if (el.hasAttribute('data-todae-roving')) return true;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  // A radio's arrow keys select the next radio in its group.
  return !['button', 'checkbox', 'reset', 'submit', 'image', 'color', 'file'].includes((el as HTMLInputElement).type);
}

// Controls inside the toolbar's own element, outside any layer that opens
// from it, in document order. Read at each key press, so nothing goes stale.
function controlsOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.matches(TOOLBAR_BOUNDARY) &&
      el.parentElement?.closest(TOOLBAR_BOUNDARY) === root &&
      !el.matches(':disabled') &&
      isReachable(el),
  );
}

// The toolbar's items, split into runs at each control that owns its arrow
// keys. Tab leaves a run, so such a control keeps its own Tab stop.
function runsOf(root: HTMLElement): HTMLElement[][] {
  const runs: HTMLElement[][] = [[]];
  for (const el of controlsOf(root)) {
    if (ownsArrows(el)) runs.push([]);
    else runs[runs.length - 1]!.push(el);
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
  // The item Tab last left from, so Tab coming back returns to it.
  const left = useRef<HTMLElement | null>(null);
  const context = useMemo(() => ({ orientation }), [orientation]);

  // Focus coming back from outside goes to the item Tab left from, when it
  // is in the same run and can still take focus. A press inside forgets it,
  // so a click lands where it was aimed.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    const root = rootRef.current;
    const back = left.current;
    if (!root || !back || root.contains(event.relatedTarget as Node | null)) return;
    left.current = null;
    const target = event.target as HTMLElement;
    if (back === target) return;
    const run = runsOf(root).find((items) => items.includes(target));
    if (run?.includes(back)) back.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (event.key === 'Tab') {
      const run = runsOf(root).find((items) => items.includes(target));
      if (!run) return;
      // Focus moves to the end of the run first, so the browser's own Tab
      // then leaves the run from there.
      left.current = target;
      const edge = event.shiftKey ? run[0]! : run[run.length - 1]!;
      if (edge !== target) edge.focus();
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
          left.current = null;
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
