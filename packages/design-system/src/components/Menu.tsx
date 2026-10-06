import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledState } from '../hooks/useControlledState';
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
  /** Which end the next open focuses. Reset to first after each open. */
  openEnd: RefObject<'first' | 'last'>;
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
  const [open, setValue] = useControlledState(openProp, defaultOpen ?? false);
  const triggerId = `${useId().replaceAll(':', '')}-trigger`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openEnd = useRef<'first' | 'last'>('first');
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const setOpen = useCallback(
    (next: boolean, reason: MenuOpenChangeReason) => {
      if (next === open) return;
      setValue(next);
      onOpenChange?.(next, reason);
    },
    [onOpenChange, open, setValue],
  );
  const popover = usePopoverInternal(
    { open, onOpenChange: setOpen, restoreFocusRef: triggerRef, initialFocusRef, haspopup: 'menu' },
    true,
  );
  const roving = useRovingFocus({ orientation: 'vertical', typeahead: true });
  return (
    <MenuContext.Provider value={{ open, setOpen, triggerId, triggerRef, openEnd, initialFocusRef, popover, roving }}>
      {children}
    </MenuContext.Provider>
  );
}

function Trigger({ tooltip = false, ref, onClick, onKeyDown, ...props }: MenuTriggerProps) {
  const ctx = useMenu('Trigger');
  const refs = useComposedRefs(ctx.triggerRef, ref);
  const wire = ctx.popover.getTriggerProps({
    ...props,
    ref: refs,
    onClick: composeHandlers(onClick, () => {
      ctx.openEnd.current = 'first';
    }),
  });
  return (
    <Button.Root
      {...wire}
      id={ctx.triggerId}
      tooltip={tooltip}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        ctx.openEnd.current = event.key === 'ArrowDown' ? 'first' : 'last';
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
  const { values, getItemNode } = roving;
  // However the menu opens, it starts on an end of the list, never on the
  // item focused last time. This runs before Root's initial focus.
  useLayoutEffect(() => {
    if (!open) return;
    const enabled = values();
    const target = openEnd.current === 'last' ? enabled.at(-1) : enabled[0];
    initialFocusRef.current = target === undefined ? null : getItemNode(target);
    openEnd.current = 'first';
  }, [getItemNode, initialFocusRef, open, openEnd, values]);
  const container = roving.getContainerProps({
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      // Tab leaves the menu: close it and let the browser move focus on.
      if (event.key === 'Tab') {
        ctx.setOpen(false, 'tab');
        return;
      }
      // Focus can land on the menu itself, from a press on its padding.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowDown' || event.key === 'Home') {
        event.preventDefault();
        roving.focusFirst();
      } else if (event.key === 'ArrowUp' || event.key === 'End') {
        event.preventDefault();
        roving.focusLast();
      }
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
    ...props
  }: Omit<ItemBase, 'children'>,
  activate: () => void,
  checked?: boolean,
) {
  const value = useId();
  const spacePressed = useRef(false);
  const item = ctx.roving.getItemProps(value, { disabled, textValue }, props);
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
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!disabled) activate();
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
    // A press must not focus a disabled item.
    onMouseDown: composeHandlers(onMouseDown, (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) event.preventDefault();
    }),
    // The pointer moves focus, so the highlight and the keyboard agree.
    onPointerMove: composeHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
      if (disabled || event.pointerType === 'touch') return;
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
  const [value, setValue] = useControlledState(valueProp, defaultValue ?? null);
  const select = (next: string) => {
    if (next === value) return;
    setValue(next);
    onValueChange?.(next);
  };
  return (
    <RadioContext.Provider value={{ value, select }}>
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
