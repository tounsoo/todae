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
import { useControlledState } from '../hooks/useControlledState.js';
import { usePopoverInternal, type PopoverCloseReason, type UsePopoverResult } from '../overlay/popover.js';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus.js';
import { isPopoverOpen, reshowHeldInside, usePopoverSync } from '../overlay/usePopoverSync.js';
import { anchoredContentStyle, anchorTriggerStyle } from '../overlay/anchorName.js';
import { tokenMs } from '../overlay/cssTime.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';
import { aimPopoverOrigin } from '../overlay/popoverOrigin.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useFocusLeave } from '../overlay/useFocusLeave.js';
import { Button, type ButtonActionProps } from './Button.js';
import { useDomId } from '../internal/domId.js';
import { CheckGlyph, ChevronGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import popoverStyles from './Popover.module.css';
import styles from './Menu.module.css';
import { ToolbarContext, useToolbar } from '../internal/toolbarContext.js';
import { focusWithoutScroll } from '../internal/revealRing.js';

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

/**
 * Why a submenu opened or closed. `trigger` is a click or key on its
 * Menu.SubmenuTrigger; `pointer` is the pointer resting on it; `escape` is
 * Escape or a close request; `arrow` is the arrow key toward the line's start;
 * `parent` is focus moving elsewhere in the menu it sits in, or that menu
 * closing.
 */
export type MenuSubmenuOpenChangeReason = 'trigger' | 'pointer' | 'escape' | 'arrow' | 'parent';

export type MenuSubmenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: MenuSubmenuOpenChangeReason) => void;
  children?: ReactNode;
};

export type MenuSubmenuTriggerProps = ItemBase;

/** Named by its Menu.SubmenuTrigger. */
export type MenuSubmenuContentProps = {
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'popover' | 'children' | 'aria-label' | 'aria-labelledby' | 'id'>;

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
  setContext: (context: ContextOpen | null) => void;
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

type Point = readonly [x: number, y: number];

/** The pointer is on its way to a submenu, across the items between, until `until`. */
type Grace = { area: readonly Point[]; until: number };

/** One list of items: the menu's own, or a submenu's. */
type MenuLevelValue = {
  roving: UseRovingFocusResult;
  /** This list is shown. */
  open: boolean;
  /** Closes the whole menu, as choosing an item does. */
  close: (reason: 'select') => void;
  /** Set while the pointer crosses this list's items toward a submenu; they then leave focus where it is. */
  grace: RefObject<Grace | null>;
};

const MenuLevelContext = /* @__PURE__ */ createContext<MenuLevelValue | null>(null);

function useLevel(part: string): MenuLevelValue {
  const level = useContext(MenuLevelContext);
  if (!level) throw new Error(`Menu.${part} must render inside Menu.Root`);
  return level;
}

function inside([x, y]: Point, area: readonly Point[]): boolean {
  let hit = false;
  for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
    const [xi, yi] = area[i]!;
    const [xj, yj] = area[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The pointer is still on its way to a submenu. Drops a grace that ran out or that the pointer left. */
function inGrace(level: MenuLevelValue, event: PointerEvent<HTMLElement>): boolean {
  const grace = level.grace.current;
  if (!grace) return false;
  if (performance.now() <= grace.until && inside([event.clientX, event.clientY], grace.area)) return true;
  level.grace.current = null;
  return false;
}

function Root({ open: openProp, defaultOpen, onOpenChange, children }: MenuRootProps) {
  const [open, setOpenValue] = useControlledState(openProp, defaultOpen ?? false, onOpenChange);
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
    {
      open,
      // A read-only open has no one to ask, so the popover asks no one either.
      onOpenChange: openProp === undefined || onOpenChange ? setOpen : undefined,
      restoreFocusRef,
      initialFocusRef,
      haspopup: 'menu',
    },
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
      setContext,
      restoreTarget,
      boxName,
      popover,
      roving,
    }),
    [open, setOpen, triggerId, hasTrigger, countTrigger, context, openAt, setContext, restoreTarget, boxName, popover, roving],
  );
  const grace = useRef<Grace | null>(null);
  const level = useMemo<MenuLevelValue>(
    () => ({ roving, open, close: (reason) => setOpen(false, reason), grace }),
    [open, roving, setOpen],
  );
  return (
    <MenuContext.Provider value={ctx}>
      <MenuLevelContext.Provider value={level}>{children}</MenuLevelContext.Provider>
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
      // A click that opens drops a context request the owner turned down,
      // even when the popover has no one to ask.
      if (!ctx.open) ctx.setContext(null);
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
function BoxAnchor({
  box,
  name,
  open,
  ref,
}: {
  box: ContextOpen['box'];
  name: string;
  open: boolean;
  ref: RefObject<HTMLSpanElement | null>;
}) {
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
  const boxRef = useRef<HTMLSpanElement | null>(null);
  // A menu at a context request's box keeps that box, shown, while its exit
  // fade runs, so it fades where it sat. Root drops the request as it closes.
  const [kept, setKept] = useState(ctx.context);
  const [fading, setFading] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open && ctx.context !== kept) setKept(ctx.context);
  if (wasOpen !== open) {
    setWasOpen(open);
    setFading(!open && kept !== null);
  }
  // A request that comes while it fades, and that its owner turns down, does
  // not move it.
  const at = !open && fading ? kept : ctx.context;
  // A context request that comes while the menu is already shown, open or
  // fading out, shows its box after the menu, which can only anchor to what
  // is earlier in the top layer, so the menu is shown again in front of it,
  // keeping focus.
  const anchored = useRef({ shown: false, box: false });
  usePopoverSync(localRef, open, {
    onExited: () => {
      // Hidden now, so a later context request needs no re-show.
      anchored.current.shown = false;
      setFading(false);
    },
  });
  useLayoutEffect(() => {
    const before = anchored.current;
    const el = localRef.current;
    anchored.current = { shown: Boolean(el && isPopoverOpen(el)), box: Boolean(at) };
    if (!el || !open || !at || !before.shown || before.box || !isPopoverOpen(el)) return;
    const active = document.activeElement;
    el.hidePopover();
    el.showPopover();
    // Popovers held open inside it, such as an item's tooltip, go back in front.
    reshowHeldInside(el);
    if (active instanceof HTMLElement && el.contains(active)) focusWithoutScroll(active);
  });
  // A menu at a context request's box grows from that box. This runs after
  // the box and the menu show.
  useLayoutEffect(() => {
    const el = localRef.current;
    const box = boxRef.current;
    if (open && at && el && box) aimPopoverOrigin(el, box);
  }, [at, open]);
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
  const atStyle = at && (open || fading) ? anchoredContentStyle('--todae-popover-anchor', ctx.boxName) : undefined;
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
      {at && <BoxAnchor ref={boxRef} box={at.box} name={ctx.boxName} open={open || fading} />}
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
  level: MenuLevelValue,
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
  const item = level.roving.getItemProps(value, { textValue }, props);
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
        spacePressed.current = !level.roving.isTypingAhead(event);
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
    // A pointer crossing items on its way to an open submenu moves nothing.
    onPointerMove: composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch' || inGrace(level, event)) return;
      if (document.activeElement !== event.currentTarget) focusWithoutScroll(event.currentTarget);
    }),
  };
}

