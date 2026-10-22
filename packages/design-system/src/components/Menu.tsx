import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
  type RefObject,
} from 'react';
import { isTextEntry } from '../hooks/hotkey.js';
import { canFocusNow } from '../overlay/tabbables.js';
import { useControlledValue } from '../hooks/useControlledState.js';
import { usePopoverInternal, type PopoverCloseReason, type UsePopoverResult } from '../hooks/usePopover.js';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus.js';
import { isPopoverOpen, reshowHeldInside, usePopoverSync } from '../overlay/usePopoverSync.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { Button, type ButtonActionProps } from './Button.js';
import { useDomId } from './domId.js';
import { CheckGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import popoverStyles from './Popover.module.css';
import styles from './Menu.module.css';
import { ToolbarContext, useToolbar } from './toolbarContext.js';
import { focusWithoutScroll } from './revealRing.js';

/**
 * Why the menu opened or closed. `select` is an item choice; `tab` is focus
 * leaving with Tab; `context` is a Menu.ContextTrigger opening it.
 */
export type MenuOpenChangeReason = PopoverCloseReason | 'select' | 'tab' | 'context';

export type MenuRootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: MenuOpenChangeReason) => void;
  children?: ReactNode;
};

/** The id is the menu's: the content is named by it. */
export type MenuTriggerProps = Omit<ButtonActionProps, 'id'>;

/** What Menu.ContextTrigger hands `render`: its handlers and state, to spread on the element it returns. */
export type MenuContextTriggerRenderProps = HTMLAttributes<HTMLElement> & {
  ref: RefCallback<HTMLElement>;
  children?: ReactNode;
  'data-open'?: string;
};

export type MenuContextTriggerProps = {
  children?: ReactNode;
  /** Renders the region as another element, such as a table row or a list item. */
  render?: (props: MenuContextTriggerRenderProps) => ReactElement;
} & ComponentPropsWithRef<'div'>;

type MenuName =
  | { 'aria-label'?: undefined; 'aria-labelledby'?: string }
  | { 'aria-label': string; 'aria-labelledby'?: undefined };

/** Named by its trigger unless `aria-label` or `aria-labelledby` says otherwise. */
export type MenuContentProps = {
  children?: ReactNode;
  className?: string;
} & MenuName &
  Omit<ComponentPropsWithRef<'div'>, 'role' | 'popover' | 'children' | 'aria-label' | 'aria-labelledby' | 'id'>;

type ItemBase = {
  children?: ReactNode;
  disabled?: boolean;
  /** Typeahead text when the children are not plain text. */
  textValue?: string;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'children' | 'onSelect' | 'tabIndex'>;

/** What Menu.Item hands `render`: its role, keyboard and focus wiring, to spread on the element it returns. */
export type MenuItemRenderProps = HTMLAttributes<HTMLElement> & {
  ref: RefCallback<HTMLElement>;
  [data: `data-${string}`]: string | undefined;
};

export type MenuItemProps = ItemBase & {
  onSelect?: () => void;
  /** Close the menu after this item is chosen. */
  closeOnSelect?: boolean;
  /** Renders the item on another element, such as an `a` that goes somewhere when chosen. */
  render?: (props: MenuItemRenderProps) => ReactElement;
};

export type MenuCheckboxItemProps = ItemBase & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  closeOnSelect?: boolean;
};

type GroupName =
  | { 'aria-label': string; 'aria-labelledby'?: undefined }
  | { 'aria-labelledby': string; 'aria-label'?: undefined };

export type MenuGroupProps = {
  children?: ReactNode;
  className?: string;
} & GroupName &
  Omit<ComponentPropsWithRef<'div'>, 'role' | 'children' | 'aria-label' | 'aria-labelledby' | 'defaultValue'>;

export type MenuRadioGroupProps = MenuGroupProps & {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
};

export type MenuRadioItemProps = ItemBase & {
  value: string;
  closeOnSelect?: boolean;
};

