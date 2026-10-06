import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
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

export type MenuTriggerProps = ButtonRootProps;

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
  const setOpen = useCallback(
    (next: boolean, reason: MenuOpenChangeReason) => {
      if (next === open) return;
      setValue(next);
      onOpenChange?.(next, reason);
    },
    [onOpenChange, open, setValue],
  );
  const popover = usePopoverInternal(
    { open, onOpenChange: setOpen, restoreFocusRef: triggerRef, haspopup: 'menu' },
    true,
  );
  const roving = useRovingFocus({ orientation: 'vertical', typeahead: true });
  return (
    <MenuContext.Provider value={{ open, setOpen, triggerId, triggerRef, popover, roving }}>
      {children}
    </MenuContext.Provider>
  );
}

function Trigger({ id, tooltip = false, ref, onClick, onKeyDown, ...props }: MenuTriggerProps) {
  const ctx = useMenu('Trigger');
  const refs = useComposedRefs(ctx.triggerRef, ref);
  // Opening always starts on an end of the list, never on the last item focused.
  const openAt = (end: 'first' | 'last') => {
    const values = ctx.roving.values();
    const target = end === 'first' ? values[0] : values.at(-1);
    if (target !== undefined) ctx.roving.setActiveValue(target);
  };
  const wire = ctx.popover.getTriggerProps({
    ...props,
    ref: refs,
    onClick: composeHandlers(onClick, () => {
      if (!ctx.open) openAt('first');
    }),
  });
  return (
    <Button.Root
      {...wire}
      id={id ?? ctx.triggerId}
      tooltip={tooltip}
      onKeyDown={composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openAt(event.key === 'ArrowDown' ? 'first' : 'last');
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
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}: MenuContentProps) {
  const ctx = useMenu('Content');
  const { ref: wireRef, open, id, style: wireStyle, onPointerDown, onClick } = ctx.popover.getPopoverProps();
  const localRef = useRef<HTMLDivElement | null>(null);
  usePopoverSync(localRef, open);
  const container = ctx.roving.getContainerProps({
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLElement>) => {
      // Tab leaves the menu: close it and let the browser move focus on.
      if (event.key === 'Tab') ctx.setOpen(false, 'tab');
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
      onPointerDown={onPointerDown}
      onClick={onClick}
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
    onPointerMove,
    ...props
  }: Omit<ItemBase, 'children'>,
  activate: () => void,
  checked?: boolean,
) {
  const value = useId();
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
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!disabled) activate();
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
