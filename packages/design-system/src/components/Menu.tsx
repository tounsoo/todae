import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState';
import { usePopoverInternal, type PopoverCloseReason, type UsePopoverResult } from '../hooks/usePopover';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus';
import { usePopoverSync } from '../overlay/usePopoverSync';
import { useGlyphs } from '../providers/GlyphsProvider';
import { useFocusLeave } from '../overlay/useFocusLeave';
import { Button, type ButtonActionProps } from './Button';
import { useDomId } from './domId';
import { CheckGlyph, glyphOr } from './glyphs';
import { composeHandlers, cx, useComposedRefs } from './props';
import popoverStyles from './Popover.module.css';
import styles from './Menu.module.css';
import { ToolbarContext, useToolbar } from './toolbarContext';

/** Why the menu opened or closed. `select` is an item choice; `tab` is focus leaving with Tab. */
export type MenuOpenChangeReason = PopoverCloseReason | 'select' | 'tab';

export type MenuRootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: MenuOpenChangeReason) => void;
  children?: ReactNode;
};

/** The id is the menu's: the content is named by it. */
export type MenuTriggerProps = Omit<ButtonActionProps, 'id'>;

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

export type MenuItemProps = ItemBase & {
  onSelect?: () => void;
  /** Close the menu after this item is chosen. */
  closeOnSelect?: boolean;
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
  popover: UsePopoverResult;
  roving: UseRovingFocusResult;
};

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(part: string): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error(`Menu.${part} must render inside Menu.Root`);
  return ctx;
}

type RadioContextValue = { value: string | null; select: (value: string) => void };

const RadioContext = createContext<RadioContextValue | null>(null);

function Root({ open: openProp, defaultOpen, onOpenChange, children }: MenuRootProps) {
  const [open, setOpenValue] = useControlledValue(openProp, defaultOpen ?? false, onOpenChange);
  // Set while the input that asked for a close is still being handled, so
  // the focus move that same input makes does not ask a second time.
  const closeAsked = useRef(false);
  const setOpen = useCallback(
    (next: boolean, reason: MenuOpenChangeReason) => {
      if (!next) {
        closeAsked.current = true;
        setTimeout(() => {
          closeAsked.current = false;
        });
      }
      setOpenValue(next, reason);
    },
    [setOpenValue],
  );
  const triggerId = `${useDomId()}-trigger`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [triggers, setTriggers] = useState(0);
  const hasTrigger = triggers > 0;
  const countTrigger = useCallback((change: 1 | -1) => setTriggers((n) => n + change), []);
  const openEnd = useRef<'first' | 'last' | null>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const popover = usePopoverInternal(
    { open, onOpenChange: setOpen, restoreFocusRef: triggerRef, initialFocusRef, haspopup: 'menu' },
    true,
  );
  // The item chosen for one open never carries over to the next.
  useLayoutEffect(() => {
    if (!open) initialFocusRef.current = null;
  }, [open]);
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
      popover,
      roving,
    }),
    [open, setOpen, triggerId, hasTrigger, countTrigger, popover, roving],
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
      // A click the consumer prevents does not open the menu.
      onClick={composeHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
        openEnd.current = null;
        wire.onClick(event);
      })}
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
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: MenuContentProps) {
  const ctx = useMenu('Content');
  const { ref: wireRef, open, id, style: wireStyle, onPointerDown: wirePointerDown, onClick: wireClick } =
    ctx.popover.getPopoverProps();
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
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
      // Tab leaves the menu: close it and focus the trigger, whether or not
      // the owner lets the menu close. A forward Tab then moves on past the
      // trigger. Shift+Tab stops on it, since moving back would skip it.
      if (event.key === 'Tab') {
        ctx.setOpen(false, 'tab');
        const trigger = ctx.triggerRef.current;
        trigger?.focus();
        // A trigger that could not take focus, or none, lets Tab move on from
        // the item as usual.
        if (event.shiftKey && trigger && document.activeElement === trigger) event.preventDefault();
        return;
      }
      // Focus on the menu itself, from a press on its padding, is handled
      // by roving focus: Down and typeahead start at the first item.
    }),
  });
  const refs = useComposedRefs(localRef, wireRef, container.ref, ref);
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
      style={{ ...wireStyle, ...style }}
      onPointerDown={composeHandlers(onPointerDown, wirePointerDown)}
      onClick={composeHandlers(onClick, wireClick)}
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
  );
}

type ItemRole = 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';

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
  const value = useId();
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
    onClick: composeHandlers(onClick, () => {
      if (!disabled) activate();
    }),
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
        if (!disabled && !event.repeat) activate();
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
      if (pressed && !disabled) activate();
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
      if (document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
    }),
  };
}

function Item({ children, onSelect, closeOnSelect = true, ...props }: MenuItemProps) {
  const ctx = useMenu('Item');
  const item = useItem(ctx, 'menuitem', props, () => {
    onSelect?.();
    if (closeOnSelect) ctx.setOpen(false, 'select');
  });
  return <div {...item}>{children}</div>;
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
  Content,
  Item,
  CheckboxItem,
  Group,
  RadioGroup,
  RadioItem,
  Separator,
} as const;