function Item({ children, onSelect, closeOnSelect = true, render, ...props }: MenuItemProps) {
  const level = useLevel('Item');
  const item = useItem(level, 'menuitem', props, () => {
    onSelect?.();
    if (closeOnSelect) level.close('select');
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
  const level = useLevel('CheckboxItem');
  const { check } = useGlyphs();
  const [checked, setChecked, latestChecked] = useControlledState(checkedProp, defaultChecked ?? false, onCheckedChange);
  const item = useItem(
    level,
    'menuitemcheckbox',
    props,
    () => {
      setChecked(!latestChecked());
      if (closeOnSelect) level.close('select');
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
  const [value, select] = useControlledState<string | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange &&
      ((next) => {
        if (next !== null) onValueChange(next);
      }),
  );
  const radio = useMemo(() => ({ value, select }), [select, value]);
  return (
    <RadioContext.Provider value={radio}>
      <Group {...props} />
    </RadioContext.Provider>
  );
}

function RadioItem({ children, value, closeOnSelect = false, ...props }: MenuRadioItemProps) {
  const level = useLevel('RadioItem');
  const group = useContext(RadioContext);
  if (!group) throw new Error('Menu.RadioItem must render inside Menu.RadioGroup');
  const item = useItem(
    level,
    'menuitemradio',
    props,
    () => {
      group.select(value);
      if (closeOnSelect) level.close('select');
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

/** How long the pointer rests on a Menu.SubmenuTrigger before its submenu opens, where no token says. */
const SUBMENU_SHOW_DELAY_MS = 100;
/** How long the pointer has to reach an open submenu across the items between, where no token says. */
const SUBMENU_GRACE_MS = 300;

type SubmenuContextValue = {
  open: boolean;
  setOpen: (open: boolean, reason: MenuSubmenuOpenChangeReason) => void;
  /** The list the submenu's trigger sits in. */
  parent: MenuLevelValue;
  /** The submenu's own list. */
  level: MenuLevelValue;
  triggerId: string;
  contentId: string;
  anchorName: string;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  /** A key, or a click with no pointer, asked the next open to focus the first item. */
  focusFirst: RefObject<boolean>;
};

const SubmenuContext = /* @__PURE__ */ createContext<SubmenuContextValue | null>(null);

function useSubmenu(part: string): SubmenuContextValue {
  const ctx = useContext(SubmenuContext);
  if (!ctx) throw new Error(`Menu.${part} must render inside Menu.Submenu`);
  return ctx;
}

/** Whether `el` reads right to left, so the arrow keys toward the line's start and end swap. */
function isRtl(el: Element): boolean {
  return getComputedStyle(el).direction === 'rtl';
}

function Submenu({ open: openProp, defaultOpen, onOpenChange, children }: MenuSubmenuProps) {
  const parent = useLevel('Submenu');
  const [open, setOpen] = useControlledState(openProp, defaultOpen ?? false, onOpenChange);
  const domId = useDomId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const focusFirst = useRef(false);
  const grace = useRef<Grace | null>(null);
  // Like the menu's own list: every open starts at its first item, and its
  // items are never Tab stops.
  const roving = useRovingFocus({ orientation: 'vertical', typeahead: true, activeValue: null, tabStop: false });
  // A submenu shows only while the list it sits in does.
  const shown = open && parent.open;
  useLayoutEffect(() => {
    if (open && !parent.open) setOpen(false, 'parent');
  }, [open, parent.open, setOpen]);
  // Focus that moves anywhere but its trigger or inside it, such as to
  // another item of the list it sits in, closes it. Focus dropped to the
  // page, as when the focused item goes away, is not a move.
  useEffect(() => {
    if (!shown) return;
    const onFocusIn = (event: globalThis.FocusEvent) => {
      const next = event.target;
      if (!(next instanceof Element) || next === document.body) return;
      if (next === triggerRef.current || contentRef.current?.contains(next)) return;
      setOpen(false, 'parent');
    };
    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, [shown, setOpen]);
  // Focus left inside as it closes goes back to its trigger, so it isn't lost
  // to the page while the submenu fades.
  useLayoutEffect(() => {
    if (shown) return;
    const active = document.activeElement;
    if (active && contentRef.current?.contains(active) && triggerRef.current) focusWithoutScroll(triggerRef.current);
  }, [shown]);
  const level = useMemo<MenuLevelValue>(
    () => ({ roving, open: shown, close: parent.close, grace }),
    [parent.close, roving, shown],
  );
  const ctx = useMemo<SubmenuContextValue>(
    () => ({
      open: shown,
      setOpen,
      parent,
      level,
      triggerId: `${domId}-trigger`,
      contentId: `${domId}-content`,
      anchorName: `--${domId}-submenu`,
      triggerRef,
      contentRef,
      focusFirst,
    }),
    [domId, level, parent, setOpen, shown],
  );
  return <SubmenuContext.Provider value={ctx}>{children}</SubmenuContext.Provider>;
}

function SubmenuTrigger({
  children,
  disabled,
  ref,
  style,
  onClick,
  onKeyDown,
  onPointerMove,
  onPointerLeave,
  ...props
}: MenuSubmenuTriggerProps) {
  const sub = useSubmenu('SubmenuTrigger');
  const { chevron } = useGlyphs();
  const refs = useComposedRefs<HTMLDivElement>(sub.triggerRef as Ref<HTMLDivElement>, ref);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelTimer = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(() => cancelTimer, []);
  // A key or a click with no pointer goes into the submenu: it opens, or, open
  // already, hands focus to its first item.
  const enter = () => {
    cancelTimer();
    if (sub.open) {
      sub.level.roving.focusFirst();
      return;
    }
    sub.focusFirst.current = true;
    sub.setOpen(true, 'trigger');
  };
  const item = useItem(
    sub.parent,
    'menuitem',
    {
      ...props,
      disabled,
      onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || disabled) return;
        const toEnd = isRtl(event.currentTarget) ? 'ArrowLeft' : 'ArrowRight';
        const space = event.key === ' ' && !sub.parent.roving.isTypingAhead(event);
        if (event.key !== 'Enter' && event.key !== toEnd && !space) return;
        // Handled here, so the item's own Enter and Space choose nothing.
        event.preventDefault();
        if (!event.repeat) enter();
      }),
      // The pointer resting on it opens it; one that moves on first doesn't.
      onPointerMove: composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch' || disabled || sub.open || timer.current !== undefined) return;
        if (inGrace(sub.parent, event)) return;
        const delay = tokenMs(event.currentTarget, '--todae-menu-submenu-delay-show') ?? SUBMENU_SHOW_DELAY_MS;
        timer.current = setTimeout(() => {
          timer.current = undefined;
          sub.setOpen(true, 'pointer');
        }, delay);
      }),
      // A pointer that leaves toward the open submenu may cross other items
      // of this list on the way, which keep focus where it is meanwhile.
      onPointerLeave: composeHandlers(onPointerLeave, (event: PointerEvent<HTMLDivElement>) => {
        cancelTimer();
        const content = sub.contentRef.current;
        if (event.pointerType === 'touch' || !sub.open || !content) return;
        const box = content.getBoundingClientRect();
        const from = event.currentTarget.getBoundingClientRect();
        const toRight = box.left + box.width / 2 >= from.left + from.width / 2;
        const near = toRight ? box.left : box.right;
        const far = toRight ? box.right : box.left;
        // From a little behind the point it left at, so that point is inside.
        const back = toRight ? -5 : 5;
        const ms = tokenMs(event.currentTarget, '--todae-menu-submenu-delay-hide') ?? SUBMENU_GRACE_MS;
        sub.parent.grace.current = {
          area: [
            [event.clientX + back, event.clientY],
            [near, box.top],
            [far, box.top],
            [far, box.bottom],
            [near, box.bottom],
          ],
          until: performance.now() + ms,
        };
      }),
    },
    () => {
      // A pointer's click opens it and leaves focus here; a click with no
      // pointer, such as a screen reader's, goes in.
      if (!sub.open) sub.setOpen(true, 'trigger');
    },
  );
  return (
    <div
      {...item}
      ref={refs}
      id={sub.triggerId}
      aria-haspopup="menu"
      aria-expanded={sub.open}
      aria-controls={sub.contentId}
      data-open={sub.open ? '' : undefined}
      style={anchorTriggerStyle('--todae-popover-anchor', sub.anchorName, style)}
      onClick={composeHandlers(onClick, (event: MouseEvent<HTMLDivElement>) => {
        if (!disabled && event.detail === 0) {
          enter();
          return;
        }
        item.onClick(event);
      })}
    >
      {children}
      <span className={styles.submenuIndicator} data-todae-glyph="" aria-hidden="true">
        {glyphOr(chevron, <ChevronGlyph />)}
      </span>
    </div>
  );
}

function SubmenuContent({ children, className, style, ref, onKeyDown, onPointerMove, ...props }: MenuSubmenuContentProps) {
  const sub = useSubmenu('SubmenuContent');
  const refs = useComposedRefs<HTMLDivElement>(sub.contentRef, ref);
  usePopoverSync(sub.contentRef, sub.open, {});
  // It grows from its trigger, and an open asked for by a key or a click with
  // no pointer focuses its first item. This runs after it shows.
  const { roving } = sub.level;
  useLayoutEffect(() => {
    const el = sub.contentRef.current;
    const trigger = sub.triggerRef.current;
    if (!sub.open || !el) return;
    if (trigger) aimPopoverOrigin(el, trigger);
    if (sub.focusFirst.current) roving.focusFirst();
    sub.focusFirst.current = false;
  }, [roving, sub.contentRef, sub.focusFirst, sub.open, sub.triggerRef]);
  const back = useCallback(
    (reason: 'escape' | 'arrow') => {
      sub.setOpen(false, reason);
      const trigger = sub.triggerRef.current;
      if (trigger) focusWithoutScroll(trigger);
    },
    [sub],
  );
  // Escape closes this submenu only, the innermost open layer.
  useEscapeKey(sub.open, true, () => back('escape'), sub.contentRef);
  const container = roving.getContainerProps({
    ref: refs,
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      // Keys from a submenu inside this one are that submenu's.
      const { target } = event;
      if (!(target instanceof Element) || target.closest('[role="menu"]') !== event.currentTarget) return;
      const toStart = isRtl(event.currentTarget) ? 'ArrowRight' : 'ArrowLeft';
      if (event.key !== toStart || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      back('arrow');
    }),
  });
  return (
    <div
      {...props}
      ref={container.ref}
      id={sub.contentId}
      popover="manual"
      role="menu"
      tabIndex={-1}
      aria-labelledby={sub.triggerId}
      className={cx(popoverStyles.content, popoverStyles.beside, styles.menu, className)}
      style={{ ...anchoredContentStyle('--todae-popover-anchor', sub.anchorName), ...style }}
      onKeyDown={container.onKeyDown}
      // The pointer reached it, so the list it opened from holds focus no longer.
      onPointerMove={composeHandlers(onPointerMove, () => {
        sub.parent.grace.current = null;
      })}
    >
      <MenuLevelContext.Provider value={sub.level}>{children}</MenuLevelContext.Provider>
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
  Submenu,
  SubmenuTrigger,
  SubmenuContent,
} as const;