export type MenuSeparatorProps = {
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'children'>;

/** Where a context request put the menu, and who asked. */
type ContextOpen = {
  /**
   * In viewport coordinates: the pointer's point, with no size, or the box of
   * the element a key or a screen reader's command came from.
   */
  box: { top: number; left: number; width: number; height: number };
  /** What had focus when the request came, to take it back on close. */
  opener: HTMLElement | SVGElement | null;
  /** The Menu.ContextTrigger that asked. */
  source: string;
};

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean, reason: MenuOpenChangeReason) => void;
  closeAsked: RefObject<boolean>;
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** A Menu.Trigger is mounted, so its id can name the menu. */
  hasTrigger: boolean;
  countTrigger: (change: 1 | -1) => void;
  /** The end a trigger key asked the next open to focus. Cleared when the trigger loses focus. */
  openEnd: RefObject<'first' | 'last' | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  /** The context request the menu is open for, dropped when it closes. */
  context: ContextOpen | null;
  openAt: (context: ContextOpen) => void;
  /** Where focus goes when the menu closes or Tab leaves it. */
  restoreTarget: () => HTMLElement | SVGElement | null;
  /** The anchor name of the box a context request put the menu at. */
  boxName: string;
  popover: UsePopoverResult;
  roving: UseRovingFocusResult;
};

const MenuContext = /* @__PURE__ */ createContext<MenuContextValue | null>(null);

function useMenu(part: string): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error(`Menu.${part} must render inside Menu.Root`);
  return ctx;
}

type RadioContextValue = { value: string | null; select: (value: string) => void };

const RadioContext = /* @__PURE__ */ createContext<RadioContextValue | null>(null);

function Root({ open: openProp, defaultOpen, onOpenChange, children }: MenuRootProps) {
  const [open, setOpenValue] = useControlledValue(openProp, defaultOpen ?? false, onOpenChange);
  // Set while the input that asked for a close is still being handled, so
  // the focus move that same input makes does not ask a second time.
  const closeAsked = useRef(false);
  const [context, setContextState] = useState<ContextOpen | null>(null);
  const contextRef = useRef<ContextOpen | null>(null);
  const setContext = useCallback((next: ContextOpen | null) => {
    contextRef.current = next;
    setContextState(next);
  }, []);
  const setOpen = useCallback(
    (next: boolean, reason: MenuOpenChangeReason) => {
      // An open asked for another way, such as by a Menu.Trigger, isn't a
      // pending context request's.
      if (next && reason !== 'context') setContext(null);
      if (!next) {
        closeAsked.current = true;
        setTimeout(() => {
          closeAsked.current = false;
        });
      }
      setOpenValue(next, reason);
    },
    [setOpenValue, setContext],
  );
  const domId = useDomId();
  const triggerId = `${domId}-trigger`;
  const boxName = `--${domId}-box`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openAt = useCallback(
    (next: ContextOpen) => {
      setContext(next);
      setOpen(true, 'context');
    },
    [setContext, setOpen],
  );
  // A request holds for the open that follows it, however late the owner
  // applies it, until the next press or key: one the owner turned down is
  // then dropped, not reused by a later open. A held key's repeats and a lone
  // modifier are not a next key.
  useEffect(() => {
    if (!context || open) return;
    const drop = (event: Event) => {
      if (event instanceof globalThis.KeyboardEvent && (event.repeat || MODIFIER_KEYS.has(event.key))) return;
      setContext(null);
    };
    document.addEventListener('pointerdown', drop, true);
    document.addEventListener('keydown', drop, true);
    return () => {
      document.removeEventListener('pointerdown', drop, true);
      document.removeEventListener('keydown', drop, true);
    };
  }, [context, open, setContext]);
  // Focus goes back to what had it when a context request came, while it is
  // still in the page and can take focus, else to the trigger.
  const restoreTarget = useCallback(() => {
    const opener = contextRef.current?.opener;
    return opener?.isConnected && canFocusNow(opener) ? opener : triggerRef.current;
  }, []);
  // usePopover reads `current` when it restores focus, and only focuses it,
  // which an SVG element does as an HTML one does.
  const restoreFocusRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return restoreTarget() as HTMLElement | null;
      },
    }),
    [restoreTarget],
  );
  const [triggers, setTriggers] = useState(0);
  const hasTrigger = triggers > 0;
  const countTrigger = useCallback((change: 1 | -1) => setTriggers((n) => n + change), []);
  const openEnd = useRef<'first' | 'last' | null>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const popover = usePopoverInternal(
    { open, onOpenChange: setOpen, restoreFocusRef, initialFocusRef, haspopup: 'menu' },
    true,
  );
  // The item chosen for one open never carries over to the next.
  useLayoutEffect(() => {
    if (!open) initialFocusRef.current = null;
  }, [open]);
  // A context request lasts for one open. This runs after usePopover has
  // read where focus goes back to.
  useLayoutEffect(() => {
    if (!open) setContext(null);
  }, [open, setContext]);
  // Every open starts at an end of the list and focus enters only from the
  // trigger, so the menu tracks no tab stop: items are never Tab stops, and
  // focus moving across them under the pointer does not render the menu.
  const roving = useRovingFocus({ orientation: 'vertical', typeahead: true, activeValue: null, tabStop: false });
  const ctx = useMemo(
    () => ({
      open,
      setOpen,
      closeAsked,
      triggerId,
      triggerRef,
      hasTrigger,
      countTrigger,
      openEnd,
      initialFocusRef,
      context,
      openAt,
      restoreTarget,
      boxName,
      popover,
      roving,
    }),
    [open, setOpen, triggerId, hasTrigger, countTrigger, context, openAt, restoreTarget, boxName, popover, roving],
  );
  return (
    <MenuContext.Provider value={ctx}>
      {children}
    </MenuContext.Provider>
  );
}

