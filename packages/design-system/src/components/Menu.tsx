import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledState, useControlledValue } from '../hooks/useControlledState';
import { usePopoverInternal, type PopoverCloseReason, type UsePopoverResult } from '../hooks/usePopover';
import { useRovingFocus, type UseRovingFocusResult } from '../hooks/useRovingFocus';
import { usePopoverSync } from '../overlay/usePopoverSync';
import { Button, type ButtonRootProps } from './Button';
import { composeHandlers, cx, useComposedRefs } from './props';
import popoverStyles from './Popover.module.css';
import styles from './Menu.module.css';

/** Why the menu opened or closed. `select` is an item choice; `tab` is focus leaving with Tab. */
export type MenuOpenChangeReason = PopoverCloseReason | 'select' | 'tab';

export type MenuRootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: MenuOpenChangeReason) => void;
  children?: ReactNode;
};

/** The id is the menu's: the content is named by it. */
export type MenuTriggerProps = Omit<ButtonRootProps, 'id'>;

type MenuName =
  | { 'aria-label'?: undefined; 'aria-labelledby'?: string }
  | { 'aria-label': string; 'aria-labelledby'?: undefined };

/** Named by its trigger unless `aria-label` or `aria-labelledby` says otherwise. */
export type MenuContentProps = {
  children?: ReactNode;
  className?: string;
} & MenuName &
  Omit<ComponentPropsWithRef<'div'>, 'role' | 'popover' | 'children' | 'aria-label' | 'aria-labelledby'>;

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
  Omit<ComponentPropsWithRef<'div'>, 'role' | 'children' | 'aria-label' | 'aria-labelledby'>;

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
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
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
  const [open, setOpen] = useControlledValue(openProp, defaultOpen ?? false, onOpenChange);
  const triggerId = `${useId().replaceAll(':', '')}-trigger`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openEnd = useRef<'first' | 'last' | null>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const popover = usePopoverInternal(
    { open, onOpenChange: setOpen, restoreFocusRef: triggerRef, initialFocusRef, haspopup: 'menu' },
    true,
  );
  // Every open starts at an end of the list, so the menu never needs to
  // remember the focused item. Held at null, focus moving across items under
  // the pointer does not render the menu.
  const roving = useRovingFocus({ orientation: 'vertical', typeahead: true, activeValue: null });
  const ctx = useMemo(
    () => ({ open, setOpen, triggerId, triggerRef, openEnd, initialFocusRef, popover, roving }),
    [open, setOpen, triggerId, popover, roving],
  );
  return (
    <MenuContext.Provider value={ctx}>
      {children}
    </MenuContext.Provider>
  );
}

function Trigger({ tooltip = false, ref, onClick, onKeyDown, onBlur, ...props }: MenuTriggerProps) {
  const ctx = useMenu('Trigger');
  const refs = useComposedRefs(ctx.triggerRef, ref);
  const { openEnd } = ctx;
  const wire = ctx.popover.getTriggerProps({
    ...props,
    ref: refs,
    // A key's request for an end lasts while the trigger has focus, so one
    // the owner refused does not carry over to a later open from code.
    onBlur: composeHandlers(onBlur, () => {
      openEnd.current = null;
    }),
  });
  return (
    <Button.Root
      {...wire}
      // A click the consumer prevents does not open the menu.
      onClick={composeHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
        ctx.openEnd.current = null;
        wire.onClick(event);
      })}
      id={ctx.triggerId}
      tooltip={tooltip}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLButtonElement>) => {
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
        ctx.openEnd.current = end;
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
  const { reachableValues, getItemNode } = roving;
  // However the menu opens, it starts on an end of the list, never on the
  // item focused last time. This runs before Root's initial focus.
  useLayoutEffect(() => {
    if (!open) return;
    // Items focus can reach: a hidden first item does not take the open.
    const enabled = reachableValues();
    // The key's choice holds for the open that follows it, however late the
    // owner applies it, while the trigger keeps focus.
    const target = openEnd.current === 'last' ? enabled.at(-1) : enabled[0];
    initialFocusRef.current = target === undefined ? null : getItemNode(target);
    openEnd.current = null;
  }, [getItemNode, initialFocusRef, open, openEnd, reachableValues]);
  const container = roving.getContainerProps({
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      // Tab leaves the menu: close it, and focus returns to the trigger.
      // Tab then moves on past the trigger. Shift+Tab stops on the trigger,
      // since moving back from it would skip it.
      if (event.key === 'Tab') {
        ctx.setOpen(false, 'tab');
        // Focus goes to the trigger whether or not the owner lets the menu
        // close, so it always leaves the menu: a forward Tab then moves on
        // from the trigger, and Shift+Tab stops on it.
        ctx.triggerRef.current?.focus();
        if (event.shiftKey) event.preventDefault();
        return;
      }
      // Focus on the menu itself, from a press on its padding, is handled
      // by roving focus: Down and typeahead start at the first item.
    }),
  });
  const refs = useComposedRefs(localRef, wireRef, container.ref, ref);
  return (
    <div
      {...props}
      ref={refs}
      id={id}
      popover="manual"
      role="menu"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : (ariaLabelledby ?? ctx.triggerId)}
      className={cx(popoverStyles.content, styles.menu, className)}
      style={{ ...wireStyle, ...style }}
      onPointerDown={composeHandlers(onPointerDown, wirePointerDown)}
      onClick={composeHandlers(onClick, wireClick)}
      onKeyDown={container.onKeyDown}
    >
      {children}
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
    // Focus enters a menu only from its trigger, never by Tab, so even when an
    // owner keeps the menu open, Tab from the trigger moves past it.
    tabIndex: -1,
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
      if (event.key !== ' ') return;
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
    // On a disabled item the menu itself takes focus, so no other item stays
    // highlighted for Enter to choose.
    onPointerMove: composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch') return;
      const target = disabled ? event.currentTarget.closest<HTMLElement>('[role="menu"]') : event.currentTarget;
      if (target && document.activeElement !== target) target.focus({ preventScroll: true });
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
  const [checked, setChecked] = useControlledState(checkedProp, defaultChecked ?? false);
  const item = useItem(
    ctx,
    'menuitemcheckbox',
    props,
    () => {
      setChecked(!checked);
      onCheckedChange?.(!checked);
      if (closeOnSelect) ctx.setOpen(false, 'select');
    },
    checked,
  );
  return (
    <div {...item}>
      <span className={styles.indicator} aria-hidden="true" />
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
