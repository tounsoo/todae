import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { cx } from './cx';
import { useComposedRefs } from './props';
import styles from './Toolbar.module.css';

export type ToolbarOrientation = 'horizontal' | 'vertical';

/**
 * A row (or column) of controls with one tab stop. Arrow keys move focus
 * between the controls inside, Home and End jump to the ends, and Tab leaves.
 * Any focusable control counts, inside wrappers too, except those in a popover
 * or dialog that opens from the toolbar. Text inputs and composites with their
 * own arrow keys keep their own tab stop. Name it with `aria-label` or
 * `aria-labelledby`.
 */
export type ToolbarRootProps = {
  orientation?: ToolbarOrientation;
  /** Wrap from the last control to the first and back. */
  loop?: boolean;
} & ComponentPropsWithRef<'div'>;

export type ToolbarGroupProps = ComponentPropsWithRef<'div'>;
export type ToolbarSeparatorProps = Omit<ComponentPropsWithRef<'div'>, 'children'>;

type ToolbarContextValue = { orientation: ToolbarOrientation };

/** Set inside a toolbar, so a composite inside, such as ToggleGroup, leaves arrow keys to it. */
export const ToolbarContext = createContext<ToolbarContextValue | null>(null);

// Selects, textareas and editable text own their arrow keys, so they are never items.
const FOCUSABLE = 'button, a[href], input, [tabindex]';
// A layer that opens from the toolbar keeps its own keyboard model.
export const TOOLBAR_BOUNDARY = '[role="toolbar"], [popover], dialog';
const BOUNDARY = TOOLBAR_BOUNDARY;

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

// Membership reads attributes only, so it does not change when CSS outside
// the toolbar shows or hides it.
function itemsOf(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !el.matches(BOUNDARY) &&
      !ownsArrows(el) &&
      el.parentElement?.closest(BOUNDARY) === root &&
      !el.matches(':disabled') &&
      !el.closest('[inert]'),
  );
}

// Arrow keys skip items that are not rendered.
function reachable(el: HTMLElement): boolean {
  return el.checkVisibility?.({ visibilityProperty: true }) ?? true;
}

function Root({
  orientation = 'horizontal',
  loop = true,
  className,
  ref,
  onKeyDown,
  onFocus,
  children,
  ...props
}: ToolbarRootProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const refs = useComposedRefs(rootRef, ref);
  const active = useRef<HTMLElement | null>(null);
  // Each element the toolbar set a tabindex on, with the attribute it had
  // before, so one that stops being an item gets its own back.
  const managed = useRef(new Map<HTMLElement, string | null>());

  // One item keeps tabindex 0: the last one focused if it is shown, else the
  // first shown item, else the last focused, else the first. A toolbar that
  // mounts hidden still keeps a tab stop for when it is shown.
  const sync = useCallback((focused?: HTMLElement) => {
    const root = rootRef.current;
    if (!root) return;
    const items = itemsOf(root);
    if (focused && items.includes(focused)) active.current = focused;
    if (active.current && !items.includes(active.current)) active.current = null;
    const stop =
      (active.current && reachable(active.current) ? active.current : null) ??
      items.find(reachable) ??
      active.current ??
      items[0] ??
      null;
    const now = new Set(items);
    for (const [el, original] of managed.current) {
      if (now.has(el)) continue;
      if (original === null) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', original);
      managed.current.delete(el);
    }
    for (const item of items) {
      if (!managed.current.has(item)) managed.current.set(item, item.getAttribute('tabindex'));
      item.tabIndex = item === stop ? 0 : -1;
    }
  }, []);

  // On mount, then whenever controls come, go, or change what can take focus.
  // Class and style count, as they can hide a control.
  useLayoutEffect(() => {
    sync();
    const root = rootRef.current;
    if (!root || typeof MutationObserver === 'undefined') return;
    // Changes inside a layer that opens from the toolbar, such as an open
    // menu, cannot change the toolbar's items.
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.target === root || record.target.parentElement?.closest(BOUNDARY) === root)) sync();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'inert', 'class', 'style', 'type', 'contenteditable', 'data-todae-roving'],
    });
    return () => observer.disconnect();
  }, [sync]);

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    if (event.target !== active.current) sync(event.target as HTMLElement);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    const items = itemsOf(root).filter(reachable);
    const index = items.indexOf(target);
    if (index === -1) return;
    const rtl = () => getComputedStyle(root).direction === 'rtl';
    let next: number | null = null;
    const step = (delta: number) => {
      const to = index + delta;
      if (to >= 0 && to < items.length) return to;
      return loop ? (to + items.length) % items.length : index;
    };
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (orientation === 'horizontal' && event.key === 'ArrowRight') next = step(rtl() ? -1 : 1);
    else if (orientation === 'horizontal' && event.key === 'ArrowLeft') next = step(rtl() ? 1 : -1);
    else if (orientation === 'vertical' && event.key === 'ArrowDown') next = step(1);
    else if (orientation === 'vertical' && event.key === 'ArrowUp') next = step(-1);
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <ToolbarContext.Provider value={{ orientation }}>
      <div
        {...props}
        ref={refs}
        role="toolbar"
        aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
        data-orientation={orientation}
        className={cx(styles.root, className)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
}

/** Controls that belong together, such as text styles. Name it to have it read as a group. */
function Group({ className, ...props }: ToolbarGroupProps) {
  return <div role="group" {...props} className={cx(styles.group, className)} />;
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