function Trigger({ tooltip = false, ref, onClick, onKeyDown, onBlur, ...props }: MenuTriggerProps) {
  const ctx = useMenu('Trigger');
  const toolbar = useToolbar(ctx.triggerRef);
  const refs = useComposedRefs(ctx.triggerRef, ref);
  const { openEnd, countTrigger } = ctx;
  useLayoutEffect(() => {
    countTrigger(1);
    return () => countTrigger(-1);
  }, [countTrigger]);
  const wire = ctx.popover.getTriggerProps({
    ...props,
    ref: refs,
    onClick: composeHandlers(onClick, () => {
      openEnd.current = null;
    }),
    // A key's request for an end lasts while the trigger has focus, so one
    // the owner refused does not carry over to a later open from code. This
    // runs even when the consumer's handler prevents the event.
    onBlur: (event: FocusEvent<HTMLButtonElement>) => {
      onBlur?.(event);
      openEnd.current = null;
    },
  });
  return (
    <Button.Root
      {...wire}
      id={ctx.triggerId}
      tooltip={tooltip}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLButtonElement>) => {
        // In a vertical toolbar, Up and Down move between its controls while
        // the menu is closed.
        const arrow = event.key === 'ArrowDown' || event.key === 'ArrowUp';
        if (arrow && !ctx.open && toolbar?.orientation === 'vertical') return;
        // A held key opens once; repeats, Enter's included, would toggle it.
        if (event.repeat && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault();
          return;
        }
        // Tab away from the trigger of a menu left open closes it too.
        if (event.key === 'Tab' && ctx.open) {
          ctx.setOpen(false, 'tab');
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const end = event.key === 'ArrowDown' ? 'first' : 'last';
        // Already open, say controlled with focus left on the trigger: go in.
        if (ctx.open) {
          if (end === 'first') ctx.roving.focusFirst();
          else ctx.roving.focusLast();
          return;
        }
        openEnd.current = end;
        ctx.setOpen(true, 'trigger');
      })}
    />
  );
}

const MODIFIER_KEYS = /* @__PURE__ */ new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph']);

function isContextKey(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.key === 'ContextMenu') return true;
  return event.key === 'F10' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/**
 * The box a key's request opens the menu below: that of `target` or its
 * nearest ancestor with one, unlike a `display: contents` wrapper.
 */
function keyBox(target: Element): ContextOpen['box'] {
  let el: Element | null = target;
  while (el && el.getClientRects().length === 0) el = el.parentElement;
  const { top, left, width, height } = (el ?? target).getBoundingClientRect();
  return { top, left, width, height };
}

function ContextTrigger({ render, ref, onContextMenu, onKeyDown, ...props }: MenuContextTriggerProps) {
  const ctx = useMenu('ContextTrigger');
  // A callback, so it fits the ref of whatever element `render` returns.
  const refs = useComposedRefs<HTMLElement>(ref as Ref<HTMLElement> | undefined);
  const source = useDomId();
  const { openAt } = ctx;
  // Requests from inside the menu are the menu's own, and a text field keeps
  // the browser's menu, which holds its editing commands.
  const claims = (target: EventTarget): target is Element =>
    target instanceof Element && !ctx.popover.popoverRef.current?.contains(target) && !isTextEntry(target);
  const request = (box: ContextOpen['box']) => {
    const active = document.activeElement;
    let opener: ContextOpen['opener'] = null;
    if ((active instanceof HTMLElement || active instanceof SVGElement) && active !== document.body) opener = active;
    // A request that comes while the menu has focus keeps the opener before it.
    if (opener && ctx.popover.popoverRef.current?.contains(opener)) opener = ctx.context?.opener ?? null;
    openAt({ box, opener, source });
  };
  const wire: MenuContextTriggerRenderProps = {
    ...props,
    ref: refs,
    'data-open': ctx.open && ctx.context?.source === source ? '' : undefined,
    // A request a child already handled, such as an inner ContextTrigger's,
    // is not this region's.
    onContextMenu: composeHandlers(onContextMenu, (event: MouseEvent<HTMLElement>) => {
      const { target } = event;
      if (event.defaultPrevented || !claims(target)) return;
      event.preventDefault();
      const native = event.nativeEvent as globalThis.MouseEvent & { pointerType?: string };
      // A key opens below its element: Chromium marks its event with button
      // -1, and Pointer Events with an empty pointerType. A screen reader's
      // command with no point does too. Any other request, a Mac Ctrl+click
      // or a long press too, opens at its point.
      const fromKey =
        event.button === -1 ||
        native.pointerType === '' ||
        (native.pointerType === undefined && event.clientX === 0 && event.clientY === 0);
      request(fromKey ? keyBox(target) : { top: event.clientY, left: event.clientX, width: 0, height: 0 });
    }),
    // Shift+F10 and the ContextMenu key open the menu from the keyboard where
    // the browser fires no contextmenu for them, as on macOS. Handling the
    // key stops the browser's own contextmenu where it would fire one.
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      const { target } = event;
      if (!isContextKey(event) || event.defaultPrevented || !claims(target)) return;
      event.preventDefault();
      if (event.repeat) return;
      request(keyBox(target));
    }),
  };
  return render ? render(wire) : <div {...(wire as ComponentPropsWithRef<'div'>)} />;
}

/**
 * The box a context request put the menu at, in the top layer so its
 * viewport coordinates hold whatever transforms its ancestors have, and the
 * menu stays put if the element it came from goes away. It shows before the
 * menu, which can only anchor to what is earlier in the top layer.
 */
function BoxAnchor({ box, name, open }: { box: ContextOpen['box']; name: string; open: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  usePopoverSync(ref, open);
  return (
    <span
      ref={ref}
      popover="manual"
      aria-hidden="true"
      className={styles.anchorBox}
      style={
        {
          '--_top': `${box.top}px`,
          '--_left': `${box.left}px`,
          '--_width': `${box.width}px`,
          '--_height': `${box.height}px`,
          anchorName: name,
        } as CSSProperties
      }
    />
  );
}

function Content({
  children,
  className,
  style,
  ref,
  onKeyDown,
  onPointerDown,
  onClick,
  onFocus,
  onBlur,
  onContextMenu,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: MenuContentProps) {
  const ctx = useMenu('Content');
  const { ref: wireRef, open, id, style: wireStyle, onPointerDown: wirePointerDown, onClick: wireClick } =
    ctx.popover.getPopoverProps();
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  const at = ctx.context;
  // A context request that comes while the menu is already open shows its box
  // after the menu, which can only anchor to what is earlier in the top
  // layer, so the menu is shown again in front of it, keeping focus.
  const anchored = useRef({ open: false, box: false });
  useLayoutEffect(() => {
    const before = anchored.current;
    anchored.current = { open, box: Boolean(at) };
    const el = localRef.current;
    if (!el || !open || !at || !before.open || before.box || !isPopoverOpen(el)) return;
    const active = document.activeElement;
    el.hidePopover();
    el.showPopover();
    // Popovers held open inside it, such as an item's tooltip, go back in front.
    reshowHeldInside(el);
    if (active instanceof HTMLElement && el.contains(active)) focusWithoutScroll(active);
  });
  const { openEnd, initialFocusRef, roving } = ctx;
  const { reachableItems } = roving;
  // However the menu opens, it starts on an end of the list, never on the
  // item focused last time. This runs before Root's initial focus.
  useLayoutEffect(() => {
    if (!open) return;
    // Items focus can reach: a hidden first item does not take the open.
    const reachable = reachableItems();
    // The key's choice holds for the open that follows it, however late the
    // owner applies it, while the trigger keeps focus.
    initialFocusRef.current = (openEnd.current === 'last' ? reachable.at(-1) : reachable[0]) ?? null;
    openEnd.current = null;
  }, [initialFocusRef, open, openEnd, reachableItems]);
  const container = roving.getContainerProps({
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      // Tab leaves the menu: close it and focus where focus goes back to (the
      // trigger, or what had focus when a context request came), whether or
      // not the owner lets the menu close. A forward Tab then moves on past
      // it. Shift+Tab stops on it, since moving back would skip it.
      if (event.key === 'Tab') {
        ctx.setOpen(false, 'tab');
        const back = ctx.restoreTarget();
        back?.focus();
        // One that could not take focus, or none, lets Tab move on from the
        // item as usual.
        if (event.shiftKey && back && document.activeElement === back) event.preventDefault();
        return;
      }
      // Context keys in the menu are its own, so a region around it doesn't
      // open another menu.
      if (isContextKey(event)) event.preventDefault();
      // Focus on the menu itself, from a press on its padding, is handled
      // by roving focus: Down and typeahead start at the first item.
    }),
  });
  const refs = useComposedRefs(localRef, wireRef, container.ref, ref);
  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'production' || !open) return;
    // Checked once a Menu.Trigger mounted beside the menu has had its render.
    queueMicrotask(() => {
      const el = localRef.current;
      if (el && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
        console.error('Menu.Content needs aria-label or aria-labelledby when no Menu.Trigger names it.');
      }
    });
  }, [open, ctx.hasTrigger, ariaLabel, ariaLabelledby]);
  const atStyle = at
    ? ({ '--todae-popover-anchor': ctx.boxName, positionAnchor: ctx.boxName } as CSSProperties)
    : undefined;
  // Focus that leaves for anything but the trigger closes the menu: a script,
  // a screen reader's focus command, or a press into an iframe, which the
  // document never sees as a pointerdown. Focus dropped to the page, as when
  // the focused item goes away, is not a move.
  const focusLeave = useFocusLeave(
    (next) => {
      if (!open || !next || next === document.body || next === ctx.triggerRef.current) return;
      ctx.setOpen(false, 'outside');
    },
    // A press outside or a Tab already asked to close; the blur it causes
    // is not another request.
    () => ctx.closeAsked.current,
  );
  return (
    <>
      {at && <BoxAnchor box={at.box} name={ctx.boxName} open={open} />}
      <div
        {...props}
        ref={refs}
        id={id}
        popover="manual"
        role="menu"
        tabIndex={-1}
        aria-label={ariaLabel}
        // The trigger names the menu when there is one; a menu opened from code
        // needs aria-label or aria-labelledby.
        aria-labelledby={ariaLabel ? undefined : (ariaLabelledby ?? (ctx.hasTrigger ? ctx.triggerId : undefined))}
        className={cx(popoverStyles.content, styles.menu, className)}
        style={{ ...wireStyle, ...atStyle, ...style }}
        onPointerDown={composeHandlers(onPointerDown, wirePointerDown)}
        onClick={composeHandlers(onClick, wireClick)}
        // The browser's own menu doesn't open over this one.
        onContextMenu={composeHandlers(onContextMenu, (event: MouseEvent<HTMLDivElement>) => event.preventDefault())}
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          onFocus?.(event);
          focusLeave.onFocus();
        }}
        // Focus leaving closes the menu whatever the consumer's handler does,
        // as Tabs.List returns its tab stop.
        onBlur={(event: FocusEvent<HTMLDivElement>) => {
          onBlur?.(event);
          focusLeave.onBlur(event);
        }}
        onKeyDown={container.onKeyDown}
      >
        <ToolbarContext.Provider value={null}>{children}</ToolbarContext.Provider>
      </div>
    </>
  );
}

type ItemRole = 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';

// A click carrying the key's modifiers, so Ctrl, Cmd or Shift with Enter
// opens a link item in a new tab or window, as it would on a plain link.
function clickWithKeys(event: KeyboardEvent<HTMLElement>) {
  const { ctrlKey, metaKey, shiftKey, altKey } = event;
  const target = event.currentTarget;
  const view = target.ownerDocument.defaultView ?? window;
  target.dispatchEvent(new view.MouseEvent('click', { bubbles: true, cancelable: true, composed: true, ctrlKey, metaKey, shiftKey, altKey }));
}

function useItem(
  ctx: MenuContextValue,
  role: ItemRole,
  {
    disabled,
    textValue,
    className,
    onClick,
    onKeyDown,
    onKeyUp,
    onMouseDown,
    onPointerMove,
    onBlur,
    ...props
  }: Omit<ItemBase, 'children'>,
  activate: () => void,
  checked?: boolean,
) {
  const value = useDomId();
  const spacePressed = useRef(false);
  // Disabled items stay in the arrow-key order, as menus conventionally do,
  // so a screen reader announces them as unavailable; they just can't be chosen.
  const item = ctx.roving.getItemProps(value, { textValue }, props);
  return {
    ...item,
    role,
    'aria-checked': checked,
    'aria-disabled': disabled || undefined,
    'data-disabled': disabled ? '' : undefined,
    className: cx(styles.item, className),
    // Keys choose through a click too, so an item rendered as a link follows
    // it. A disabled one goes nowhere and, like a disabled button, runs no
    // onClick.
    onClick: disabled
      ? (event: MouseEvent<HTMLDivElement>) => event.preventDefault()
      : composeHandlers(onClick, activate),
    // Enter chooses on keydown. Space chooses on keyup, like a native button:
    // choosing on keydown would close the menu and hand the keyup to the
    // trigger, which some browsers click, reopening the menu. A Space typed
    // into a typeahead search is part of the search, not a choice.
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
      // Keys in a control inside the item belong to that control.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        // A held Enter chooses once; its repeats must not reach the trigger.
        if (!event.repeat) clickWithKeys(event);
      } else if (event.key === ' ') {
        // Left unprevented while typing, so the menu's typeahead still sees it.
        spacePressed.current = !ctx.roving.isTypingAhead(event);
        if (spacePressed.current) event.preventDefault();
      }
    }),
    onKeyUp: composeHandlers(onKeyUp, (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== ' ' || event.target !== event.currentTarget) return;
      event.preventDefault();
      const pressed = spacePressed.current;
      spacePressed.current = false;
      if (pressed) clickWithKeys(event);
    }),
    // A Space released on another item chooses nothing.
    onBlur: composeHandlers(onBlur, () => {
      spacePressed.current = false;
    }),
    // A press must not focus a disabled item.
    onMouseDown: composeHandlers(onMouseDown, (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) event.preventDefault();
    }),
    // The pointer moves focus, so the highlight and the keyboard agree.
    // Disabled items take focus too, as they do from the keyboard, so no
    // other item stays highlighted for Enter and the arrow keys keep their place.
    onPointerMove: composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return;
      if (document.activeElement !== event.currentTarget) focusWithoutScroll(event.currentTarget);
    }),
  };
}

function Item({ children, onSelect, closeOnSelect = true, render, ...props }: MenuItemProps) {
  const ctx = useMenu('Item');
  const item = useItem(ctx, 'menuitem', props, () => {
    onSelect?.();
    if (closeOnSelect) ctx.setOpen(false, 'select');
  });
  return render ? render({ ...(item as MenuItemRenderProps), children }) : <div {...item}>{children}</div>;
}

function CheckboxItem({
  children,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  closeOnSelect = false,
  ...props
}: MenuCheckboxItemProps) {
  const ctx = useMenu('CheckboxItem');
  const { check } = useGlyphs();
  const [checked, setChecked] = useControlledValue(checkedProp, defaultChecked ?? false, onCheckedChange);
  const item = useItem(
    ctx,
    'menuitemcheckbox',
    props,
    () => {
      setChecked(!checked);
      if (closeOnSelect) ctx.setOpen(false, 'select');
    },
    checked,
  );
  return (
    <div {...item}>
      <span className={styles.indicator} data-todae-glyph="" aria-hidden="true">
        {glyphOr(check, <CheckGlyph />)}
      </span>
      {children}
    </div>
  );
}

function Group({ children, className, ...props }: MenuGroupProps) {
  return (
    <div {...props} role="group" className={cx(styles.group, className)}>
      {children}
    </div>
  );
}

function RadioGroup({ value: valueProp, defaultValue, onValueChange, ...props }: MenuRadioGroupProps) {
  // Only items select, so a change is never back to null.
  const notify = useCallback((next: string | null) => next !== null && onValueChange?.(next), [onValueChange]);
  const [value, select] = useControlledValue<string | null>(valueProp, defaultValue ?? null, notify);
  const radio = useMemo(() => ({ value, select }), [select, value]);
  return (
    <RadioContext.Provider value={radio}>
      <Group {...props} />
    </RadioContext.Provider>
  );
}

function RadioItem({ children, value, closeOnSelect = false, ...props }: MenuRadioItemProps) {
  const ctx = useMenu('RadioItem');
  const group = useContext(RadioContext);
  if (!group) throw new Error('Menu.RadioItem must render inside Menu.RadioGroup');
  const item = useItem(
    ctx,
    'menuitemradio',
    props,
    () => {
      group.select(value);
      if (closeOnSelect) ctx.setOpen(false, 'select');
    },
    group.value === value,
  );
  return (
    <div {...item}>
      <span className={styles.indicator} aria-hidden="true" />
      {children}
    </div>
  );
}

function Separator({ className, ...props }: MenuSeparatorProps) {
  return <div {...props} role="separator" className={cx(styles.separator, className)} />;
}

export const Menu = {
  Root,
  Trigger,
  ContextTrigger,
  Content,
  Item,
  CheckboxItem,
  Group,
  RadioGroup,
  RadioItem,
  Separator,
} as const;
